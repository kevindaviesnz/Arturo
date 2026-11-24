import { isWorkerAvailableForNewTask } from "../control/workers";
import {
  listBusinessFunctionDefinitions,
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";
import {
  getWorker,
  listWorkers,
  registerAiWorker,
  resolveRegisteredWorkerCapabilities,
  type WorkerCapability,
} from "../control/workers";
import {
  getEnterpriseByIdOrName,
  listEnterprises,
} from "../enterprise/enterpriseStore";
import { startRuntimeForBusinessFunction } from "../repl/runtimeCommands";
import { formatWorkerCapabilityLabel } from "../repl/workerRegistrationCommands";
import {
  createStaffingPlan,
  type ProposedStaffingWorker,
  type StaffingPlan,
} from "../staffing/staffingPlanner";
import {
  inferBusinessFunctionCapabilities,
} from "../runtime/businessFunctionRuntimeRouting";
import { listStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { buildStaffingApprovalRules, mergeStaffingApprovalRules } from "../staffing/staffingApprovalPolicy";
import { loadPolicyRules, savePolicyRules } from "../storage/policyRepository";
import { isInteractiveSession } from "../core/interactivity";
import { getModelRoutingStatus } from "../llm/modelRouting";
import type { WorkStreamEntry } from "./uiState";

let pendingStaffingPlan: StaffingPlan | undefined;

/** Capitalises a raw archetype id for display ("coach" → "Coach"). */
function humaniseRole(archetype: string): string {
  return archetype.replace(/^\w/, (letter) => letter.toUpperCase());
}

export type StaffCommandOptions = {
  readonly instructions?: string;
  readonly enterpriseReference?: string;
};

export function parseStaffCommandOptions(
  args: readonly string[]
): StaffCommandOptions {
  let instructions: string | undefined;
  let enterpriseReference: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const option = args[index];
    // Model choice moved to /model, which remembers the pick for every
    // command. The old switches get a pointer there, not a cold "unknown
    // option".
    if (
      option === "--model" ||
      option === "--retry" ||
      option === "--compare"
    ) {
      throw new Error(
        `${option} has been replaced by the /model command. Run /model to choose which AI model Arturo uses, then run /staff again.`
      );
    }
    if (
      option !== "--instructions" &&
      option !== "--feedback" &&
      option !== "--enterprise"
    ) {
      throw new Error(`Unknown /staff option: ${option}`);
    }
    const value = args[index + 1]?.trim();
    if (!value || value.startsWith("--")) {
      throw new Error(`${option} requires a value.`);
    }
    index += 1;

    if (
      option === "--instructions" ||
      option === "--feedback"
    ) {
      instructions = value;
    } else {
      enterpriseReference = value;
    }
  }

  return {
    ...(instructions
      ? {
          instructions,
        }
      : {}),
    ...(enterpriseReference
      ? {
          enterpriseReference,
        }
      : {}),
  };
}

export function clearPendingStaffingPlan(): void { pendingStaffingPlan = undefined; }

// --- Interactive staffing review (one Worker at a time) ---------------------
//
// Instead of one wall of text and a single yes/no, an interactive operator
// reviews the proposed AI Workers one at a time, saying yes or skip to each,
// with a couple of example tasks so they can picture the work. Only the ones
// they approve are created; skipping is safe — the runtime already tolerates
// and reports partial coverage. The human sign-off requirements are noted at
// the end. Headless/CI keeps the whole-plan formatPlan + yes/no path.

type StaffReview = {
  readonly plan: StaffingPlan;
  readonly enterpriseName: string;
  readonly index: number;
  readonly approved: readonly string[];
  /**
   * Set once every proposed Worker has been skipped: the next reply is what
   * should be different, not another yes/skip. This is what --instructions was
   * for.
   */
  readonly awaitingInstructions?: boolean;
};

let pendingStaffReview: StaffReview | undefined;

/**
 * The businesses offered when /staff is run and more than one exists.
 *
 * Asking which one is the same answer --enterprise carried, given by number.
 * A staffing plan is scoped to one business, so this has to be resolved before
 * anything is generated.
 */
let pendingStaffEnterprisePick: readonly string[] | undefined;

/** Clears any pending which-business question. */
export function clearStaffEnterprisePick(): void {
  pendingStaffEnterprisePick = undefined;
}

/** Asks which business the staffing plan is for. */
function askStaffEnterprise(
  names: readonly string[]
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Which business?",
    body: [
      "Which business needs Worker coverage?",
      "",
      ...names.map((name, index) => `  ${index + 1}. ${name}`),
      "",
      "Reply with a number, or ESC to go back.",
    ].join("\n"),
  };
}

