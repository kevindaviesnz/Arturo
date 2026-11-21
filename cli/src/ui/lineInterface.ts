import "dotenv/config";
import readline from "node:readline";
import { type WorkStreamEntry } from "./uiState";
import { classifyUiLine, isGuidedFlowOpen, routeUiLine } from "./uiLineRouter";
import { BOT_USAGE, parseBotArguments, type BotRunMode } from "../bot/botArgs";
import { createReadlineBotTerminal } from "../bot/botTerminal";
import { startBotRun } from "../bot/startBotRun";
import { appendCommandHistory, loadCommandHistory } from "./uiCommandHistory";
import { startWorkerRuntime } from "../runtime/workerRuntime";
import { startBusinessFunctionRuntimeCoordinator } from "../runtime/businessFunctionRuntimeCoordinator";
import { startEventScheduleRuntime } from "../scheduling/eventScheduleRuntime";
import { startWatchedFolderRuntime } from "../intake/watchedFolderRuntime";
import { clearBackgroundOutputRepl, registerBackgroundOutputRepl } from "../repl/backgroundOutput";
import { listEnterprises } from "../enterprise/enterpriseStore";
import { SUPPLIED_ARTEFACTS_END } from "../artefacts/artefactStore";
import { describeActivity, startActivityIndicator } from "./uiActivityIndicator";
import { isInteractiveSession } from "../core/interactivity";

// Only the markup the shared formatters actually emit. Matching anything in
// braces also deleted every JSON object from a supplied document on its way to
// the screen: a real Task detail showed `"popularity": ,` and empty example
// lists, as though the evidence itself had holes in it.
const ANSI_TAG = /\{\/?(?:bold|underline|inverse|blink|[a-z]+-(?:fg|bg))\}|\{\/\}/g;
const useColour = Boolean(process.stdout.isTTY && !process.env.NO_COLOR);

export type LineInterfaceTheme =
  | "dark"
  | "light"
  | "adaptive";

export type LineInterfacePalette = {
  readonly reset: string;
  readonly bold: string;
  readonly dim: string;
  readonly lime: string;
  readonly mint: string;
  readonly cyan: string;
  readonly text: string;
  readonly muted: string;
  readonly border: string;
  readonly red: string;
};

/**
 * Selects a terminal theme from an explicit override or COLORFGBG.
 * Adaptive colours remain legible when the terminal does not report its
 * background, which is common in macOS Terminal.
 */
export function resolveLineInterfaceTheme(
  environment: NodeJS.ProcessEnv = process.env
): LineInterfaceTheme {
  const requested =
    environment.ARTURO_TERMINAL_THEME
      ?.trim()
      .toLowerCase();

  if (
    requested === "light" ||
    requested === "dark"
  ) {
    return requested;
  }

  const background =
    environment.COLORFGBG
      ?.split(";")
      .at(-1);

  if (
    background &&
    /^\d+$/.test(
      background
    )
  ) {
    return Number(
      background
    ) >= 8
      ? "light"
      : "dark";
  }

  return "adaptive";
}

/** Creates a contrast-safe ANSI palette for dark, light, or unknown themes. */
export function createLineInterfacePalette(
  theme: LineInterfaceTheme
): LineInterfacePalette {
  const shared = {
    reset: "\u001b[0m",
    bold: "\u001b[1m",
    dim: "\u001b[2m",
    // Default foreground follows the user's terminal theme.
    text: "\u001b[39m",
    muted: "\u001b[2m\u001b[39m",
    border: "\u001b[2m\u001b[39m",
  };

  if (theme === "dark") {
    return {
      ...shared,
      lime: "\u001b[38;2;184;255;88m",
      mint: "\u001b[38;2;94;239;190m",
      cyan: "\u001b[38;2;103;220;229m",
      red: "\u001b[38;2;255;107;125m",
    };
  }

  if (theme === "light") {
    return {
      ...shared,
      lime: "\u001b[38;2;79;101;0m",
      mint: "\u001b[38;2;0;105;87m",
      cyan: "\u001b[38;2;0;101;112m",
      red: "\u001b[38;2;180;35;59m",
    };
  }

  return {
    ...shared,
    // Mid-luminance accents retain useful contrast on either background.
    lime: "\u001b[38;2;112;121;0m",
    mint: "\u001b[38;2;0;132;109m",
    cyan: "\u001b[38;2;0;128;137m",
    red: "\u001b[38;2;190;70;87m",
  };
}

