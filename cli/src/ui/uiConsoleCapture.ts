import {
  WorkStreamEntry,
} from "./uiState";

export type ConsoleLevel =
  | "log"
  | "warn"
  | "error";

export type ConsoleRestore =
  () => void;

/**
 * Purpose: Converts unknown console arguments into display text.
 *
 * Params:
 * - value: Unknown console argument.
 *
 * Returns:
 * - Display-safe string.
 *
 * PURE: No side effects.
 */
export function formatConsoleValue(
  value: unknown
): string {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  try {
    return JSON.stringify(
      value,
      null,
      2
    );
  } catch {
    return String(
      value
    );
  }
}

/**
 * Purpose: Converts console arguments into a single message.
 *
 * Params:
 * - args: Console arguments.
 *
 * Returns:
 * - Joined display text.
 *
 * PURE: No side effects.
 */
export function formatConsoleArgs(
  args: readonly unknown[]
): string {
  return args
    .map(
      formatConsoleValue
    )
    .join(" ");
}

/**
 * Purpose: Converts captured console output into a UI work stream entry.
 *
 * Params:
 * - level: Console level.
 * - args: Console arguments.
 *
 * Returns:
 * - Work stream entry.
 *
 * PURE: No side effects.
 */
export function createConsoleCaptureEntry(
  level: ConsoleLevel,
  args: readonly unknown[]
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label:
      level === "log"
        ? "Background event"
        : `Background ${level}`,
    body: formatConsoleArgs(
      args
    ),
  };
}

/**
 * Purpose: Captures console output so terminal UI can render it in the work stream.
 *
 * Params:
 * - onEntry: Callback that receives captured work stream entries.
 *
 * Returns:
 * - Restore function that reinstates the original console methods.
 *
 * SIDE EFFECT:
 * - Overrides console.log, console.warn, and console.error.
 */
export function installUiConsoleCapture(
  onEntry: (
    entry: WorkStreamEntry
  ) => void
): ConsoleRestore {
  const originalLog =
    console.log;

  const originalWarn =
    console.warn;

  const originalError =
    console.error;

  console.log = (
    ...args: unknown[]
  ): void => {
    onEntry(
      createConsoleCaptureEntry(
        "log",
        args
      )
    );
  };

  console.warn = (
    ...args: unknown[]
  ): void => {
    onEntry(
      createConsoleCaptureEntry(
        "warn",
        args
      )
    );
  };

  console.error = (
    ...args: unknown[]
  ): void => {
    onEntry(
      createConsoleCaptureEntry(
        "error",
        args
      )
    );
  };

  return () => {
    console.log =
      originalLog;

    console.warn =
      originalWarn;

    console.error =
      originalError;
  };
}

/** Runs a synchronous legacy command and returns its console output as one UI entry. */
/**
 * Output that reports a refusal rather than a result.
 *
 * These handlers write to the console and are wrapped with a fixed
 * success-shaped label, so a refusal was presented under "Task created". That
 * is not a cosmetic problem: the demo seed once reported success while creating
 * no Task at all, and `seedDemo.ts` still carries a comment about it. An
 * operator reading "Task created" above "Function X has no Worker assigned"
 * has been told two contradictory things and the louder one is wrong.
 *
 * "is not" is here for a refusal that names the state a thing is in rather
 * than what it lacks: "Task is not awaiting Human Task completion: task-1"
 * printed under the heading "Human task completed". No success line Arturo
 * prints first says "is not" — they lead with the record created.
 */
export const REFUSAL_TEXT =
  /\b(failed|error|not found|unknown|unsupported|denied|invalid|usage|cannot|could not|has no|is not)\b/i;

/**
 * Refusals that name the person the work belongs to.
 *
 * "Human task is assigned to Client Liaison, not Principal Architect." and
 * "Artefact review is assigned to Principal Architect, not Technical Lead."
 * carry none of the words above, so completing somebody else's task was reported
 * under the label "Human task completed" — the loud part saying the opposite of
 * what happened. Both refusals are the point of the role separation, so they are
 * exactly the ones that must not read as success.
 */
const WRONG_PERSON_TEXT = /\bassigned to\b[^.]*\bnot\b/i;

/**
 * A refusal that ends by saying nothing happened. The named-work locks word
 * their refusals as plain sentences ("Estate of R. Hemi, will is a will
 * matter, a type that never goes to an AI worker. Nothing was started."),
 * which carry none of the words above, so Amy saw them under "[Task
 * created]" (addendum 1, "Amy after the demo").
 */
const NOTHING_HAPPENED_TEXT = /\bNothing was (started|recorded|opened|created)\./;

/**
 * Whether captured output is reporting a refusal.
 *
 * PURE: No side effects.
 */
export function readsAsRefusal(
  body: string
): boolean {
  // Only what Arturo says first, not everything the output happens to contain.
  //
  // Success output echoes the operator's own words back — a Human Task prints
  // the instructions it was given — and those words are ordinary English.
  // "Record what failed and how" and "Record what you can see and what you
  // cannot" both created a Human Task and both reported "Human task not
  // created", because `failed` and `cannot` appear further down the body. Two
  // of four recorded demonstrations hit it; the other two escaped on the
  // wording of their instructions alone.
  //
  // A refusal says so immediately: "Function X has no Worker assigned to it",
  // "approval chain not found", "Human task is assigned to … not …". A success
  // leads with the record it created. So the first line Arturo prints decides
  // it, and text quoted back from the operator can no longer overturn it.
  const firstLine =
    body
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? "";

  return REFUSAL_TEXT.test(firstLine) || WRONG_PERSON_TEXT.test(firstLine) || NOTHING_HAPPENED_TEXT.test(firstLine);
}

export function captureUiCommandOutput(
  label: string,
  command: () => void
): WorkStreamEntry {
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(formatConsoleArgs(args));
  };
  try {
    command();
  } finally {
    console.log = originalLog;
  }
  const body =
    lines.join("\n") || "Command completed.";

  return {
    actor: "Arturo",
    // A success label over a refusal is a false report, so the label follows
    // what the command actually did.
    label: readsAsRefusal(body) ? refusalLabel(label) : label,
    body,
  };
}

// Trailing success verbs a command label ends in ("Task created", "Human task
// completed"). On a refusal such a label becomes "Refused".
const SUCCESS_VERB =
  /\s+(created|added|removed|updated|started|applied|completed|blocked|requested|approved|rejected|published|submitted|reviewed|assigned)$/i;

/** The label over a refusal (Amy, addendum 1: "[Task created]" above a refusal becomes "[Refused]"). */
export const REFUSED_LABEL = "Refused";

/**
 * Rewrites a success-shaped label to read as a refusal.
 *
 * A label ending in a known success verb ("Task created", "Human task
 * completed") becomes "Refused": nothing was created or completed, and a
 * negated label ("Task not created") still led with the word the reader
 * looks for. A label that is a plain noun ("Approval status", "Human task")
 * makes no success claim, so it is kept as is.
 *
 * PURE: No side effects.
 */
export function refusalLabel(label: string): string {
  return SUCCESS_VERB.test(label) ? REFUSED_LABEL : label;
}