export function isStaffReviewActive(): boolean {
  return (
    pendingStaffReview !== undefined ||
    pendingStaffEnterprisePick !== undefined
  );
}

export function clearStaffReview(): void {
  pendingStaffReview = undefined;
}

const NUMBER_WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
] as const;

/**
 * Spells a small count as a word, as prose does: "one AI Worker", "Worker two
 * of three". Above nine a numeral reads better than the word, and a staffing
 * plan that large is being skimmed rather than read.
 *
 * PURE: No side effects.
 */
export function numberWord(
  value: number
): string {
  return Number.isInteger(value) && value >= 0 && value < NUMBER_WORDS.length
    ? NUMBER_WORDS[value]
    : String(value);
}

/** Same, for the start of a sentence. */
function capitalisedNumberWord(
  value: number
): string {
  const word = numberWord(value);
  return `${word[0].toUpperCase()}${word.slice(1)}`;
}

/** Builds the card shown for one proposed Worker. */
function formatWorkerReviewCard(
  worker: ProposedStaffingWorker,
  position: number,
  total: number
): WorkStreamEntry {
  const definitionsById = new Map(
    listBusinessFunctionDefinitions().map((definition) => [definition.id, definition.label])
  );
  const capabilities = worker.existing
    ? getWorker(worker.name)?.capabilities ?? resolveRegisteredWorkerCapabilities(worker.archetype)
    : resolveRegisteredWorkerCapabilities(worker.archetype);
  const handles = worker.functionIds
    .map((id) => definitionsById.get(id) ?? id)
    .join(", ");
  return {
    actor: "Arturo",
    label: `Worker ${numberWord(position)} of ${numberWord(total)}`,
    body: [
      worker.name,
      `  Role:        ${humaniseRole(worker.archetype)}`,
      `  Can do:      ${capabilities.map(formatWorkerCapabilityLabel).join(", ") || "general work"}`,
      `  Would help:  ${handles}`,
      ...(worker.source === "fallback"
        ? ["  Note:        Arturo added this one to fill a gap — worth a look."]
        : []),
      "",
      `Add ${worker.name}? Reply yes to add, no to skip, or ESC to stop.`,
    ].join("\n"),
  };
}

/**
 * Starts the interactive review. Returns a short intro plus the first Worker
 * card; the reply router then feeds each answer to handleStaffReviewReply.
 */
export function startStaffReview(
  plan: StaffingPlan,
  enterpriseName: string
): readonly WorkStreamEntry[] {
  clearPendingStaffingPlan();

  if (plan.workers.length === 0) {
    // No AI Workers proposed — apply straight away (this still records any
    // human sign-off rules the plan carries) rather than open an empty review.
    return applyStaffingPlan(plan);
  }

  pendingStaffReview = { plan, enterpriseName, index: 0, approved: [] };

  const intro: WorkStreamEntry = {
    actor: "Arturo",
    label: `Arturo suggests ${numberWord(plan.workers.length)} AI Worker${plan.workers.length === 1 ? "" : "s"} for ${enterpriseName}.`,
    body: "",
  };

  return [intro, formatWorkerReviewCard(plan.workers[0], 1, plan.workers.length)];
}

/**
 * Routes a reply to the active staffing review. Returns undefined when no
 * review is active so the caller can pass the reply on.
 *
 * SIDE EFFECT: On the final Worker, applies the approved subset of the plan
 * (registers Workers, saves assignments, writes approval rules).
 */
/**
 * What the operator said should be different about the staffing plan.
 *
 * /staff used to take this as --instructions. It is now asked for when every
 * proposed Worker has been skipped — the moment it is obviously useful — and
 * spent on the next run.
 */
let carriedStaffInstructions: string | undefined;

/** Remembers the constraint, for the next /staff run to use. */
export function recordStaffInstructions(instructions: string): void {
  carriedStaffInstructions = instructions.trim() || undefined;
}

/** Reads and clears the carried constraint, so it is used exactly once. */
export function takeStaffInstructions(): string | undefined {
  const carried = carriedStaffInstructions;
  carriedStaffInstructions = undefined;
  return carried;
}