const ansi =
  createLineInterfacePalette(
    resolveLineInterfaceTheme()
  );

function colour(value: string, ...codes: string[]): string {
  return useColour ? `${codes.join("")}${value}${ansi.reset}` : value;
}

/** Wraps ANSI prompt sequences so readline calculates cursor width correctly. */
function promptColour(value: string, ...codes: string[]): string {
  return useColour ? `\u0001${codes.join("")}\u0002${value}\u0001${ansi.reset}\u0002` : value;
}

/** Applies a colour to text the operator types after the readline prompt. */
function promptInputColour(...codes: string[]): string {
  return useColour
    ? `\u0001${codes.join("")}\u0002`
    : "";
}

/** Removes Blessed markup retained by a small number of shared formatters. */
export function formatLineInterfaceText(value: string): string {
  return value.replace(ANSI_TAG, "");
}

/**
 * Formats the scrollback-safe Arturo terminal header.
 *
 * The header is borderless: a box drawn to the terminal width fragments the
 * moment the window is resized or the output is copied, and the frame added
 * nothing the wordmark was not already saying.
 */
export function formatLineInterfaceBanner(
  terminalColumns = process.stdout.columns ?? 106
): string {
  const width =
    Math.max(
      22,
      Math.min(
        104,
        terminalColumns
      )
    );
  const fit = (
    full: string,
    short: string
  ): string =>
    full.length + 2 <= width
      ? `  ${full}`
      : `  ${short}`;

  return [
    "",
    fit(
      "◆  A  R  T  U  R  O",
      "◆ ARTURO"
    ),
    fit(
      "THE OPERATING SYSTEM FOR AI-NATIVE COMPANIES",
      "AI-NATIVE COMPANY OS"
    ),
    "",
    `  ${"─".repeat(Math.max(8, Math.min(48, width - 4)))}`,
    fit(
      "READY · /overview to begin · /help for commands",
      "READY · /help"
    ),
    "",
  ].join("\n");
}

/** Formats one result as a compact, scrollback-friendly Arturo response. */
export function formatLineInterfaceEntry(entry: WorkStreamEntry): string {
  const label = entry.label.trim() || "Task detail";
  const isFailure = /failed|error|not found|unknown|unsupported|denied|rejected/i.test(label);
  const marker = isFailure ? "×" : "◆";
  return [
    `${marker} ${formatLineInterfaceText(label)}`,
    formatLineInterfaceText(entry.body),
  ].filter(Boolean).join("\n");
}

function renderBanner(): string {
  return formatLineInterfaceBanner()
    .split("\n")
    .map((line) => {
      if (line.includes("A  R  T  U  R  O")) {
        return colour(line, ansi.bold, ansi.lime);
      }

      if (line.includes("READY ·")) {
        return colour(line, ansi.bold, ansi.mint);
      }

      if (line.includes("OPERATING SYSTEM")) {
        return colour(line, ansi.muted);
      }

      return colour(line, ansi.border);
    })
    .join("\n");
}

/**
 * Returns a getting-started hint shown at launch when no Enterprise exists yet,
 * or undefined when there is nothing to prompt.
 *
 * PURE: No side effects.
 */
export function formatEmptyEnterpriseHint(
  enterpriseCount: number
): string | undefined {
  if (enterpriseCount > 0) {
    return undefined;
  }

  return 'Tip: to get started, enter /enterprise';
}

function normalizeHeadingText(
  value: string
): string {
  return value
    .replace(
      /^[◆×✓!]\s*/,
      ""
    )
    .replace(
      /[.:]+$/,
      ""
    )
    .trim()
    .toLowerCase();
}

