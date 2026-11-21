import { renderEnterprisePrompt, buildEnterpriseRepairPrompt } from "../prompts/enterprisePrompt";
import type { AgentArchetype } from "../agents/agentArchetype";
import { archetypeRegistry } from "../agents/archetypeRegistry";
import type { BusinessFunctionDefinition } from "../business/businessFunctionDefinition";
import type { Worker, WorkerCapability } from "../control/workers";
import {
  generateWithConfiguredLlm,
  generateWithPaidEscalation,
} from "../llm/llmClient";
import { canUsePaidEscalation } from "../llm/modelRouting";
import { inferBusinessFunctionCapabilities } from "../runtime/businessFunctionRuntimeRouting";
import { extractJsonObjectSubstring } from "../guidance/nextStepAdvisor";
import { isApprovalCapableMode } from "../control/humanWorkerMode";
import {
  classifySensitiveWork,
  describeSensitiveWork,
  requiresHumanApproval,
  type SensitiveWorkClassification,
} from "./sensitiveWorkClassifier";

export type ProposedStaffingWorker = {
  readonly name: string;
  readonly archetype: AgentArchetype;
  readonly functionIds: readonly string[];
  readonly existing: boolean;
  readonly rationale: string;
  /** Present when Arturo, rather than the model, supplied omitted coverage. */
  readonly source?: "fallback";
  /** Present when Arturo supplied an invalid or omitted model archetype. */
  readonly archetypeSource?: "fallback";
};

export type ProposedHumanApproval = {
  readonly functionId: string;
  readonly workerName?: string;
  readonly rationale: string;
};

export type StaffingPlan = {
  readonly summary: string;
  readonly workers: readonly ProposedStaffingWorker[];
  readonly humanApprovals: readonly ProposedHumanApproval[];
};

export type StaffingGenerator = (input: {
  readonly model: string;
  readonly prompt: string;
}) => Promise<{ readonly response: string }>;

export type StaffingPlanGenerationOptions = {
  readonly generator?: StaffingGenerator;
  readonly model?: string;
  readonly feedback?: string;
  /** Explicit routes must not silently jump to a different model. */
  readonly allowAutomaticEscalation?: boolean;
  /**
   * AI Worker names already assigned to each Function by a previously applied
   * plan, keyed by Function id. Supplied so re-running `/staff` recognises the
   * coverage it already created instead of proposing duplicates of it.
   */
  readonly existingAssignmentsByFunction?: ReadonlyMap<string, readonly string[]>;
};

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function optionalString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

/** Generic words that describe no role on their own. */
const UNINFORMATIVE_NAME_WORDS: ReadonlySet<string> = new Set([
  ...Object.keys(archetypeRegistry),
  ...Object.values(archetypeRegistry).map(
    (entry) => entry.label.toLowerCase()
  ),
  "ai",
  "agent",
  "worker",
  "bot",
  "assistant",
  "specialist",
  "helper",
  "llm",
  "model",
]);

/**
 * Whether a proposed Worker name says nothing about what the Worker is for.
 *
 * The staffing prompt has forbidden bare archetype names since it was written
 * ("never 'analyst', 'reviewer', 'researcher', 'observer'"), and a walkthrough
 * on the default local model still got back Workers called exactly Researcher,
 * Analyst, Observer, and Coach. A naming rule a small model reliably ignores is
 * not a rule, so it is decided here instead.
 *
 * PURE: No side effects.
 */
export function isUninformativeWorkerName(
  name: string
): boolean {
  const words =
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 0 && word !== "the");

  return (
    words.length === 0 ||
    words.every(
      (word) => UNINFORMATIVE_NAME_WORDS.has(word)
    )
  );
}

/**
 * Builds an organisational role name from the Function a Worker covers.
 *
 * "Problem Mapping Function" + "Observer" reads as "Problem Mapping Observer";
 * the trailing "Function" is dropped because it is Arturo's word, not the
 * operator's.
 *
 * PURE: No side effects.
 */