export async function handleStaffReviewReply(
  reply: string
): Promise<readonly WorkStreamEntry[] | undefined> {
  if (pendingStaffEnterprisePick) {
    const names = pendingStaffEnterprisePick;
    const trimmedPick = reply.trim();
    if (trimmedPick.toLowerCase() === "cancel") {
      clearStaffEnterprisePick();
      return [{ actor: "Arturo", label: "Staffing unchanged", body: "No Workers or assignments were created." }];
    }
    const index = Number(trimmedPick);
    if (!Number.isInteger(index) || index < 1 || index > names.length) {
      return [askStaffEnterprise(names)];
    }
    clearStaffEnterprisePick();
    return await handleUiStaffCommand(["--enterprise", names[index - 1]]);
  }

  if (!pendingStaffReview) return undefined;

  const review = pendingStaffReview;
  const trimmed = reply.trim().toLowerCase();

  if (trimmed === "cancel") {
    clearStaffReview();
    return [{ actor: "Arturo", label: "Staffing unchanged", body: "No Workers or assignments were created." }];
  }

  if (review.awaitingInstructions) {
    clearStaffReview();
    if (!reply.trim() || trimmed === "no" || trimmed === "skip") {
      return [{ actor: "Arturo", label: "Staffing unchanged", body: "No Workers or assignments were created." }];
    }
    recordStaffInstructions(reply.trim());
    return [
      {
        actor: "Arturo",
        label: "Noted",
        body: "Arturo will take that into account. Run /staff to see a fresh plan.",
      },
    ];
  }

  const worker = review.plan.workers[review.index];
  let approved = review.approved;

  if (trimmed === "yes" || trimmed === "y") {
    approved = [...approved, worker.name];
  } else if (trimmed !== "skip" && trimmed !== "no" && trimmed !== "n") {
    return [{ actor: "Arturo", label: `Worker ${review.index + 1} of ${review.plan.workers.length}`, body: `Please reply yes to add ${worker.name}, skip to leave it out, or cancel to stop.` }];
  }

  const nextIndex = review.index + 1;

  if (nextIndex < review.plan.workers.length) {
    pendingStaffReview = { ...review, index: nextIndex, approved };
    return [formatWorkerReviewCard(review.plan.workers[nextIndex], nextIndex + 1, review.plan.workers.length)];
  }

  // Last Worker answered — apply the approved subset.
  clearStaffReview();
  const approvedWorkers = review.plan.workers.filter((candidate) => approved.includes(candidate.name));

  if (approvedWorkers.length === 0) {
    // Skipping every Worker is the moment a planning constraint matters most,
    // so ask for it rather than leaving --instructions to be found in help.
    pendingStaffReview = { ...review, approved, awaitingInstructions: true };
    return [{
      actor: "Arturo",
      label: "Staffing unchanged",
      body: [
        "You skipped every Worker, so nothing was created.",
        "",
        "What should be different? (For example: prefer shared Workers, or don't invent Human approvers.)",
        "Arturo will take it into account next time. Or type no to leave it.",
      ].join("\n"),
    }];
  }

  return applyStaffingPlan({ ...review.plan, workers: approvedWorkers });
}

/**
 * Derives the explicit capabilities needed by all Functions in one staffing
 * proposal. These labels control routing eligibility; they do not configure
 * external providers or bypass Governance.
 */
export function inferStaffingWorkerCapabilities(
  proposal:
    ProposedStaffingWorker
): readonly WorkerCapability[] {
  const definitionsById =
    new Map(
      listBusinessFunctionDefinitions()
        .map(
          (definition) => [
            definition.id,
            definition,
          ]
        )
    );

  return [
    ...new Set(
      proposal.functionIds
        .flatMap(
          (id) => {
            const definition =
              definitionsById.get(
                id
              );
            return definition
              ? inferBusinessFunctionCapabilities(
                  definition
                )
              : [];
          }
        )
    ),
  ];
}