function prepareBodyLines(
  label: string,
  body: string
): string[] {
  const lines =
    body.split("\n");
  const firstContentIndex =
    lines.findIndex(
      (line) => line.trim().length > 0
    );

  if (
    firstContentIndex >= 0 &&
    normalizeHeadingText(
      lines[firstContentIndex]
    ) === normalizeHeadingText(
      label
    )
  ) {
    lines.splice(
      firstContentIndex,
      1
    );

    if (
      lines[firstContentIndex]?.trim().length === 0
    ) {
      lines.splice(
        firstContentIndex,
        1
      );
    }
  }

  for (
    let index = 0;
    index < lines.length - 1;
    index += 1
  ) {
    const numberOnly =
      lines[index].match(
        /^\s*(\d+)\.\s*$/
      );
    const followingName =
      lines[index + 1].match(
        /^\s{2}(\S.*)$/
      );

    if (
      numberOnly &&
      followingName &&
      !followingName[1].includes(":")
    ) {
      lines.splice(
        index,
        2,
        `${numberOnly[1]}. ${followingName[1]}`
      );
    }
  }

  while (
    lines[0]?.trim().length === 0
  ) {
    lines.shift();
  }

  while (
    lines.at(-1)?.trim().length === 0
  ) {
    lines.pop();
  }

  return lines;
}

function renderInlineText(
  value: string,
  ...baseCodes: string[]
): string {
  const parts =
    value.split(
      /(\*\*[^*]+\*\*|`[^`]+`)/
    );

  return parts
    .map((part) => {
      if (
        part.startsWith("**") &&
        part.endsWith("**")
      ) {
        return colour(
          part.slice(
            2,
            -2
          ),
          ansi.bold,
          ansi.text
        );
      }

      if (
        part.startsWith("`") &&
        part.endsWith("`")
      ) {
        return colour(
          part.slice(
            1,
            -1
          ),
          ansi.mint
        );
      }

      return colour(
        part,
        ...baseCodes
      );
    })
    .join("");
}

function normalizeBodyIndent(
  value: string
): string {
  return value.length <= 2
    ? ""
    : value;
}

function capitalizeLabel(
  value: string
): string {
  return value.length > 0
    ? `${value[0].toUpperCase()}${value.slice(1)}`
    : value;
}

/** Smallest value column, so short-labelled blocks still read as a table. */
const MIN_VALUE_COLUMN = 14;

/**
 * Matches a "Label: value" body line, capturing indent, label, and value.
 *
 * The label may not contain an em dash. A record label never does, but prose
 * joined with one does, and the pattern takes the *first* colon on the line:
 * a published Event's message reads
 * `Safety review — source: Product Safety — enterprise: Ethical Toys`, whose
 * first colon made "Safety review — source" the label. On screen that lost its
 * colon and column-aligned the rest, so the Timeline showed
 * "Safety review — source  Product Safety — enterprise: Ethical Toys" — one
 * separator eaten, the other left, and the sentence turned into a record it
 * is not. Bullets and numbered lines are already excluded for this reason.
 */
const KEY_VALUE_LINE = /^(\s*)([^:\n—]{1,32}):\s+(.*)$/;

/** Matches a "1. item" body line, capturing indent, index, and text. */
const NUMBERED_LINE = /^(\s*)(\d+)\.\s+(.+)$/;

/**
 * Headings whose value is the operator's own prose, printed on the next line.
 *
 * Emitted by the Human Task views in `repl/humanTaskCommands.ts`. Everything
 * under one of these until the next blank line was typed by a person, so the
 * renderer must show it back exactly.
 */
const QUOTED_FIELD_HEADING = new Set([
  "Purpose:",
  "Instructions:",
  "Completion evidence:",
  "Notes:",
  "Revision instructions:",
  "Specialisation:",
]);

/**
 * The heading over a source Task's result, matched by prefix.
 *
 * It names the Task it came from, so it cannot be a fixed string. What follows
 * is an AI Worker's output being handed to a person to act on — a pick list
 * whose "Box Size: 12 x 10 x 8" must reach them as written, not restyled into
 * an aligned record row.
 */
const QUOTED_FIELD_HEADING_PREFIX = "Work to act on (from ";