export function buildRoleWorkerName(
  functionLabel: string,
  archetype: AgentArchetype,
  usedNames: ReadonlySet<string>
): string {
  const roleContext =
    functionLabel.replace(/\s+Function$/i, "").trim();
  const baseName =
    `${roleContext} ${archetypeRegistry[archetype].label}`.trim();

  let name = baseName;
  let suffix = 2;
  while (usedNames.has(name.toLowerCase())) name = `${baseName} ${suffix++}`;

  return name;
}

export function parseStaffingPlan(
  response: string,
  functions: readonly BusinessFunctionDefinition[],
  existingWorkers: readonly Worker<any, any>[]
): StaffingPlan {
  // Tolerate model replies wrapped in ```json fences or surrounding prose by
  // extracting the outermost JSON object before parsing.
  const parsed = JSON.parse(extractJsonObjectSubstring(response)) as any;
  if (!parsed || !Array.isArray(parsed.workers) || !Array.isArray(parsed.humanApprovals)) {
    throw new Error("staffing response must contain workers and humanApprovals arrays");
  }
  const functionIds = new Set(functions.map((item) => item.id));
  const workersByName = new Map(
    existingWorkers.map((worker) => [worker.name.trim().toLowerCase(), worker])
  );
  const proposedNames = new Set<string>(
    existingWorkers.map((worker) => worker.name.trim().toLowerCase())
  );
  const workers = parsed.workers.map((item: any, index: number): ProposedStaffingWorker => {
    const name = requireString(item?.name, `workers[${index}].name`);
    if (!Array.isArray(item.functionIds) || item.functionIds.length === 0 ||
        item.functionIds.some((id: unknown) => typeof id !== "string" || !functionIds.has(id))) {
      throw new Error(`workers[${index}].functionIds contains an unknown function`);
    }
    const assignedFunctionIds = [...new Set(item.functionIds as string[])];
    const modelArchetype = typeof item.archetype === "string" ? item.archetype.trim() : "";
    const modelArchetypeIsValid = modelArchetype in archetypeRegistry;
    const requiredArchetype = functions
      .filter((definition) => assignedFunctionIds.includes(definition.id))
      .flatMap((definition) => definition.requiredArchetypes)[0];
    const archetype = (modelArchetypeIsValid
      ? modelArchetype
      : requiredArchetype ?? "assistant") as AgentArchetype;
    const registered = workersByName.get(name.toLowerCase());
    // A proposal that reuses a registered person's name is renamed, not fatal.
    //
    // An AI Worker must never carry a human's name — approvals are signed in a
    // named person's name, and two participants answering to one name would
    // make that record ambiguous. But failing the whole plan over it was far
    // worse than the problem: a person called "Editor in Chief" or "Workshop
    // Luthier" reads like a role, the model reuses it for the AI Worker
    // covering that Function, and after three correction attempts staffing
    // fails outright — leaving the Enterprise with no Workers at all and the
    // operator no way forward. Measured twice, on two different names.
    //
    // The model's intent (an AI Worker for this Function) is fine; only the
    // name is wrong, and there is already a renamer for exactly that. Capability
    // gaps are completed deterministically rather than failed, and this is the
    // same kind of defect.
    const collidesWithRegisteredHuman =
      Boolean(registered) && registered?.kind !== "ai";
    // Registry state is authoritative. Models frequently mislabel a proposed
    // worker as "existing"; that must not turn a valid proposal into a failed plan.
    const existing = registered?.kind === "ai";
    const assignedLabels = functions
      .filter((definition) => assignedFunctionIds.includes(definition.id))
      .map((definition) => definition.label);
    // A registered Worker keeps the name it was registered under; only a new
    // proposal can be renamed, and only when its name describes no role.
    const renamed =
      !existing && (collidesWithRegisteredHuman || isUninformativeWorkerName(name))
        ? buildRoleWorkerName(
            assignedLabels[0] ?? name,
            archetype,
            proposedNames
          )
        : undefined;
    // Never fall back to the registered name when that name is the person's.
    const resolvedName =
      (collidesWithRegisteredHuman ? undefined : registered?.name) ??
      renamed ??
      name;
    proposedNames.add(resolvedName.trim().toLowerCase());
    // When the model gives no rationale, do not present a content-free
    // restatement ("Proposed coverage for X") as though it were reasoning.
    // Ground the fallback in the Function's own objective, worded so it reads
    // as a plain Arturo-derived note rather than an error ("No model rationale
    // supplied" read to a walkthrough operator as though the plan had failed).
    //
    // For an existing Worker being reused, the model's fresh rationale routinely
    // describes the wrong thing — a walkthrough saw a reused Worker labelled
    // "No existing Human Worker, but requires human-contact capabilities" while
    // a Human was in fact registered. Its assignment here is a deterministic
    // fact (it already exists and is being reused), so state that rather than
    // pass through stale model prose.
    const assignedObjectives = functions
      .filter((definition) => assignedFunctionIds.includes(definition.id))
      .map((definition) => definition.objective?.trim())
      .filter((objective): objective is string => Boolean(objective));
    const rationale = existing
      ? `Existing AI Worker, reused to cover ${assignedLabels.join(", ")}.`
      : optionalString(
          item.rationale,
          assignedObjectives.length
            ? `Assigned to cover ${assignedLabels.join(", ")}, whose objective is: ${assignedObjectives.join("; ")}. The model gave no further rationale.`
            : `Assigned to cover ${assignedLabels.join(", ")}. The model gave no further rationale; review before applying.`
        );
    return {
      name: resolvedName,
      archetype,
      functionIds: assignedFunctionIds,
      existing,
      rationale: renamed
        ? `${endSentence(rationale)} Renamed from "${name.trim()}", which named an archetype rather than a role.`
        : rationale,
      archetypeSource: modelArchetypeIsValid ? undefined : "fallback",
    };
  });
  const humanApprovals = parsed.humanApprovals.flatMap((item: any, index: number): ProposedHumanApproval[] => {
    const functionId = requireString(item?.functionId, `humanApprovals[${index}].functionId`);
    if (!functionIds.has(functionId)) throw new Error(`unknown approval function: ${functionId}`);

    // An approval requirement with no stated reason is over-gating, not
    // governance: on a small local model the planner tends to demand a human on
    // every Function without saying why, which makes the "almost no operators"
    // promise impossible and trains the operator to rubber-stamp. Drop the
    // unreasoned ones. Genuinely consequential work is re-added deterministically
    // by requireApprovalForSensitiveWork (money, safety, legal, vulnerable
    // people, publishing in the business's name) with a real reason — that
    // deterministic classifier, not the planner's blanket judgement, is the
    // authority on when a person must decide.
    const modelReason =
      typeof item.rationale === "string" && item.rationale.trim()
        ? item.rationale.trim()
        : undefined;
    if (!modelReason) {
      return [];
    }

    const proposedWorkerName = typeof item.workerName === "string" && item.workerName.trim() ? item.workerName.trim() : undefined;
    const registeredApprover = proposedWorkerName
      ? workersByName.get(proposedWorkerName.toLowerCase())
      : undefined;
    // Never accept a model-invented identity. Retain the approval requirement as
    // unassigned so the plan remains useful, while runtime readiness continues
    // to block until a real registered human is selected.
    const workerName = registeredApprover?.kind === "human"
      ? registeredApprover.name
      : undefined;
    return [{
      functionId,
      workerName,
      rationale: modelReason,
    }];
  });
  const covered = new Set(workers.flatMap((worker: ProposedStaffingWorker) => worker.functionIds));
  const uncovered = functions.filter((item) => !covered.has(item.id));
  if (!uncovered.length) {
    return {
      summary: optionalString(parsed.summary, `Staffing coverage proposed for ${functions.length} Function${functions.length === 1 ? "" : "s"}.`),
      workers,
      humanApprovals,
    };
  }

  // Model output is advisory, but complete coverage is a runtime invariant. A
  // dedicated, reviewable proposal is safer than failing the whole operation or
  // silently assigning omitted work to an unrelated worker.
  const usedNames = new Set([
    ...existingWorkers.map((worker) => worker.name.trim().toLowerCase()),
    ...workers.map((worker: ProposedStaffingWorker) => worker.name.trim().toLowerCase()),
  ]);
  const fallbackWorkers = uncovered.map((definition): ProposedStaffingWorker => {
    const baseName = `${definition.label} AI`;
    let name = baseName;
    let suffix = 2;
    while (usedNames.has(name.toLowerCase())) name = `${baseName} ${suffix++}`;
    usedNames.add(name.toLowerCase());
    return {
      name,
      archetype: definition.requiredArchetypes[0] ?? "assistant",
      functionIds: [definition.id],
      existing: false,
      rationale: "Fallback coverage added because the model omitted this Function. Review this assignment before applying the plan.",
      source: "fallback",
      archetypeSource: "fallback",
    };
  });
  const summary = optionalString(parsed.summary, `Staffing coverage proposed for ${functions.length} Function${functions.length === 1 ? "" : "s"}.`);
  return {
    summary: `${summary} Arturo added conservative fallback coverage for ${fallbackWorkers.length} omitted Function${fallbackWorkers.length === 1 ? "" : "s"}.`,
    workers: [...workers, ...fallbackWorkers],
    humanApprovals,
  };
}

