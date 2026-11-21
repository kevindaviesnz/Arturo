import { UI_PRIMARY_COMMANDS } from "./uiCommandHelp";

export type WorkStreamEntry = {
  readonly actor: string;
  readonly label: string;
  readonly body: string;
};

export type UiState = {
  readonly input: string;
  readonly commandPaletteOpen: boolean;
  readonly selectedCommandIndex: number;
  readonly workStream: readonly WorkStreamEntry[];
};

export type ParsedUiInput =
  | {
      readonly kind: "empty";
    }
  | {
      readonly kind: "command";
      readonly command: string;
      readonly args: readonly string[];
    }
  | {
      readonly kind: "ask";
      readonly request: string;
    };

export type ContextSummary = {
  readonly workers: number;
  readonly jobs: number;
  readonly waitingApprovals: number;
  readonly businessFunctions: number;
};

export const UI_COMMANDS = UI_PRIMARY_COMMANDS;

export const UI_INPUT_PROMPT =
  "arturo > ";

/** Adds the fixed Arturo shell prompt to editable input text. */
export function addUiInputPrompt(
  value: string
): string {
  return value.startsWith(
    UI_INPUT_PROMPT
  )
    ? value
    : `${UI_INPUT_PROMPT}${value}`;
}

/** Removes the fixed Arturo shell prompt before parsing or persistence. */
export function removeUiInputPrompt(
  value: string
): string {
  return value.startsWith(
    UI_INPUT_PROMPT
  )
    ? value.slice(
        UI_INPUT_PROMPT.length
      )
    : value;
}

/**
 * Purpose: Creates the initial terminal UI state.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - The default immutable UI state.
 *
 * PURE: No side effects.
 */
export function createInitialUiState(): UiState {
  return {
    input: "",
    commandPaletteOpen: false,
    selectedCommandIndex: 0,
    workStream: [
      {
        actor: "Arturo",
        label: "Enterprise OS online",
        body: "Turn a mission into an operating company. Type /overview for the live executive view, /next to design capabilities, or enter a plain-English objective.",
      },
    ],
  };
}

/**
 * Purpose: Opens or closes the command palette.
 *
 * Params:
 * - state: Current UI state.
 *
 * Returns:
 * - Updated UI state with command palette visibility toggled.
 *
 * PURE: No side effects.
 */
export function toggleCommandPalette(
  state: UiState
): UiState {
  return {
    ...state,
    commandPaletteOpen: !state.commandPaletteOpen,
  };
}

/**
 * Purpose: Clears the work stream and replaces it with a single status entry.
 *
 * Params:
 * - state: Current UI state.
 *
 * Returns:
 * - Updated UI state with cleared work stream.
 *
 * PURE: No side effects.
 */
export function clearWorkStream(
  state: UiState
): UiState {
  return {
    ...state,
    workStream: [
      {
        actor: "Arturo",
        label: "Cleared",
        body: "Terminal work stream cleared.",
      },
    ],
  };
}

/**
 * Purpose: Appends an entry to the work stream.
 *
 * Params:
 * - state: Current UI state.
 * - entry: Work stream entry to append.
 *
 * Returns:
 * - Updated UI state containing the new work stream entry.
 *
 * PURE: No side effects.
 */
export function appendWorkStreamEntry(
  state: UiState,
  entry: WorkStreamEntry
): UiState {
  return {
    ...state,
    workStream: [
      ...state.workStream,
      entry,
    ],
  };
}

/**
 * Purpose: Splits terminal input into tokens while preserving quoted phrases.
 *
 * Params:
 * - input: Raw terminal input.
 *
 * Returns:
 * - Parsed input tokens.
 *
 * PURE: No side effects.
 */
export function parseUiInputTokens(
  input: string
): readonly string[] {
  const matches =
    input.matchAll(
      /"([^"]*)"|'([^']*)'|(\S+)/g
    );

  return Array.from(
    matches,
    (match) =>
      match[1] ??
      match[2] ??
      match[3] ??
      ""
  );
}

/**
 * Purpose: Parses bottom-bar UI input into an executable UI intent.
 *
 * Params:
 * - input: Raw user input.
 *
 * Returns:
 * - Parsed input classification.
 *
 * PURE: No side effects.
 */
export function parseUiInput(
  input: string
): ParsedUiInput {
  const trimmed =
    input.trim();

  if (trimmed.length === 0) {
    return {
      kind: "empty",
    };
  }

  if (!trimmed.startsWith("/")) {
    return {
      kind: "ask",
      request: trimmed,
    };
  }

const parts =
  parseUiInputTokens(
    trimmed
  );

  const [
    command = "",
    ...args
  ] = parts;

  return {
    kind: "command",
    command,
    args,
  };
}