/**
 * Marks the lines of a body that are quoted file contents, not Arturo's words.
 *
 * A Supplied Artefacts block carries the bytes of a hashed file, and the body
 * renderer rewrites anything shaped like `Label: value` into an aligned row
 * with the colon removed. Applied to a document, that means the text on screen
 * is not the text on disk — printed directly beneath "Integrity verified — The
 * local file matches the recorded SHA-256 hash". A reader comparing the two
 * would find differences with nothing to explain them.
 *
 * The shape is the one `formatArtefactContextForWorker` emits: inside the
 * block, a line reading exactly `Content` opens the quoted bytes, and they run
 * to the `---` before the next Artefact or to the block's own end marker. A
 * Task stored before that marker existed simply quotes to the end of the body,
 * which is the safe direction to be wrong in — quoting Arturo's own line costs
 * an alignment, restyling a document misrepresents evidence.
 *
 * PURE: No side effects.
 */
export function verbatimBodyLines(
  lines: readonly string[]
): readonly boolean[] {
  const verbatim: boolean[] = [];
  let inBlock = false;
  let inContent = false;
  let inQuotedField = false;
  let inQuotedToEnd = false;

  for (const line of lines) {
    const text = line.trim();

    // A field whose value is the operator's own sentence, printed on the line
    // after its heading. The renderer treated "Examine the instrument in
    // person: the grain, the varnish…" as a label and a value and deleted the
    // colon, so the instructions on screen were not the instructions typed —
    // and /human-tasks, which renders them elsewhere, disagreed. Same hazard
    // this function already guards for Artefact bytes, one heading further on.
    if (!inBlock && !inQuotedField && QUOTED_FIELD_HEADING.has(text)) {
      inQuotedField = true;
      verbatim.push(false);
      continue;
    }

    // A source Task's result runs to the end of the body rather than to the
    // next blank line, because a Worker's output is full of blank lines and
    // the first one would end the quoting a paragraph in. It is emitted last
    // for exactly that reason.
    if (!inBlock && !inQuotedField && text.startsWith(QUOTED_FIELD_HEADING_PREFIX)) {
      inQuotedToEnd = true;
      verbatim.push(false);
      continue;
    }

    if (inQuotedToEnd) {
      verbatim.push(true);
      continue;
    }

    if (inQuotedField) {
      // The value runs to the blank line that closes the field.
      if (text.length === 0) {
        inQuotedField = false;
        verbatim.push(false);
        continue;
      }
      verbatim.push(true);
      continue;
    }

    if (!inBlock) {
      inBlock = text === "Supplied Artefacts";
      verbatim.push(false);
      continue;
    }

    if (inContent) {
      // "---" separates one Artefact from the next; the end marker closes the
      // block. Everything else, blank lines included, is the file.
      if (text === "---" || text === SUPPLIED_ARTEFACTS_END) {
        inContent = false;
        if (text === SUPPLIED_ARTEFACTS_END) inBlock = false;
        verbatim.push(false);
        continue;
      }
      verbatim.push(true);
      continue;
    }

    if (text === SUPPLIED_ARTEFACTS_END) {
      inBlock = false;
      verbatim.push(false);
      continue;
    }

    // Exactly "Content:" opens the bytes. "Content: not included" is a record
    // about a file that was never quoted — a PDF, an image, a remote URI — and
    // must not open anything.
    inContent = text === "Content:";
    verbatim.push(false);
  }

  return verbatim;
}

/**
 * Returns the column at which values should start for one entry body.
 *
 * Aligning across the whole body — rather than padding each line in isolation —
 * is what keeps a block's values in one straight column even when its labels
 * differ widely in length.
 *
 * Quoted file contents are excluded: a document's own `Label: value` lines are
 * not Arturo's records, and letting them set the gutter widened every real row
 * to fit words out of somebody else's file.
 *
 * PURE: No side effects.
 */
export function computeBodyValueColumn(
  lines: readonly string[],
  verbatim: readonly boolean[] = verbatimBodyLines(lines)
): number {
  const labelWidths =
    lines.flatMap(
      (line, index) => {
        if (verbatim[index]) return [];
        const keyValue =
          line.match(
            KEY_VALUE_LINE
          );

        if (keyValue && keyValue[3].length > 0) {
          return [keyValue[2].trim().length];
        }

        return line.match(
          NUMBERED_LINE
        )
          ? [2]
          : [];
      }
    );

  if (labelWidths.length === 0) {
    return MIN_VALUE_COLUMN;
  }

  // The label regex bounds labels at 32 characters, so the widest possible
  // gutter stays well inside a standard terminal.
  return Math.max(
    MIN_VALUE_COLUMN,
    Math.max(
      ...labelWidths
    ) + 2
  );
}