export type JobCapabilityGap = {
  readonly definition: BusinessFunctionDefinition;
  readonly missing: readonly WorkerCapability[];
};

/** The capabilities a proposed Worker grants (from its archetype, or its real
 * capabilities when it is an existing Worker). Capabilities are never assigned
 * directly — they come entirely from the archetype. */
function grantedWorkerCapabilities(
  proposal: ProposedStaffingWorker,
  existingByName: Map<string, Worker<any, any>>
): readonly WorkerCapability[] {
  return proposal.existing
    ? existingByName.get(proposal.name.trim().toLowerCase())?.capabilities ?? []
    : archetypeRegistry[proposal.archetype].capabilities;
}

/**
 * For each Job, the required capabilities not covered by the UNION of the
 * capabilities of all Workers assigned to it. A Job is staffed by a team; no
 * single Worker's archetype needs to cover everything, so coverage is assessed
 * per Job across its assigned Workers, not per individual Worker.
 *
 * PURE: No side effects.
 */
export function findUncoveredJobCapabilities(
  plan: StaffingPlan,
  functions: readonly BusinessFunctionDefinition[],
  existingWorkers: readonly Worker<any, any>[]
): readonly JobCapabilityGap[] {
  const existingByName = new Map(
    existingWorkers.map((worker) => [worker.name.trim().toLowerCase(), worker])
  );

  return functions.flatMap((definition) => {
    const required = inferBusinessFunctionCapabilities(definition, true);
    const covered = new Set<WorkerCapability>();
    for (const proposal of plan.workers) {
      if (proposal.functionIds.includes(definition.id)) {
        for (const capability of grantedWorkerCapabilities(proposal, existingByName)) {
          covered.add(capability);
        }
      }
    }
    const missing = required.filter((capability) => !covered.has(capability));
    return missing.length > 0 ? [{ definition, missing }] : [];
  });
}