/**
 * Purpose: Formats the footer status line.
 *
 * Params:
 * - summary: Current context summary.
 *
 * Returns:
 * - Human-readable status bar text.
 *
 * PURE: No side effects.
 */
export function formatStatusBarText(
  summary: ContextSummary
): string {
  return [
    "{cyan-fg}◆ ARTURO{/cyan-fg}",
    `{gray-fg}${summary.businessFunctions} ongoing functions  ·  ${summary.workers} workers  ·  ${summary.jobs} tasks  ·  ${summary.waitingApprovals} approvals{/gray-fg}`,
    "{gray-fg}enter/ctrl+s run  ctrl+p commands  ↑↓ history  wheel/pgup/pgdn scroll  q quit{/gray-fg}",
  ].join("   ");
}

/**
 * Purpose: Restores trusted internal Blessed colour tags after escaping user text.
 *
 * Params:
 * - text: Escaped work stream text.
 *
 * Returns:
 * - Text with trusted internal gray tags restored.
 *
 * PURE: No side effects.
 */
export function restoreTrustedBlessedTags(
  text: string
): string {
  return text
    .replace(
      /\\\{gray-fg\\\}/g,
      "{gray-fg}"
    )
    .replace(
      /\\\{\/gray-fg\\\}/g,
      "{/gray-fg}"
    );
}

/**
 * Purpose: Formats the command palette command list.
 *
 * Params:
 * - commands: Available command names.
 * - selectedIndex: Selected command index.
 *
 * Returns:
 * - Multi-line command palette text.
 *
 * PURE: No side effects.
 */
export function formatCommandPaletteText(
  commands: readonly string[],
  selectedIndex: number
): string {
  return commands
    .map((command, index) =>
      index === selectedIndex
        ? `{black-fg}{cyan-bg}  ◆ ${command.padEnd(24)}{/cyan-bg}{/black-fg}`
        : `{gray-fg}    ${command}{/gray-fg}`
    )
    .join("\n");
}

/**
 * Purpose: Escapes Blessed tag markers in user-controlled terminal text.
 *
 * Params:
 * - value: Raw display text.
 *
 * Returns:
 * - Text with Blessed tag braces escaped.
 *
 * PURE: No side effects.
 */
export function escapeBlessedTags(
  value: string
): string {
  return value
    .replace(/{/g, "\\{")
    .replace(/}/g, "\\}");
}

/**
 * Purpose: Selects a Blessed colour tag for a work stream entry.
 *
 * Params:
 * - entry: Work stream entry to classify.
 *
 * Returns:
 * - Blessed foreground colour tag name.
 *
 * PURE: No side effects.
 */
export function getWorkStreamEntryColour(
  entry: WorkStreamEntry
): string {
  const label =
    entry.label.toLowerCase();

  if (
    label.includes("error") ||
    label.includes("failed") ||
    label.includes("rejected") ||
    label.includes("not found")
  ) {
    return "red-fg";
  }

  if (
    label.includes("success") ||
    label.includes("created") ||
    label.includes("added") ||
    label.includes("completed") ||
    label.includes("approved")
  ) {
    return "green-fg";
  }

  if (
    label.includes("usage") ||
    label.includes("queued") ||
    label.includes("waiting") ||
    label.includes("pending")
  ) {
    return "yellow-fg";
  }

  if (
    entry.actor.toLowerCase().includes("you")
  ) {
    return "cyan-fg";
  }

  if (
    entry.actor.toLowerCase().includes("planner")
  ) {
    return "magenta-fg";
  }

  if (
    entry.actor.toLowerCase().includes("arturo")
  ) {
    return "cyan-fg";
  }

  return "blue-fg";
}

/** Selects a compact operational marker for a work stream entry. */
export function getWorkStreamEntryMarker(
  entry: WorkStreamEntry
): string {
  const label =
    entry.label.toLowerCase();

  if (
    label.includes("error") ||
    label.includes("failed") ||
    label.includes("rejected") ||
    label.includes("not found")
  ) {
    return "×";
  }

  if (
    label.includes("success") ||
    label.includes("created") ||
    label.includes("added") ||
    label.includes("completed") ||
    label.includes("approved")
  ) {
    return "✓";
  }

  if (
    label.includes("usage") ||
    label.includes("queued") ||
    label.includes("waiting") ||
    label.includes("pending")
  ) {
    return "!";
  }

  if (entry.actor === "You") {
    return "›";
  }

  if (
    entry.actor.toLowerCase().includes("planner")
  ) {
    return "◇";
  }

  return entry.actor.toLowerCase().includes("arturo")
    ? "◆"
    : "•";
}

