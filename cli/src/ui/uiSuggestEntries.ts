/**
 * `/suggest` — proposes bounded Tasks for a staffed Function.
 *
 * This closes the gap immediately after `/staff`, where an operator has a
 * working business, no Tasks, and no obvious way to learn what to ask for
 * without reading documentation. Suggestions are advisory until confirmed;
 * accepting one creates a normal Task through the same routing and Governance
 * path as typing `/task create` by hand.
 */

import {
  buildTaskSuggestionPrompt,
  parseTaskSuggestions,
  type TaskSuggestion,
  type TaskSuggestionContext,
} from "../guidance/taskSuggestionAdvisor";
import { generateWithConfiguredLlm } from "../llm/llmClient";
import { resolveNextStepModel as resolveTaskSuggestionModel } from "../guidance/nextStepAdvisor";
import { listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { listStaffingAssignments } from "../staffing/staffingStore";
import { getEnterpriseByIdOrName, listEnterprises } from "../enterprise/enterpriseStore";
import { listWorkers } from "../control/workers";
import type { WorkStreamEntry } from "./uiState";

export type PendingTaskSuggestions = {
  readonly functionLabel: string;
  readonly enterpriseName: string;
  readonly suggestions: readonly TaskSuggestion[];
};

let pendingTaskSuggestions:
  PendingTaskSuggestions | undefined;

export function clearPendingTaskSuggestions(): void {
  pendingTaskSuggestions = undefined;
}

export function readPendingTaskSuggestions():
  PendingTaskSuggestions | undefined {
  return pendingTaskSuggestions;
}

/**
 * Formats suggestions for display, numbered so the operator can accept a
 * subset by number rather than all or nothing.
 *
 * PURE: No side effects.
 */
export function formatTaskSuggestions(
  functionLabel: string,
  suggestions: readonly TaskSuggestion[]
): string {
  const anyNeedsInput =
    suggestions.some(
      (suggestion) => suggestion.requiredInputs.length > 0
    );

  return [
    `Suggested Tasks for ${functionLabel}:`,
    "",
    ...suggestions.flatMap(
      (suggestion, index) => [
        `${index + 1}. ${suggestion.title}${suggestion.recurring ? "  (recurring)" : ""}`,
        `  ${suggestion.outcome}`,
        suggestion.reason
          ? `  Why: ${suggestion.reason}`
          : "",
        suggestion.requiredInputs.length > 0
          ? `  You supply: ${suggestion.requiredInputs.join("; ")}`
          : "",
        "",
      ].filter(Boolean)
    ),
    "These are unverified model suggestions, not checked business advice.",
    "Not happy with them? Run /model to have a different AI model suggest instead.",
    "",
    "Reply with the numbers you want, such as 1,3 — or yes for all of them,",
    "or cancel for none.",
    ...(anyNeedsInput
      ? [
          "",
          'Where a Task says "You supply", Arturo creates it with the wording',
          "shown. To give it the real detail, either write your own version with",
          '/task create "<the same request, with the actual names and facts>"',
          "or attach a file first with /artefact add and pass it with",
          "--input-artefact <id@version>.",
        ]
      : []),
  ].join("\n");
}

/**
 * Parses a confirmation reply into the suggestion indexes to create.
 *
 * Returns undefined when the reply is not a recognised confirmation, so the
 * caller can leave the pending state alone and let other handlers try.
 *
 * PURE: No side effects.
 */
export function parseSuggestionSelection(
  reply: string,
  available: number
): readonly number[] | "none" | "invalid" {
  const normalized =
    reply.trim().toLowerCase();

  // "cancel" stops every other prompt in the product, so an operator reaches
  // for it here too — and it was the one word this prompt did not accept,
  // leaving them typing it repeatedly at a list they wanted to dismiss.
  if (
    normalized === "no" ||
    normalized === "n" ||
    normalized === "cancel"
  ) {
    return "none";
  }

  if (normalized === "yes" || normalized === "y") {
    return Array.from(
      { length: available },
      (_unused, index) => index
    );
  }

  if (!/^\d+(\s*,\s*\d+)*$/.test(normalized)) {
    return "invalid";
  }

  const selected =
    normalized
      .split(",")
      .map((part) => Number(part.trim()) - 1)
      .filter(
        (index) => index >= 0 && index < available
      );

  return selected.length > 0
    ? [...new Set(selected)]
    : "invalid";
}

/**
 * Returns the capability ids held by the Workers staffed to one Function.
 *
 * SIDE EFFECT: Reads staffing and Worker stores.
 */
export function readStaffedCapabilities(
  businessFunctionId: string
): readonly string[] {
  const staffedNames =
    new Set(
      listStaffingAssignments(
        businessFunctionId
      ).map((assignment) => assignment.workerName)
    );

  return [
    ...new Set(
      listWorkers()
        .filter(
          (worker) => staffedNames.has(worker.name)
        )
        .flatMap(
          (worker) => worker.capabilities ?? []
        )
    ),
  ].sort();
}

/**
 * Lists the Function labels `/suggest` could act on, filtered to an Enterprise
 * when one is named. Used by the guided picker so a bare `/suggest` with more
 * than one Function offers a numbered choice instead of copy-paste flag lines.
 *
 * SIDE EFFECT: Reads the Enterprise and Function stores.
 */
export function suggestFunctionChoices(
  enterpriseReference: string | undefined
): readonly string[] {
  const enterprise =
    enterpriseReference
      ? getEnterpriseByIdOrName(enterpriseReference)
      : undefined;

  return listBusinessFunctionDefinitions()
    .filter(
      (definition) =>
        !enterprise || definition.enterpriseId === enterprise.id
    )
    .map((definition) => definition.label);
}

function resolveSuggestFunction(
  functionReference: string | undefined,
  enterpriseReference: string | undefined
):
  | { readonly ok: true; readonly definition: ReturnType<typeof listBusinessFunctionDefinitions>[number] }
  | { readonly ok: false; readonly message: string } {
  const enterprise =
    enterpriseReference
      ? getEnterpriseByIdOrName(
          enterpriseReference
        )
      : undefined;

  if (enterpriseReference && !enterprise) {
    return {
      ok: false,
      message: `No Enterprise matches "${enterpriseReference}".`,
    };
  }

  const candidates =
    listBusinessFunctionDefinitions()
      .filter(
        (definition) =>
          !enterprise ||
          definition.enterpriseId === enterprise.id
      );

  if (functionReference) {
    const match =
      candidates.find(
        (definition) =>
          definition.label.toLowerCase() === functionReference.toLowerCase() ||
          definition.id === functionReference
      );

    return match
      ? { ok: true, definition: match }
      : {
          ok: false,
          message: `No Function matches "${functionReference}". Run /functions to list them.`,
        };
  }

  if (candidates.length === 1) {
    return { ok: true, definition: candidates[0] };
  }

  return {
    ok: false,
    message: candidates.length === 0
      ? "No Functions exist yet. Run /next to design some, then /staff to staff them."
      : [
          "Which Function should Arturo suggest work for? Run /suggest on its own",
          "to pick one from a list, or name it:",
          "",
          ...candidates.map(
            (definition) => `  /suggest --function "${definition.label}"`
          ),
        ].join("\n"),
  };
}

/**
 * Handles `/suggest` and stores the proposals for confirmation.
 *
 * SIDE EFFECT:
 * - Reads Enterprise, Function, staffing, and Worker state.
 * - Calls the configured LLM provider.
 * - Stores pending suggestions awaiting confirmation.
 */
export async function handleUiSuggestCommand(
  functionReference: string | undefined,
  enterpriseReference: string | undefined
): Promise<WorkStreamEntry> {
  const resolved =
    resolveSuggestFunction(
      functionReference,
      enterpriseReference
    );

  if (!resolved.ok) {
    return {
      actor: "Arturo",
      label: "Suggestion unavailable",
      body: resolved.message,
    };
  }

  const { definition } = resolved;
  const enterprise =
    getEnterpriseByIdOrName(
      definition.enterpriseId
    );
  const context: TaskSuggestionContext = {
    enterpriseName: enterprise?.name ?? "(unknown Enterprise)",
    mission: enterprise?.mission || enterprise?.description || "",
    functionLabel: definition.label,
    functionObjective: definition.objective,
    staffedCapabilities:
      readStaffedCapabilities(
        definition.id
      ),
  };

  // A single malformed reply used to end the command. /staff has always
  // retried the same class of failure three times; a walkthrough lost /suggest
  // to one stray character after the closing brace, and was told to check that
  // the model provider was running — which it was.
  let lastError: unknown;
  for (let attempt = 1; attempt <= SUGGESTION_ATTEMPTS; attempt += 1) {
    try {
      const { response } =
        await generateWithConfiguredLlm({
          model: resolveTaskSuggestionModel(),
          prompt: buildTaskSuggestionPrompt(
            context
          ),
        });
      const suggestions =
        parseTaskSuggestions(
          response,
          context.staffedCapabilities
        );

      pendingTaskSuggestions = {
        functionLabel: definition.label,
        enterpriseName: context.enterpriseName,
        suggestions,
      };

      return {
        actor: "Arturo",
        label: "Suggested Tasks",
        body: formatTaskSuggestions(
          definition.label,
          suggestions
        ),
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    actor: "Arturo",
    label: "Suggestion failed",
    body: formatSuggestionFailureBody(
      lastError,
      definition.label
    ),
  };
}

/** How many times a malformed suggestion reply is re-requested. */
export const SUGGESTION_ATTEMPTS = 3;

/**
 * Explains a suggestion failure without guessing at its cause.
 *
 * PURE: No side effects.
 */
export function formatSuggestionFailureBody(
  error: unknown,
  functionLabel: string
): string {
  const message =
    error instanceof Error ? error.message : String(error);
  const modelUnreachable =
    /ECONNREFUSED|fetch failed|ENOTFOUND|socket hang up|timed out/i.test(message);

  return [
    message,
    "",
    modelUnreachable
      ? "Arturo could not reach the model provider. Check that it is running, then try again."
      : `The model replied ${SUGGESTION_ATTEMPTS} times without usable suggestions. Nothing was created.`,
    "",
    ...(modelUnreachable
      ? []
      : [
          "You can ask for the work directly instead:",
          `  /task create "<what you want done>" --function "${functionLabel}"`,
        ]),
  ].join("\n");
}

/** Enterprise count used to decide whether --enterprise must be passed on. */
function shouldQualifyEnterprise(): boolean {
  return listEnterprises().length > 1;
}

/**
 * Applies a confirmation reply to pending suggestions.
 *
 * Returns undefined when nothing is pending, so ordinary input still falls
 * through to the other confirmation handlers.
 *
 * SIDE EFFECT:
 * - Clears pending suggestions.
 * - Creates Tasks through the supplied creator.
 */
export function handleUiSuggestConfirmation(
  reply: string,
  createTask: (args: readonly string[]) => WorkStreamEntry
): readonly WorkStreamEntry[] | undefined {
  const pending = pendingTaskSuggestions;

  if (!pending) {
    return undefined;
  }

  const selection =
    parseSuggestionSelection(
      reply,
      pending.suggestions.length
    );

  if (selection === "invalid") {
    return [{
      actor: "Arturo",
      label: "Confirmation required",
      body: "Reply with the numbers you want, such as 1,3 — or yes for all, or cancel for none.",
    }];
  }

  if (selection === "none") {
    clearPendingTaskSuggestions();

    return [{
      actor: "Arturo",
      label: "No Tasks created",
      body: "The suggestions were discarded. Nothing was created.",
    }];
  }

  clearPendingTaskSuggestions();

  return selection.map(
    (index) => {
      const suggestion =
        pending.suggestions[index];

      return createTask([
        suggestion.outcome,
        "--function",
        pending.functionLabel,
        ...(shouldQualifyEnterprise()
          ? ["--enterprise", pending.enterpriseName]
          : []),
      ]);
    }
  );
}
