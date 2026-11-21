import {
  findUiCommandHelp,
  formatPrimaryHelpText,
  getUiCommandGuidance,
  getUiCommandExplanation,
  getUiCommandGuidedPrompt,
  getUiCommandOptionHelp,
  type UiCommandHelp,
} from "./uiCommandHelp";
import { createFullHelpText } from "../repl/helpText";
import { listModelProfiles } from "../llm/modelProfiles";
import { UI_COMMAND_LONG_HELP } from "./uiCommandLongHelp";
import type { WorkStreamEntry } from "./uiState";

/** Formats the curated primary-command overview. */
export function formatUiHelpText(): string {
  return formatPrimaryHelpText();
}

/** Formats detailed help for one primary command. */
export function formatApprovedModelAliasHelp(
  environment: Readonly<Record<string, string | undefined>> = process.env
): readonly string[] {
  try {
    const profiles =
      listModelProfiles(
        environment
      );
    const hasPremiumDefault =
      profiles.some(
        (profile) =>
          profile.alias === "premium-default"
      );

    return [
      "Model selection:",
      "  Which model does this is chosen with /model, and only with /model.",
      "  The choice is remembered across restarts and applies to every",
      "  model-backed command until you run /model again.",
      hasPremiumDefault
        ? "  A premium route is configured and offered there."
        : "  Only local routes are configured; /model will say so.",
      "",
      "Models available to choose in this installation:",
      ...profiles.map(
        (profile) =>
          `  - ${profile.alias} — ${profile.provider}/${profile.model} (${profile.paid ? "external; session budget applies" : "local"})`
      ),
      "  Run /models for the complete choice list.",
      "  Run /model-routing to check external readiness, quota-independent configuration, and calls remaining.",
    ];
  } catch (error) {
    return [
      "Model selection:",
      "  Arturo could not read the approved model configuration.",
      `  ${error instanceof Error ? error.message : String(error)}`,
      "  Correct the model profile configuration, restart Arturo, then run /model-routing.",
    ];
  }
}

/** Formats detailed help for one primary command. */
export function formatUiCommandHelp(
  detail: UiCommandHelp,
  environment: Readonly<Record<string, string | undefined>> = process.env
): string {
  const guidance = getUiCommandGuidance(detail.command);
  const longHelp = UI_COMMAND_LONG_HELP[detail.command];
  const optionHelp =
    getUiCommandOptionHelp(
      detail.command
    );
  const usesModelAliases =
    detail.command === "/next" ||
    detail.command === "/staff";
  // A command that asks for what it needs leads with that form. The switches
  // stay documented underneath, for scripts and headless runs where nothing
  // can answer a prompt.
  const guidedPrompt =
    getUiCommandGuidedPrompt(
      detail.command
    );
  return [
    detail.command,
    "",
    "Purpose:",
    `  ${detail.summary}`,
    "",
    "Explanation:",
    `  ${getUiCommandExplanation(detail)}`,
    "",
    "Prerequisites:",
    ...guidance.prerequisites.map((line) => `  - ${line}`),
    ...(longHelp ? [
      "",
      "When to use it:",
      ...longHelp.whenToUse.map((line) => `  - ${line}`),
    ] : []),
    "",
    "Usage:",
    ...(guidedPrompt
      ? [
          `  ${detail.command}`,
          `    ${guidedPrompt}`,
          "    Nothing is changed until you answer; type cancel at any point to stop.",
          "",
          "  Or give the values directly:",
        ]
      : []),
    ...detail.usage
      // The bare command is the guided form, already described above.
      .filter((line) => !guidedPrompt || line.trim() !== detail.command)
      .map((line) => `  ${line}`),
    ...(optionHelp.length
      ? [
          "",
          guidedPrompt
            ? "Switches (only needed for scripts; the guided form above asks for these):"
            : "Switches and values:",
          ...optionHelp.map(
            (line) =>
              `  - ${line}`
          ),
        ]
      : []),
    ...(usesModelAliases
      ? [
          "",
          ...formatApprovedModelAliasHelp(
            environment
          ),
        ]
      : []),
    "",
    "Examples:",
    ...detail.examples.map((line) => `  ${line}`),
    ...(longHelp ? [
      "",
      "How Arturo handles it:",
      ...longHelp.workflow.map((line, index) => `  ${index + 1}. ${line}`),
    ] : []),
    "",
    "State and side effects:",
    `  ${guidance.effect}`,
    ...(longHelp ? [
      "",
      "How to verify the result:",
      ...longHelp.verification.map((line) => `  - ${line}`),
      "",
      "Common problems and recovery:",
      ...longHelp.failures.map((line) => `  - ${line}`),
      "",
      "Boundaries:",
      ...longHelp.boundaries.map((line) => `  - ${line}`),
    ] : []),
    ...(detail.notes?.length ? [
      "",
      "Important:",
      ...detail.notes.map((line) => `  - ${line}`),
    ] : []),
    ...(guidance.related.length ? [
      "",
      "Related commands:",
      `  ${guidance.related.join(", ")}`,
    ] : []),
  ].join("\n");
}

/** Creates overview or per-command help without executing the target command. */
export function createUiHelpEntry(args: readonly string[] = []): WorkStreamEntry {
  const requested = args[0];
  if (!requested) {
    return {
      actor: "Arturo",
      label: "Help",
      body: formatUiHelpText(),
    };
  }

  if (requested.toLowerCase() === "all") {
    return {
      actor: "Arturo",
      label: "Help · all commands",
      body: createFullHelpText(),
    };
  }

  const detail = findUiCommandHelp(requested);
  if (!detail) {
    return {
      actor: "Arturo",
      label: "Help · command not found",
      body: [
        `No primary terminal command matches: ${requested}`,
        "Use /help to list supported commands.",
        "Legacy and low-level kernel commands are not shown in the primary terminal help.",
      ].join("\n"),
    };
  }

  return {
    actor: "Arturo",
    label: `Help · ${detail.command}`,
    body: formatUiCommandHelp(detail),
  };
}