/**
 * Greedily selects the fewest archetypes whose combined capabilities cover a
 * missing set. Deterministic: archetype ids are considered in sorted order and
 * ties broken by that order. Stops if no archetype covers any remaining
 * capability (which cannot happen for capabilities Arturo can infer, since each
 * maps to at least one archetype).
 *
 * PURE: No side effects.
 */
function archetypesCoveringCapabilities(
  missing: readonly WorkerCapability[]
): readonly AgentArchetype[] {
  const remaining = new Set<WorkerCapability>(missing);
  const chosen: AgentArchetype[] = [];
  const candidateIds = (Object.keys(archetypeRegistry) as AgentArchetype[]).sort();

  while (remaining.size > 0) {
    let best: AgentArchetype | undefined;
    let bestCovered = 0;
    for (const id of candidateIds) {
      const covers = archetypeRegistry[id].capabilities.filter(
        (capability) => remaining.has(capability)
      ).length;
      if (covers > bestCovered) {
        best = id;
        bestCovered = covers;
      }
    }
    if (!best || bestCovered === 0) break;
    chosen.push(best);
    for (const capability of archetypeRegistry[best].capabilities) {
      remaining.delete(capability);
    }
  }

  return chosen;
}

/**
 * Guarantees every Job's required capabilities are covered by the UNION of its
 * assigned Workers, adding clearly-marked "review required" fallback Workers
 * (each contributing its archetype's capabilities) for any gap. This is how a
 * Job with mixed needs no single archetype provides gets staffed as a team,
 * without ever granting a Worker capabilities directly.
 *
 * PURE: No side effects (returns a new plan).
 */