function renderBodyLine(
  line: string,
  valueColumn: number = MIN_VALUE_COLUMN,
  verbatim = false
): string {
  // Byte-for-byte, including its own indentation: this is the document whose
  // hash was just verified, and every branch below would rewrite it.
  if (verbatim) {
    return colour(
      line,
      ansi.text
    );
  }

  const markdownHeading =
    line.match(
      /^(\s*)\*\*(.+?)\*\*\s*$/
    );

  if (markdownHeading) {
    return [
      normalizeBodyIndent(
        markdownHeading[1]
      ),
      colour(
        markdownHeading[2].replace(
          /:$/,
          ""
        ),
        ansi.bold,
        ansi.cyan
      ),
    ].join("");
  }

  const bullet =
    line.match(
      /^(\s*)[-*]\s+(.+)$/
    );

  if (bullet) {
    return [
      normalizeBodyIndent(
        bullet[1]
      ),
      colour(
        "–",
        ansi.muted
      ),
      "  ",
      renderInlineText(
        bullet[2],
        ansi.text
      ),
    ].join("");
  }

  // Checked before the key/value branch: a list item that happens to contain a
  // colon is prose, not a record, and column-aligning it destroys the list.
  // The number the writer used is preserved rather than renumbered — model
  // output is quoted, not restyled.
  const numbered =
    line.match(
      NUMBERED_LINE
    );

  if (numbered) {
    return [
      normalizeBodyIndent(
        numbered[1]
      ),
      colour(
        `${numbered[2]}.`,
        ansi.muted
      ),
      " ",
      renderInlineText(
        numbered[3],
        ansi.bold,
        ansi.text
      ),
    ].join("");
  }

  const keyValue =
    line.match(
      KEY_VALUE_LINE
    );

  if (keyValue && keyValue[3].length > 0) {
    const indent =
      normalizeBodyIndent(
        keyValue[1]
      );
    const label =
      capitalizeLabel(
        keyValue[2].trim()
      );
    const gap =
      " ".repeat(
        Math.max(
          2,
          valueColumn - label.length
        )
      );

    return [
      indent,
      colour(
        label,
        ansi.muted
      ),
      gap,
      renderInlineText(
        keyValue[3],
        ansi.bold,
        ansi.text
      ),
    ].join("");
  }

  if (
    /^\s*ID\s{2,}/i.test(
      line
    )
  ) {
    return colour(
      line.trimStart(),
      ansi.muted
    );
  }

  const tableRow =
    line.match(
      /^\s*(\S+)(\s{2,}.+)$/
    );

  if (tableRow) {
    return [
      colour(
        tableRow[1],
        ansi.muted
      ),
      renderInlineText(
        tableRow[2],
        ansi.bold,
        ansi.text
      ),
    ].join("");
  }

  const sectionLabel =
    line.match(
      /^(\s*)([^:]{1,48}):\s*$/
    );

  if (sectionLabel) {
    return [
      normalizeBodyIndent(
        sectionLabel[1]
      ),
      colour(
        sectionLabel[2],
        ansi.bold,
        ansi.muted
      ),
    ].join("");
  }

  return renderInlineText(
    line,
    ansi.text
  );
}

/** Formats one entry exactly as it appears in terminal scrollback. */
export function formatLineInterfaceDisplayEntry(
  entry: WorkStreamEntry
): string {
  const plain = formatLineInterfaceEntry(entry);
  const [heading] = plain.split("\n");
  const body =
    prepareBodyLines(
      entry.label.trim() || "Task detail",
      formatLineInterfaceText(
        entry.body
      )
    );
  const failed = heading.startsWith("×");
  const verbatim =
    verbatimBodyLines(
      body
    );
  const valueColumn =
    computeBodyValueColumn(
      body,
      verbatim
    );
  return [
    colour(heading, ansi.bold, failed ? ansi.red : ansi.cyan),
    ...body.map(
      (line, index) => renderBodyLine(
        line,
        valueColumn,
        verbatim[index]
      )
    ),
  ].join("\n");
}