export function formatPlan(
  plan: StaffingPlan,
  includeConfirmation = true,
  enterpriseName?: string
): string {
  const definitionsById = new Map(
    listBusinessFunctionDefinitions().map((definition) => [definition.id, definition])
  );
  const newWorkers = plan.workers.filter((worker) => !worker.existing);
  const sharedWorkers = plan.workers.filter((worker) => worker.functionIds.length > 1);
  const unassignedApprovals = plan.humanApprovals.filter(
    (approval) => !approval.workerName
  );
  const functionReference = (id: string): string => {
    const definition = definitionsById.get(id);
    return definition ? `${definition.label} (${id})` : id;
  };
  const workerCapabilities =
    (
      worker:
        ProposedStaffingWorker
    ): readonly WorkerCapability[] => {
      const existing =
        worker.existing
          ? getWorker(
              worker.name
            )
          : undefined;
      return existing
        ?.capabilities ??
        resolveRegisteredWorkerCapabilities(
          worker.archetype
        );
    };
  return [
    "Here is Arturo's plan for who does the work.",
    ...(enterpriseName
      ? [
          `Enterprise: ${enterpriseName}`,
        ]
      : []),
    "",
    "AI Workers do the routine work. A person gives a go-ahead for anything that reaches",
    "outside Arturo — sending an email, running a command, writing a file.",
    "Nothing is created until you say yes.",
    "For Accounts, Customers and Operations, accepted staffing includes record tools and draft preparation. Existing restrictions still apply. Workers cannot issue or send invoices.",
    "",
    "In short",
    `  ${newWorkers.length} new AI Worker${newWorkers.length === 1 ? "" : "s"} to add`,
    `  ${plan.workers.length - newWorkers.length} existing Worker${plan.workers.length - newWorkers.length === 1 ? "" : "s"} reused`,
    `  ${plan.humanApprovals.length} Function${plan.humanApprovals.length === 1 ? "" : "s"} that will ask before acting outside Arturo`,
    ...(unassignedApprovals.length
      ? [
          `  ${unassignedApprovals.length} still need${unassignedApprovals.length === 1 ? "s" : ""} a person who can sign off work and give go-aheads — add one with /add-human-worker (that can be you)`,
        ]
      : []),
    "",
    "AI Workers",
    ...plan.workers.flatMap((worker, index) => [
      `${index + 1}. ${worker.name}`,
      `   Status:  ${worker.existing ? "Already exists" : "New"}${worker.source === "fallback" ? " · Arturo added this, please review" : ""}`,
      `   Role:    ${worker.archetype}`,
      `   Can do:  ${workerCapabilities(worker).map(formatWorkerCapabilityLabel).join(", ") || "none"}`,
      `   Handles: ${worker.functionIds.map(functionReference).join(", ")}`,
      `   Why:     ${worker.rationale}`,
    ]),
    "",
    "What a person is asked about",
    // Naming what is *not* gated matters as much as what is. The old wording
    // read as "everything this Function does", which is what it used to mean,
    // and an operator expecting to approve every draft will not notice when
    // they quietly stop being asked.
    "  Analysis, drafting and research inside these run without waiting.",
    ...(plan.humanApprovals.length
      ? plan.humanApprovals.flatMap((approval, index) => [
          `${index + 1}. ${functionReference(approval.functionId)}`,
          `   Approver: ${approval.workerName ?? 'Nobody yet — add a person who can sign off work and give go-aheads with /add-human-worker (that can be you).'}`,
          `   Why:      ${approval.rationale}`,
        ])
      : ["  Nothing here needs a person's approval."]),
    "",
    "Summary",
    `  ${plan.summary}`,
    "",
    ...(includeConfirmation
      ? [
          "Shall Arturo set this up? Reply yes or no.",
          "Nothing is created until you answer yes.",
        ]
      : []),
  ].join("\n");
}