export function completeCapabilityCoverage(
  plan: StaffingPlan,
  functions: readonly BusinessFunctionDefinition[],
  existingWorkers: readonly Worker<any, any>[]
): StaffingPlan {
  const gaps = findUncoveredJobCapabilities(plan, functions, existingWorkers);
  if (gaps.length === 0) return plan;

  const usedNames = new Set<string>([
    ...existingWorkers.map((worker) => worker.name.trim().toLowerCase()),
    ...plan.workers.map((worker) => worker.name.trim().toLowerCase()),
  ]);
  const added: ProposedStaffingWorker[] = [];

  for (const { definition, missing } of gaps) {
    for (const archetype of archetypesCoveringCapabilities(missing)) {
      const name = buildRoleWorkerName(
        definition.label,
        archetype,
        usedNames
      );
      usedNames.add(name.toLowerCase());
      added.push({
        name,
        archetype,
        functionIds: [definition.id],
        existing: false,
        rationale: `Fallback coverage added so the team covers all capabilities ${definition.label} needs. Review this assignment before applying the plan.`,
        source: "fallback",
        archetypeSource: "fallback",
      });
    }
  }

  if (added.length === 0) return plan;

  return {
    summary: `${endSentence(plan.summary)} Arturo added ${added.length} Worker${added.length === 1 ? "" : "s"} to complete capability coverage; review before applying.`,
    workers: [...plan.workers, ...added],
    humanApprovals: plan.humanApprovals,
  };
}

/**
 * Re-adds AI Workers a previous plan already assigned to a Function, so a
 * re-run's capability check counts coverage that already exists.
 *
 * Re-running `/staff` — which the operator is told to do after registering an
 * approver — sent the model a fresh planning task. The model reassigned the
 * primary Workers but not the "review required" fallbacks Arturo had added on
 * the first run, so completeCapabilityCoverage judged those capabilities
 * uncovered and created a second set ("... Observer 2", "... Researcher 2").
 * Coverage is a property of everyone assigned to a Function, not only whoever
 * the model happened to re-list, so the already-assigned Workers are folded
 * back in here before the gap is measured.
 *
 * Only assignments to a currently-registered AI Worker are honoured; a name in
 * the store with no live Worker is ignored rather than trusted.
 *
 * PURE: No side effects (returns a new plan).
 */
export function includeExistingAssignments(
  plan: StaffingPlan,
  functions: readonly BusinessFunctionDefinition[],
  existingWorkers: readonly Worker<any, any>[],
  assignmentsByFunction: ReadonlyMap<string, readonly string[]>
): StaffingPlan {
  const functionIds = new Set(functions.map((definition) => definition.id));
  const aiWorkersByName = new Map(
    existingWorkers
      .filter((worker) => worker.kind === "ai")
      .map((worker) => [worker.name.trim().toLowerCase(), worker])
  );
  // What the plan already covers, so a re-added Worker never duplicates an entry
  // the model itself supplied for the same Function.
  const coveredPairs = new Set(
    plan.workers.flatMap((worker) =>
      worker.functionIds.map(
        (id) => `${worker.name.trim().toLowerCase()}::${id}`
      )
    )
  );

  const readded: ProposedStaffingWorker[] = [];
  for (const [functionId, workerNames] of assignmentsByFunction) {
    if (!functionIds.has(functionId)) continue;
    for (const rawName of workerNames) {
      const worker = aiWorkersByName.get(rawName.trim().toLowerCase());
      if (!worker) continue;
      if (coveredPairs.has(`${worker.name.trim().toLowerCase()}::${functionId}`)) {
        continue;
      }
      coveredPairs.add(`${worker.name.trim().toLowerCase()}::${functionId}`);
      readded.push({
        name: worker.name,
        archetype: worker.archetype as AgentArchetype,
        functionIds: [functionId],
        existing: true,
        rationale: `Existing AI Worker, reused to cover ${
          functions.find((definition) => definition.id === functionId)?.label ??
          functionId
        }.`,
      });
    }
  }

  if (readded.length === 0) return plan;

  return {
    ...plan,
    workers: [...plan.workers, ...readded],
  };
}