/** Runs the native-scrollback Arturo interface. */
export type LineInterfaceOptions = {
  /** Supplies the input instead of a person. */
  readonly bot?: BotRunMode;
};

export function startLineInterface(
  options: LineInterfaceOptions = {}
): void {
  startWorkerRuntime();
  startBusinessFunctionRuntimeCoordinator();
  startEventScheduleRuntime();
  startWatchedFolderRuntime();

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: "arturo › ",
    historySize: 500,
    removeHistoryDuplicates: true,
  });
  (rl as readline.Interface & { history: string[] }).history = [
    ...loadCommandHistory(),
  ].reverse();
  let closed = false;
  // The prompt carried a counter line — Functions, Workers, Tasks, Workflow
  // runs, Humans, Human tasks, Approvals, model, session tokens — above every
  // single turn. It repeated whether or not anything had changed, and none of
  // it answers a question the operator asked; /overview does, on request.
  const refreshPrompt = (): void => {
    rl.setPrompt(
      `\n${promptColour("arturo", ansi.bold, ansi.mint)} ${promptColour("›", ansi.bold, ansi.mint)} ${promptInputColour(ansi.text)}`
    );
  };
  refreshPrompt();
  registerBackgroundOutputRepl(rl, process.stdout);

  if (useColour) {
    process.stdout.write("\u001b]0;Arturo · Native Terminal\u0007");
  }
  process.stdout.write(`${renderBanner()}\n`);
  const startupHint = formatEmptyEnterpriseHint(listEnterprises().length);
  if (startupHint) {
    process.stdout.write(`\n${colour(startupHint, ansi.mint)}\n`);
  }
  const botMode =
    options.bot && options.bot.kind !== "human" ? options.bot : undefined;
  const botTerminal = botMode
    ? createReadlineBotTerminal({
        rl,
        output: process.stdout,
        formatEntry: formatLineInterfaceDisplayEntry,
        pacing: botMode.pacing,
      })
    : undefined;

  rl.prompt();

  if (botMode && botTerminal) {
    // Any keypress pauses the run where it stands, so the operator can take over
    // without racing it. Space is the way back, and pausing is the same key —
    // rl.write emits no stdin keypress events, so everything seen here is a
    // person's.
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", (_character, key: { name?: string } = {}) => {
      if (key.name === "space") {
        // readline has already inserted the space by the time this runs, so what
        // matters is whether anything else is there. The bot's own half-typed
        // line counts as nothing: it is about to be discarded either way.
        const operatorHasTyped =
          rl.line.replace(/ $/, "").trim() !== "" && !botTerminal.isTyping();
        if (!operatorHasTyped) {
          // Swallow it, so a space used as a control never lands in the buffer
          // and never reaches a command as an argument.
          rl.write(null, { ctrl: true, name: "u" } as never);
          if (botTerminal.isPaused()) {
            botTerminal.resume();
          } else {
            botTerminal.notifyHumanActivity();
          }
          return;
        }
      }
      botTerminal.notifyHumanActivity();
    });
    rl.on("SIGINT", () => {
      botTerminal.requestStop();
      process.stdout.write("\n");
    });
    void startBotRun(
      botMode,
      botTerminal,
      () => {
        botTerminal.finish();
        if (!closed) {
          refreshPrompt();
          rl.prompt();
        }
      },
      formatLineInterfaceDisplayEntry
    );
  }

  // ESC ends whatever flow is open.
  //
  // Bound the same way bot mode binds space, a few lines above: readline
  // supplies keypress events with no setRawMode anywhere, so this needs no new
  // input machinery and nothing changes for line editing, paste, or the expect
  // harness that drives the blueprint recordings. The comment on that handler
  // is load-bearing here too — rl.write() emits no stdin keypress events, so
  // nothing Arturo prints can fake an ESC.
  //
  // It cancels; it does not step back one level. A menu stack is more than
  // this needs, and a key that sometimes goes back and sometimes exits
  // entirely would be worse than one predictable behaviour.
  if (isInteractiveSession()) {
    readline.emitKeypressEvents(process.stdin);
    process.stdin.on("keypress", (_character, key: { name?: string } = {}) => {
      if (key.name !== "escape" || !isGuidedFlowOpen()) return;
      // Clear anything half-typed, so the cancelled flow does not leave the
      // operator's partial answer sitting in the buffer for the next command.
      rl.write(null, { ctrl: true, name: "u" } as never);
      void (async () => {
        const { entries } = await routeUiLine("cancel");
        process.stdout.write(
          `\n${entries.map(formatLineInterfaceDisplayEntry).join("\n\n")}\n\n`
        );
        refreshPrompt();
        rl.prompt();
      })();
    });
  }

  rl.on("line", async (input) => {
    const submitted = input.trim();
    const control = classifyUiLine(submitted);
    if (control === "empty") {
      // An empty line is how the operator hands a paused run back to the bot,
      // and that reading wins while a run is actually paused.
      if (botTerminal?.isPaused()) {
        botTerminal.resume();
        refreshPrompt();
        rl.prompt();
        return;
      }
      // Otherwise, with a question open, Enter is an answer — an empty one.
      // Swallowing it here is why "Description:" could not be left blank: the
      // prompts stopped saying "or type skip", the handler was taught to take
      // a blank reply, and the line never reached it. The operator pressed
      // Enter, saw a fresh prompt, and pressed it again.
      if (!isGuidedFlowOpen()) {
        refreshPrompt();
        rl.prompt();
        return;
      }
    }
    if (control === "exit") {
      rl.close();
      return;
    }
    if (control === "clear") {
      console.clear();
      process.stdout.write(`${renderBanner()}\n`);
      refreshPrompt();
      rl.prompt();
      // A bot waits for the line it just typed to finish before typing the
      // next one. /clear produces no entries and returned before saying so,
      // so a plan containing it stopped there and never resumed — the run
      // sat at a cleared screen looking like it had simply ended.
      botTerminal?.notifyTurnComplete(submitted, []);
      return;
    }

    const activity = startActivityIndicator(
      describeActivity(submitted),
      process.stdout,
      useColour ? `${ansi.mint}` : ""
    );

    try {
      appendCommandHistory(submitted);
      // The precedence chain lives in uiLineRouter so a bot driver runs exactly
      // the same one. Anything that only called handleUiCommand could type a
      // command but could not answer a guided-menu question.
      const { entries } = await routeUiLine(submitted);
      activity.stop();
      process.stdout.write(`\n${entries.map(formatLineInterfaceDisplayEntry).join("\n\n")}\n\n`);
      botTerminal?.notifyTurnComplete(submitted, entries);
    } catch (error) {
      activity.stop();
      const failure: WorkStreamEntry = {
        actor: "Arturo",
        label: "Error",
        body: error instanceof Error
          ? error.message
          : String(error),
      };
      process.stdout.write(`\n${formatLineInterfaceDisplayEntry(failure)}\n\n`);
      // A bot waiting on this turn is resolved here too. Notifying only on the
      // success path leaves the run hanging for ever on the first command that
      // throws, with no output to say why.
      botTerminal?.notifyTurnComplete(submitted, [failure]);
    } finally {
      activity.stop();
    }
    // stdin can end (a pipe, or Ctrl+D) while an await above is still running.
    // Prompting a closed interface throws ERR_USE_AFTER_CLOSE and takes the
    // process down after the output has already been written.
    if (!closed) {
      refreshPrompt();
      rl.prompt();
    }
  });

  rl.on("close", () => {
    closed = true;
    clearBackgroundOutputRepl();
    process.stdout.write(
      `\n${colour("Arturo stopped.", ansi.muted)}\n`
    );
    // The Worker, coordinator, and schedule runtimes hold repeating timers, so
    // the process would otherwise stay alive after the operator has left.
    process.exit(0);
  });
}

if (require.main === module) {
  const parsed = parseBotArguments(process.argv.slice(2));
  if (!parsed.ok) {
    process.stderr.write(`${parsed.error}\n\n${BOT_USAGE}\n`);
    process.exit(2);
  }
  startLineInterface({ bot: parsed.mode });
}