export async function handleUiStaffCommand(args: readonly string[]): Promise<readonly WorkStreamEntry[]> {
  clearPendingStaffingPlan();
  clearStaffReview();
  let options: StaffCommandOptions;
  try {
    options = parseStaffCommandOptions(args);
  } catch (error) {
    return [{
      actor: "Arturo",
      label: "Usage",
      body: error instanceof Error ? error.message : String(error),
    }];
  }
  const enterprises =
    listEnterprises();
  const enterprise =
    options.enterpriseReference
      ? getEnterpriseByIdOrName(
          options.enterpriseReference
        )
      : enterprises.length === 1
        ? enterprises[0]
        : undefined;
  if (
    options.enterpriseReference &&
    !enterprise
  ) {
    return [{
      actor: "Arturo",
      label: "Enterprise not found",
      body: [
        `enterprise not found: ${options.enterpriseReference}`,
        "Run /enterprise list, then copy an exact Enterprise name or ID.",
      ].join("\n"),
    }];
  }
  if (!enterprise && enterprises.length > 1) {
    // Several businesses: ask which, by number, rather than demanding a switch.
    const names = enterprises.map((candidate) => candidate.name);
    pendingStaffEnterprisePick = names;
    return [askStaffEnterprise(names)];
  }
  if (!enterprise) {
    return [{
      actor: "Arturo",
      label: "Enterprise required",
      body: enterprises.length === 0
        ? [
            "Create an Enterprise and its Functions before planning Worker coverage.",
            "",
            '  /enterprise    Arturo asks about your business and sets it up',
            '  /next          Arturo recommends the Functions to create',
          ].join("\n")
        : [
            "More than one Enterprise is available.",
            "Run /staff and Arturo will ask which business.",
          ].join("\n"),
    }];
  }
  const functions =
    listBusinessFunctionDefinitionsByEnterprise(
      enterprise.id
    );
  // Telling an operator to "create its Functions" without saying how is a dead
  // end: a walkthrough reached this after a guided setup whose "create these
  // Functions?" offer was lost to a restart, with no signposted way back.
  if (!functions.length) {
    return [{
      actor: "Arturo",
      label: "Staffing",
      body: [
        `${enterprise.name} has no Functions yet, so there is nothing to staff.`,
        "",
        `  /next "${enterprise.name}"    Arturo recommends the Functions to create`,
        `  /function create "<name>" --enterprise "${enterprise.name}" --objective "<objective>"`,
      ].join("\n"),
    }];
  }
  try {
    // Coverage a previous plan already created, so a re-run recognises it
    // instead of proposing duplicate fallback Workers (a walkthrough re-ran
    // /staff to assign an approver and was handed "... Observer 2" etc.).
    const existingAssignmentsByFunction = new Map(
      functions.map((definition) => [
        definition.id,
        listStaffingAssignments(definition.id)
          .filter((assignment) => assignment.role === "ai")
          .map((assignment) => assignment.workerName),
      ])
    );
    // A paid external call can happen inside createStaffingPlan: after the
    // local model fails schema validation four times, it escalates by itself.
    // Consent for that is install-time only (the ARTURO_PAID_ESCALATION_*
    // variables), so nothing told the operator it had happened — the first
    // anyone heard of it was an error naming a "paid escalation" that had
    // already been made and billed.
    const budgetBefore =
      getModelRoutingStatus().paidCallsRemaining;

    const plan = await createStaffingPlan(
      functions,
      listWorkers(),
      {
        feedback: options.instructions ?? takeStaffInstructions(),
        existingAssignmentsByFunction,
      }
    );

    const escalationNotice =
      describePaidEscalation(budgetBefore);

    // Interactive operators review the plan one Worker at a time; headless/CI
    // runs keep the whole-plan text plus a single yes/no (they can't answer a
    // multi-turn review).
    if (isInteractiveSession()) {
      return [
        ...escalationNotice,
        ...startStaffReview(plan, enterprise.name),
      ];
    }

    pendingStaffingPlan = plan;
    return [
      ...escalationNotice,
      {
        actor: "Arturo",
        label: "AI-generated staffing plan",
        body: [
          formatPlan(
            plan,
            true,
            enterprise.name
          ),
          "",
          "Not happy with this plan? Run /model to have a different AI model write the next one.",
        ].join("\n"),
      },
    ];
  } catch (error) {
    return [{ actor: "Arturo", label: "Staffing plan failed", body: error instanceof Error ? error.message : String(error) }];
  }
}

/**
 * Reports a paid external call that /staff made on its own behalf.
 *
 * Returns nothing when the budget did not move, which is the ordinary case —
 * escalation needs five environment variables set before it can fire at all,
 * and most installations have none of them.
 *
 * PURE: No side effects.
 */
export function describePaidEscalation(
  budgetBefore: number,
  status: Pick<
    ReturnType<typeof getModelRoutingStatus>,
    "paidCallsRemaining" | "paidModel"
  > = getModelRoutingStatus()
): readonly WorkStreamEntry[] {
  const spent =
    budgetBefore - status.paidCallsRemaining;

  if (spent <= 0) return [];

  return [
    {
      actor: "Arturo",
      label: "Paid model used",
      body: [
        `The local model could not produce a usable staffing plan, so Arturo used ${
          status.paidModel ?? "the configured external model"
        } instead.`,
        "",
        `That is ${spent} paid ${
          spent === 1 ? "call" : "calls"
        }; ${status.paidCallsRemaining} remain this session.`,
        "The names of your Functions and Workers were sent to that provider.",
        "",
        "Set ARTURO_PAID_ESCALATION_ENABLED=false to stop this happening.",
      ].join("\n"),
    },
  ];
}