function buildPrompt(
  functions: readonly BusinessFunctionDefinition[],
  workers: readonly Worker<any, any>[],
  feedback?: string
): string {
  const requiredIds = functions.map((item) => item.id);
  const jobsWithRequiredCapabilities = functions.map((definition) => ({
    id: definition.id,
    label: definition.label,
    objective: definition.objective,
    description: definition.description,
    requiredArchetypes: definition.requiredArchetypes,
    // Inferred against the full definition (inferBusinessFunctionCapabilities
    // also reads inputs/outputs/successCriteria), not a partial projection.
    requiredCapabilities: inferBusinessFunctionCapabilities(definition, true),
  }));
  const archetypeCapabilities = Object.fromEntries(
    Object.entries(archetypeRegistry).map(
      ([id, definition]) => [id, definition.capabilities]
    )
  );

  return renderEnterprisePrompt("Worker Staffing Plan", {
    FEEDBACK: feedback?.trim() || "(none)",
    FUNCTION_COUNT: requiredIds.length,
    REQUIRED_FUNCTION_IDS: requiredIds.map((id) => `- ${id}`).join("\n"),
    FUNCTIONS: JSON.stringify(jobsWithRequiredCapabilities, null, 2),
    EXISTING_WORKERS: JSON.stringify(workers.map(({name,kind,archetype,capabilities,availability}) => ({name,kind,archetype,capabilities,availability})), null, 2),
    ARCHETYPE_CAPABILITIES: JSON.stringify(archetypeCapabilities, null, 2)
  });
}

export function buildStaffingRepairPrompt(
  functions: readonly BusinessFunctionDefinition[],
  workers: readonly Worker<any, any>[],
  invalidResponse: string,
  validationError: string,
  attempt: number,
  feedback?: string
): string {
  return buildEnterpriseRepairPrompt(
    buildPrompt(functions, workers, feedback), invalidResponse, validationError,
    `Correction attempt ${attempt} of 3. Return the COMPLETE plan again, including coverage for every required function ID. Do not return only the missing entries. Return one corrected JSON object only.`
  );
}

/**
 * Ensures model-written prose ends a sentence before more is appended.
 *
 * A model summary without a closing full stop ran straight into Arturo's own
 * sentence: "Worker coverage plan for Marlowe Books Arturo added 1 Worker...".
 *
 * PURE: No side effects.
 */
export function endSentence(
  value: string
): string {
  const trimmed = value.trim();

  return !trimmed || /[.!?]$/.test(trimmed)
    ? trimmed
    : `${trimmed}.`;
}

/**
 * Fills in approvers the model left unassigned when the choice is unambiguous.
 *
 * The schema example handed to the model shows `"workerName":null`, so it
 * returned null every time — including when a Human Worker existed. The plan
 * then told the operator to "add a Human worker, then re-run /staff", which
 * they had already done, producing an instruction loop with no way out.
 *
 * Choosing among several Humans is a real decision and stays with the
 * operator; picking the only one there is, is not.
 *
 * PURE: No side effects.
 */
export function assignUnambiguousApprovers(
  plan: StaffingPlan,
  workers: readonly Worker<any, any>[]
): StaffingPlan {
  const humans =
    workers.filter(
      (worker) => worker.kind === "human" && !worker.system
    );

  // Only an approval-capable Human can actually clear an approval. Naming a
  // "task"-mode Human (the default `/add-human-worker "<name>"`) as the
  // accountable approver produces a plan the approval gate then rejects — the
  // two subsystems must agree, so a Human who cannot approve is never named
  // here. The plan is left with the requirement unassigned, and the operator is
  // told they need an approving Human, not merely any Human.
  const approvers =
    humans.filter(
      (worker) => isApprovalCapableMode(worker.humanMode)
    );

  if (approvers.length !== 1) {
    return plan;
  }

  const [approver] = approvers;

  return {
    ...plan,
    humanApprovals: plan.humanApprovals.map(
      (approval) =>
        approval.workerName
          ? approval
          : {
              ...approval,
              workerName: approver.name,
              rationale: `${endSentence(approval.rationale)} Assigned to ${approver.name}, the only registered Human Worker who can approve.`,
            }
    ),
  };
}