/**
 * Purpose: Wraps text in a Blessed foreground colour tag.
 *
 * Params:
 * - colour: Blessed foreground colour tag name.
 * - value: Text to colour.
 *
 * Returns:
 * - Blessed-coloured text.
 *
 * PURE: No side effects.
 */
export function formatBlessedColourText(
  colour: string,
  value: string
): string {
  return `{${colour}}${value}{/${colour}}`;
}

/**
 * Purpose: Formats a work stream actor label for terminal display.
 *
 * Params:
 * - actor: Raw actor name.
 *
 * Returns:
 * - Actor label with a prompt marker for user input entries.
 *
 * PURE: No side effects.
 */
export function formatWorkStreamActor(
  actor: string
): string {
  return actor === "You"
    ? "arturo >"
    : actor;
}

/**
 * Purpose: Formats work stream entries for terminal display.
 *
 * Params:
 * - entries: Work stream entries to render.
 *
 * Returns:
 * - Multi-line terminal text with Blessed colour tags.
 *
 * PURE: No side effects.
 */
/**
 * Purpose: Formats work stream entries for terminal display.
 *
 * Params:
 * - entries: Work stream entries to render.
 *
 * Returns:
 * - Multi-line terminal text with Blessed colour tags.
 *
 * PURE: No side effects.
 */
export function formatWorkStreamText(
  entries: readonly WorkStreamEntry[]
): string {
  const escapedText =
    entries
      .map((entry) => {
        const hasHeading =
          entry.actor.trim().length > 0 ||
          entry.label.trim().length > 0;

        if (!hasHeading) {
          return escapeBlessedTags(
            entry.body
          );
        }

        const colour =
          getWorkStreamEntryColour(
            entry
          );

        const marker =
          formatBlessedColourText(
            colour,
            getWorkStreamEntryMarker(
              entry
            )
          );

const escapedBody =
  escapeBlessedTags(
    entry.body
  );

if (
  entry.actor === "You" &&
  escapedBody.trim().length > 0
) {
  return [
    marker,
    formatBlessedColourText(
      colour,
      escapeBlessedTags(
        formatWorkStreamActor(
          entry.actor
        )
      )
    ),
    `{bold}${escapeBlessedTags(
      entry.label
    )}${escapedBody.length > 0 ? ` ${escapedBody}` : ""}{/bold}`,
  ].join(" ");
}

const heading = [
  marker,
  `{bold}${escapeBlessedTags(
    formatWorkStreamActor(
      entry.actor
    )
  )}{/bold}`,
  formatBlessedColourText(
    colour,
    escapeBlessedTags(
      entry.label
    )
  ),
].join(" ");

const indentedBody =
  escapedBody
    .split("\n")
    .map(
      (line) =>
        line.length > 0
          ? `  ${line}`
          : ""
    )
    .join("\n");

return indentedBody.trim().length > 0
  ? [
      heading,
      indentedBody,
    ].join("\n")
  : heading;
      })
      .join("\n\n");

  return restoreTrustedBlessedTags(
    escapedText
  );
}

/**
 * Purpose: Moves the selected command palette index down by one item.
 *
 * Params:
 * - state: Current UI state.
 * - commandCount: Number of commands available.
 *
 * Returns:
 * - Updated UI state with the next selected command index.
 *
 * PURE: No side effects.
 */
export function selectNextCommand(
  state: UiState,
  commandCount: number
): UiState {
  if (commandCount <= 0) {
    return state;
  }

  return {
    ...state,
    selectedCommandIndex:
      (state.selectedCommandIndex + 1) % commandCount,
  };
}

/**
 * Purpose: Moves the selected command palette index up by one item.
 *
 * Params:
 * - state: Current UI state.
 * - commandCount: Number of commands available.
 *
 * Returns:
 * - Updated UI state with the previous selected command index.
 *
 * PURE: No side effects.
 */
export function selectPreviousCommand(
  state: UiState,
  commandCount: number
): UiState {
  if (commandCount <= 0) {
    return state;
  }

  return {
    ...state,
    selectedCommandIndex:
      (state.selectedCommandIndex - 1 + commandCount) % commandCount,
  };
}

/**
 * Purpose: Gets the selected command from the command list.
 *
 * Params:
 * - commands: Available command names.
 * - selectedIndex: Selected command index.
 *
 * Returns:
 * - Selected command, or an empty string when no command exists.
 *
 * PURE: No side effects.
 */
export function getSelectedCommand(
  commands: readonly string[],
  selectedIndex: number
): string {
  return commands[selectedIndex] ?? "";
}
