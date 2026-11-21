import {
  isAffirmative,
  isNegative,
} from "./uiShortReply";

import {
  describeNextSetupStep,
  isReadyForWork,
  readSetupState,
  type SetupState,
} from "./uiSetupProgress";

import type {
  WorkStreamEntry,
} from "./uiState";

/**
 * What Arturo says to plain text that no confirmation, advise session, or
 * Worker chat claimed.
 *
 * The generic "enter yes/no when Arturo requests confirmation" is exactly wrong
 * for the case that produces it most often: Arturo *did* request confirmation,
 * the operator answered "yes", and the offer had been lost. Pending
 * confirmations live in memory, so quitting between the question and the answer
 * silently discards it, and the reply that comes back reads as though the
 * operator imagined being asked.
 */

/**
 * Names the command that would make the lost offer again.
 *
 * Setup steps come first when the installation is not finished; a staffed
 * Enterprise is instead offered the ways to give it work.
 *
 * PURE: No side effects.
 */
export function describeConfirmationRecovery(
  state: SetupState
): readonly string[] {
  const setupStep =
    describeNextSetupStep(
      state
    );

  return setupStep.length > 0
    ? setupStep
    : [
        "  /suggest    Arturo proposes work the Functions could do",
        "  /overview   Where the Enterprise stands right now",
      ];
}

/**
 * Builds the reply to unclaimed plain text.
 *
 * PURE: No side effects.
 */
export function formatUnhandledInputEntry(
  input: string,
  state: SetupState
): WorkStreamEntry {
  const looksLikeAnAnswer =
    isAffirmative(input) ||
    isNegative(input);

  if (looksLikeAnAnswer) {
    return {
      actor: "Arturo",
      label: "Nothing to confirm",
      body: [
        "Nothing is waiting for a yes or no right now.",
        "A question Arturo asked earlier is not kept when Arturo restarts, so",
        "an answer given after a restart has nothing to attach to. Nothing was",
        "changed, and the offer can be made again:",
        "",
        ...describeConfirmationRecovery(state),
      ].join("\n"),
    };
  }

  // A first-time operator's opening move is often a plain-English description of
  // their business, not a command. When the installation is not yet ready for
  // work, answering with the bare `/ask` usage strands them: it names a command
  // that itself refuses until an Enterprise exists. Point at the setup step the
  // sentence is really asking for instead.
  if (!isReadyForWork(state)) {
    return {
      actor: "Arturo",
      label: "Getting started",
      body: [
        "That reads like a description of your business rather than a command,",
        "and there is nothing set up yet to act on it. Here is the next step:",
        "",
        ...describeNextSetupStep(state),
        "",
        "Nothing was created, and no model was called.",
      ].join("\n"),
    };
  }

  // The Enterprise is staffed, but the input was neither a command nor a
  // yes/no. A confused operator often types a plain question here ("what do I
  // do now?", "how do I approve a task?"). The old one-line /ask usage was a
  // dead end; point them at the places that answer those questions instead.
  return {
    actor: "Arturo",
    label: "Not a command",
    body: [
      "Arturo didn't recognise that. Commands start with a slash (/).",
      "A few that answer most questions:",
      "",
      "  /overview     where your business stands and what needs your attention",
      "  /tasks        the work in progress, and what each one is waiting on",
      "  /approvals    anything waiting for a person to approve",
      "  /help         the full list of commands",
      "",
      'To describe a one-off job in plain words, use /ask "<what you want done>".',
    ].join("\n"),
  };
}

/**
 * Reads the current Enterprise shape and builds the reply to unclaimed input.
 *
 * SIDE EFFECT: Reads the Enterprise, Function, and Worker stores.
 */
export function createUnhandledInputEntry(
  input: string
): WorkStreamEntry {
  return formatUnhandledInputEntry(
    input,
    readSetupState()
  );
}