/**
 * Adds the Human approval requirements the planner left out.
 *
 * The planner is asked to propose these and, on a small local model, reliably
 * does not — including for a Function called "invoicing" when told outright
 * that money was involved. The categories are classified separately; whether an
 * approval requirement follows is decided here, so it cannot be dropped.
 *
 * An approval the planner already proposed is left exactly as it is.
 *
 * PURE: No side effects.
 */
export function requireApprovalForSensitiveWork(
  plan: StaffingPlan,
  functions: readonly BusinessFunctionDefinition[],
  classification: SensitiveWorkClassification | undefined
): StaffingPlan {
  const alreadyRequired = new Set(
    plan.humanApprovals.map((approval) => approval.functionId)
  );

  const added = functions
    .filter(
      (definition) =>
        !alreadyRequired.has(definition.id) &&
        requiresHumanApproval(definition.id, classification)
    )
    .map(
      (definition): ProposedHumanApproval => ({
        functionId: definition.id,
        rationale: describeSensitiveWork(
          definition.label,
          classification?.get(definition.id) ?? []
        ),
      })
    );

  return added.length === 0
    ? plan
    : {
        ...plan,
        summary: `${endSentence(plan.summary)} Arturo required Human approval for ${added.length} Function${added.length === 1 ? "" : "s"} whose work needs a person's sign-off.`,
        humanApprovals: [...plan.humanApprovals, ...added],
      };
}

export async function createStaffingPlan(
  functions: readonly BusinessFunctionDefinition[],
  workers: readonly Worker<any, any>[],
  options: StaffingPlanGenerationOptions = {}
): Promise<StaffingPlan> {
  const model =
    options.model ??
    process.env.ARTURO_LLM_MODEL ??
    "llama3.2:latest";
  const generator =
    options.generator ??
    generateWithConfiguredLlm;

  // Asked separately, and before the plan, so that a planner failure cannot
  // also lose the approval requirements. Any Function left unclassified
  // requires approval rather than having the requirement waived.
  const classification: SensitiveWorkClassification =
    await classifySensitiveWork(
      functions,
      async (prompt) =>
        (
          await generator({
            model,
            prompt,
          })
        ).response
    );

  // Approver assignment runs last: it must also see the requirements added for
  // sensitive work, or the Functions Arturo itself insisted on are the only
  // ones left without the single obvious approver.
  const complete = (plan: StaffingPlan): StaffingPlan =>
    assignUnambiguousApprovers(
      requireApprovalForSensitiveWork(
        completeCapabilityCoverage(
          options.existingAssignmentsByFunction
            ? includeExistingAssignments(
                plan,
                functions,
                workers,
                options.existingAssignmentsByFunction
              )
            : plan,
          functions,
          workers
        ),
        functions,
        classification
      ),
      workers
    );

  let result = await generator({
    model,
    prompt: buildPrompt(
      functions,
      workers,
      options.feedback
    ),
  });
  let lastError: unknown;
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    try {
      // Retries handle hard JSON/schema failures only. Capability gaps are
      // completed deterministically (as a team), never retried, never failed.
      const plan = parseStaffingPlan(result.response, functions, workers);
      return complete(plan);
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      result = await generator({
        model,
        prompt: buildStaffingRepairPrompt(
          functions,
          workers,
          result.response,
          error instanceof Error ? error.message : String(error),
          attempt + 1,
          options.feedback
        ),
      });
    }
  }

  if (
    options.allowAutomaticEscalation !== false &&
    !options.generator &&
    canUsePaidEscalation()
  ) {
    const escalated = await generateWithPaidEscalation({
      reason: "repeated-structured-output-failure",
      prompt: buildEnterpriseRepairPrompt(buildPrompt(functions, workers, options.feedback), result.response, lastError instanceof Error ? lastError.message : String(lastError)),
    });
    try {
      const plan = parseStaffingPlan(escalated.response, functions, workers);
      return complete(plan);
    } catch (error) {
      throw new Error(`Paid escalation also returned an invalid staffing plan. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  throw new Error(`Arturo could not validate a complete staffing plan after 3 correction attempts. ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}