export function handleUiStaffConfirmation(response: string): readonly WorkStreamEntry[] | undefined {
  if (!pendingStaffingPlan) return undefined;
  const normalized = response.trim().toLowerCase();
  if (normalized === "no" || normalized === "n") {
    clearPendingStaffingPlan();
    return [{ actor: "Arturo", label: "Staffing unchanged", body: "No workers or assignments were created." }];
  }
  if (normalized !== "yes" && normalized !== "y") {
    return [{ actor: "Arturo", label: "Confirmation required", body: 'Reply "yes" to apply the staffing plan, or "no" to leave staffing unchanged.' }];
  }
  const plan = pendingStaffingPlan;
  clearPendingStaffingPlan();
  return applyStaffingPlan(plan);
}

/**
 * Creates the Workers, assignments, and governance the operator just approved.
 *
 * SIDE EFFECT:
 * - Registers AI Workers and saves staffing assignments.
 * - Writes the Function-scoped approval rules the plan requires.
 */
export function applyStaffingPlan(
  plan: StaffingPlan
): readonly WorkStreamEntry[] {
  // No apply-time capability gate: plans from createStaffingPlan are
  // capability-complete by construction — each Job is covered by the union of
  // its assigned Workers' archetypes, with fallback Workers already added for
  // any gap. Workers still never receive capabilities directly; a Job is simply
  // staffed by a team, and execution routes each Task to the right member.
  const definitions = listBusinessFunctionDefinitions();
  const created = new Set<string>();
  const staffingRefusals: string[] = [];
  for (const proposal of plan.workers) {
    if (!proposal.existing && !created.has(proposal.name)) {
      registerAiWorker(
        proposal.name,
        proposal.archetype
      );
      created.add(proposal.name);
    }
    for (const businessFunctionId of proposal.functionIds) {
      try {
        saveStaffingAssignment({ businessFunctionId, workerName: proposal.name, role: "ai", rationale: proposal.rationale });
      } catch (error) {
        staffingRefusals.push(error instanceof Error ? error.message : String(error));
      }
    }
  }
  for (const approval of plan.humanApprovals) {
    saveStaffingAssignment({ businessFunctionId: approval.functionId, workerName: approval.workerName ?? "", role: "human-approver", rationale: approval.rationale });
  }

  // The approval requirement the operator just agreed to becomes a rule the
  // policy engine evaluates. Recorded as a staffing assignment alone it was
  // consulted only by /function start, so Tasks reaching a Function any other
  // way ran ungoverned.
  const approvalEnterpriseId = plan.humanApprovals
    .map((approval) => definitions.find((definition) => definition.id === approval.functionId)?.enterpriseId)
    .find(Boolean);
  if (approvalEnterpriseId) {
    savePolicyRules(
      mergeStaffingApprovalRules(
        loadPolicyRules(),
        buildStaffingApprovalRules(
          plan.humanApprovals,
          approvalEnterpriseId,
          (functionId) =>
            definitions.find((definition) => definition.id === functionId)?.label ?? functionId
        )
      )
    );
  }

  // Distinct Functions, not assignments. Summing each Worker's functionIds
  // counted the same Function once per Worker put behind it, so staffing six
  // Functions with fifteen Workers announced "put to work on 15 Functions" —
  // a number larger than the number of Functions that exist.
  const staffedFunctionIds = new Set(
    plan.workers.flatMap((worker) => worker.functionIds)
  );
  const assignmentCount = staffedFunctionIds.size;

  // Staffing a Function now starts it.
  //
  // A Function that is not running does not watch Events, so it cannot react to
  // anything another Function finishes — and because directly created Tasks run
  // regardless of operating state, that is invisible. An operator staffed five
  // Functions, watched their Tasks complete, and never learned that no Function
  // had reacted to a single Event all session, because "declared" and "running"
  // look identical until you go looking for the difference.
  //
  // Starting does not grant new authority: a started Function creates Tasks
  // from Events, and each of those still passes the same Governance and
  // approval checks. The approval rules this plan just wrote are in force
  // before anything starts, so work that needs a person still waits for one.
  const startedFunctions: string[] = [];
  for (const functionId of staffedFunctionIds) {
    const definition = definitions.find(
      (candidate) => candidate.id === functionId
    );
    if (!definition || definition.status === "active") continue;
    // Only a Function that actually has an available AI Worker behind it.
    // A missing approver does not hold this back — its Tasks wait visibly
    // under /approvals, which beats a Function that silently never reacts,
    // and the message below already names the Functions still needing one.
    const hasAvailableAiWorker = listStaffingAssignments(definition.id).some(
      (assignment) => {
        const worker = getWorker(assignment.workerName);
        return (
          assignment.role === "ai" &&
          worker?.kind === "ai" &&
          isWorkerAvailableForNewTask(worker)
        );
      }
    );
    if (!hasAvailableAiWorker) continue;
    startRuntimeForBusinessFunction(definition);
    startedFunctions.push(definition.label);
  }
  const firstFunctionId = plan.workers.flatMap((worker) => worker.functionIds)[0];
  const exampleDefinition = firstFunctionId
    ? listBusinessFunctionDefinitions().find((definition) => definition.id === firstFunctionId)
    : undefined;
  const exampleJob = exampleDefinition?.label ?? "<job name>";
  const exampleEnterprise = exampleDefinition
    ? getEnterpriseByIdOrName(exampleDefinition.enterpriseId)?.name ?? "<enterprise>"
    : "<enterprise>";

  const approvalLabel = (functionId: string): string =>
    definitions.find((definition) => definition.id === functionId)?.label ??
    functionId;

  const unassignedApproverFunctions = plan.humanApprovals
    .filter((approval) => !approval.workerName)
    .map((approval) => approvalLabel(approval.functionId));

  const assignedApprovers = plan.humanApprovals
    .filter((approval) => Boolean(approval.workerName))
    .map((approval) => ({
      label: approvalLabel(approval.functionId),
      approver: approval.workerName as string,
    }));

  return [
    ...staffingRefusals.map((body) => ({ actor: "Arturo" as const, label: "Refused", body })),
    {
      actor: "Arturo",
      label: "Staffing applied",
      body: formatStaffingAppliedBody(
        created.size,
        assignmentCount,
        exampleJob,
        exampleEnterprise,
        unassignedApproverFunctions,
        assignedApprovers,
        startedFunctions,
        [...new Set(plan.workers.filter((proposal) => proposal.existing).map((proposal) => proposal.name))]
      ),
    },
    formatStaffingNextSteps(),
  ];
}

