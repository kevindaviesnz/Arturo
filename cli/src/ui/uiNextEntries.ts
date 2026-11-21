import {
  listEnterprises,
} from "../enterprise/enterpriseStore";

import {
  createNextGuidanceResultForEnterprise,
  parseNextCommandOptions,
  resolveNextEnterprise,
} from "../repl/nextCommands";

import type {
  BusinessFunctionRecommendation,
} from "../guidance/nextStepAdvisor";

import type {
  WorkStreamEntry,
} from "./uiState";

export type PendingNextConfirmation = {
  readonly enterpriseId: string;
  readonly enterpriseName: string;
  readonly recommendations:
    readonly BusinessFunctionRecommendation[];
};

let pendingNextConfirmation:
  PendingNextConfirmation | undefined;

export function clearPendingNextConfirmation(): void {
  pendingNextConfirmation =
    undefined;
}

export function readPendingNextConfirmation(): PendingNextConfirmation | undefined {
  return pendingNextConfirmation;
}

export function consumePendingNextConfirmation(): PendingNextConfirmation | undefined {
  const pending =
    pendingNextConfirmation;

  clearPendingNextConfirmation();

  return pending;
}

/**
 * Purpose: Handles /next from the terminal UI.
 *
 * Params:
 * - args: Optional Enterprise name or id.
 *
 * Returns:
 * - Work stream entry containing AI-generated guidance or an explanatory error.
 *
 * SIDE EFFECT:
 * - Reads Enterprise state.
 * - Reads Business Function definition state.
 * - Calls the configured LLM provider.
 * - Does not mutate Enterprise state.
 */
/**
 * What the operator said was wrong with the last set of recommendations.
 *
 * /next used to take this as --feedback. It is now asked for at the one moment
 * it is obviously useful — after every recommendation has been skipped — and
 * spent on the next run, so the operator never types a switch to be heard.
 */
let carriedNextFeedback: string | undefined;

/** Remembers what was wrong, for the next /next run to use. */
export function recordNextFeedback(feedback: string): void {
  carriedNextFeedback = feedback.trim() || undefined;
}

/** Reads and clears the carried feedback, so it is used exactly once. */
export function takeNextFeedback(): string | undefined {
  const carried = carriedNextFeedback;
  carriedNextFeedback = undefined;
  return carried;
}

export async function handleUiNextCommand(
  args: readonly string[]
): Promise<WorkStreamEntry> {
  clearPendingNextConfirmation();

  // Model choice moved to /model, which remembers the pick for every command.
  const removedSwitch = args.find(
    (arg) =>
      arg === "--model" ||
      arg === "--retry" ||
      arg === "--compare"
  );
  if (removedSwitch) {
    return {
      actor: "Arturo",
      label: "Choose models with /model",
      body: `${removedSwitch} has been replaced by the /model command. Run /model to choose which AI model Arturo uses, then run /next again.`,
    };
  }

  let options;
  try {
    options = parseNextCommandOptions(args);
  } catch (error) {
    return {
      actor: "Arturo",
      label: "Next step",
      body: error instanceof Error ? error.message : String(error),
    };
  }

  const resolution =
    resolveNextEnterprise(
      options.enterpriseReference
        ? [options.enterpriseReference]
        : [],
      listEnterprises()
    );

  if (!resolution.ok) {
    return {
      actor: "Arturo",
      label: "Next step",
      body: resolution.message,
    };
  }

  try {
    const result =
      await createNextGuidanceResultForEnterprise(
        resolution.enterprise,
        {
          feedback: options.feedback ?? takeNextFeedback(),
        }
      );

    if (result.recommendations.length > 0) {
      pendingNextConfirmation = {
        enterpriseId:
          resolution.enterprise.id,
        enterpriseName:
          resolution.enterprise.name,
        recommendations:
          result.recommendations,
      };
    }

    return {
      actor: "Arturo",
      label:
        "AI-generated Enterprise guidance",
      body: result.guidance,
    };
  } catch (error) {
    return {
      actor: "Arturo",
      label:
        "Enterprise guidance failed",
      body:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}