/**
 * Formats the "Staffing applied" message, including the next step that tells the
 * operator how to actually give the business work (create a Task).
 *
 * PURE: No side effects.
 */
export function formatStaffingAppliedBody(
  createdCount: number,
  assignmentCount: number,
  exampleJob: string,
  exampleEnterprise: string,
  unassignedApproverFunctions: readonly string[] = [],
  assignedApprovers: readonly {
    readonly label: string;
    readonly approver: string;
  }[] = [],
  startedFunctions: readonly string[] = [],
  reusedWorkers: readonly string[] = []
): string {
  // The review opens by promising "N kinds of work will also need your sign-off
  // — I'll note that at the end". That note only ever appeared when a Function
  // had been left *without* an approver, so the ordinary case promised a list
  // and then said nothing: an operator was never told which work is governed or
  // who Arturo will ask. Naming both is the whole point of the sentence.
  const approverNote =
    assignedApprovers.length > 0
      ? [
          `Work that needs a person's sign-off, and who Arturo will ask:`,
          ...assignedApprovers.map(
            ({ label, approver }) => `  · ${label} — ${approver}`
          ),
          "",
          "That is work reaching outside Arturo — sending an email, running a",
          "command, writing a file. It waits under /approvals until that person",
          "approves it. Analysis and drafting in those Functions just run.",
          "",
        ]
      : [];

  // A Function whose approval requirement was left unassigned cannot have its
  // work approved by anyone yet. Saying "staffed but idle" and steering to
  // /suggest walks the operator into creating Tasks that block with no approver
  // — the exact dead end a walkthrough hit. Surface the gap first, with the fix,
  // before offering the ways to create work.
  // One Function is named outright. A bulleted list of one reads as a fragment
  // after a colon that never gets its list.
  const approverGap =
    unassignedApproverFunctions.length === 1
      ? [
          `${unassignedApproverFunctions[0]} still needs a person who can sign off work and give go-aheads.`,
          "",
          "Add that person with /add-human-worker — it can be you. Once they're on",
          "the team, work waiting for sign-off shows under /approvals.",
          "",
        ]
      : unassignedApproverFunctions.length > 1
        ? [
            `${numberWord(unassignedApproverFunctions.length)} Functions still need a person who can sign off work and give go-aheads:`,
            ...unassignedApproverFunctions.map((label) => `  · ${label}`),
            "",
            "Add that person with /add-human-worker — it can be you. Once they're on",
            "the team, work waiting for sign-off shows under /approvals.",
            "",
          ]
        : [];

  // What is manual is the announcement: a running Function watches for Events,
  // but nothing is published when work finishes until a rule says so, and
  // without that one Function never picks up where another left off.
  const startedNote =
    startedFunctions.length > 0
      ? [
          `${startedFunctions.length === 1 ? startedFunctions[0] : "Each Function"} only does the work you ask for directly. You can change this by entering:`,
          "",
          "/event",
          'and choosing "Announce it automatically whenever work finishes"',
          "",
        ]
      : [];

  const workedOn =
    assignmentCount === 1
      ? exampleJob
      : `${numberWord(assignmentCount)} Functions`;

  // A plan that only assigns Workers the operator already has announced "Zero
  // AI Workers added, and put to work on Trend Research" — true of the count,
  // and read as though nothing had happened. Say who was assigned.
  const reused =
    reusedWorkers.length === 1
      ? reusedWorkers[0]
      : `${reusedWorkers.slice(0, -1).join(", ")} and ${reusedWorkers[reusedWorkers.length - 1]}`;
  const headline =
    reusedWorkers.length === 0
      ? `${capitalisedNumberWord(createdCount)} AI Worker${createdCount === 1 ? "" : "s"} added, and put to work on ${workedOn}.`
      : createdCount === 0
        ? `${reused}, already on your team, ${reusedWorkers.length === 1 ? "is" : "are"} now assigned to ${workedOn}. No new AI Workers were added.`
        : `${capitalisedNumberWord(createdCount)} AI Worker${createdCount === 1 ? "" : "s"} added, and put to work on ${workedOn} alongside ${reused}, already on your team.`;

  return [
    headline,
    "",
    ...approverGap,
    ...approverNote,
    ...startedNote,
  ]
    .join("\n")
    .trimEnd();
}

/** The three ways to give a staffed business work, as its own entry. */
export function formatStaffingNextSteps(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "What to do next:",
    body: [
      "  /suggest    Arturo proposes the first tasks; you pick which to create",
      "  /task       Describe one thing you want done, in plain words",
      "  /schedule   Have the same task happen on a regular day and time",
    ].join("\n"),
  };
}

export function handleUiStartReadyFunctionsCommand(args: readonly string[]): readonly WorkStreamEntry[] {
  if (!args.includes("--ready")) return [{ actor: "Arturo", label: "Usage", body: 'Use /start-functions --ready [--enterprise "<enterprise-name-or-id>"]' }];
  const enterpriseIndex =
    args.indexOf(
      "--enterprise"
    );
  const enterpriseReference =
    enterpriseIndex >= 0
      ? args[enterpriseIndex + 1]
      : undefined;
  const enterprise =
    enterpriseReference
      ? getEnterpriseByIdOrName(
          enterpriseReference
        )
      : undefined;
  if (enterpriseReference && !enterprise) {
    return [
      {
        actor: "Arturo",
        label: "Enterprise not found",
        body: `enterprise not found: ${enterpriseReference}`,
      },
    ];
  }
  const results: WorkStreamEntry[] = [];
  const definitions =
    enterprise
      ? listBusinessFunctionDefinitionsByEnterprise(
          enterprise.id
        )
      : listBusinessFunctionDefinitions();
  for (const definition of definitions) {
    if (definition.status === "active") continue;
    const assignments = listStaffingAssignments(definition.id);
    const aiReady = assignments.some((assignment) => {
      const worker = getWorker(assignment.workerName);
      return assignment.role === "ai" && worker?.kind === "ai" && isWorkerAvailableForNewTask(worker);
    });
    const humanAssignments = assignments.filter((assignment) => assignment.role === "human-approver");
    const humansReady = humanAssignments.every((assignment) => Boolean(assignment.workerName) && getWorker(assignment.workerName)?.kind === "human");
    if (!aiReady || !humansReady) {
      results.push({ actor: "Arturo", label: "Function not ready", body: `${definition.label}: ${!aiReady ? "no available assigned AI worker" : "human approver unavailable"}.` });
      continue;
    }
    const runtime = startRuntimeForBusinessFunction(definition);
    results.push({ actor: "Arturo", label: "Function started", body: `${definition.label} · ${runtime.id}` });
  }
  return results.length ? results : [{ actor: "Arturo", label: "No Functions started", body: "No stopped Functions are currently ready." }];
}
