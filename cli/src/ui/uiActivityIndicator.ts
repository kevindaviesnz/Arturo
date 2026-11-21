/**
 * Shows that Arturo is still working while a command runs.
 *
 * Long commands (model calls, staffing proposals, workflow runs) previously
 * produced no output until they finished, which made the terminal look frozen.
 * This module renders a single, in-place status line with an elapsed timer so
 * the operator can tell the difference between "still working" and "stuck".
 *
 * The indicator is presentation only: it never changes command behaviour, and
 * it is a no-op on a non-TTY stream so piped and CI output stays clean.
 */

const FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

/** How often the spinner advances, in milliseconds. */
export const ACTIVITY_FRAME_INTERVAL_MS = 90;

/** Elapsed seconds after which the line adds an "interrupt with Ctrl+C" hint. */
export const ACTIVITY_HINT_AFTER_SECONDS = 10;

export type ActivityIndicatorStream = {
  readonly isTTY?: boolean;
  write(chunk: string): unknown;
};

/**
 * Returns the human-readable label for a submitted command line.
 *
 * Commands are shown as their verb ("Staffing", "Planning") where Arturo has a
 * specific description, and fall back to the command itself otherwise, so the
 * status line always says what is running rather than a generic "Loading".
 *
 * PURE: No side effects.
 */
export function describeActivity(
  submitted: string
): string {
  const trimmed =
    submitted.trim();

  if (!trimmed.startsWith("/")) {
    return "Thinking";
  }

  const command =
    trimmed
      .split(/\s+/)[0]
      .toLowerCase();

  return ACTIVITY_LABELS[command] ?? `Running ${command}`;
}

const ACTIVITY_LABELS: Readonly<Record<string, string>> = {
  "/ask": "Planning a workflow",
  "/chat": "Asking the Worker",
  "/enterprise": "Working on the Enterprise",
  "/function": "Working on the Function",
  "/health": "Computing Health",
  "/next": "Recommending Functions",
  "/overview": "Building the overview",
  "/run": "Running the Workflow",
  "/staff": "Preparing a staffing proposal",
  "/start-functions": "Starting Functions",
  "/task": "Working on the Task",
  "/task-cap": "Working on the Task",
  "/workflow": "Preparing the Workflow",
};

/**
 * Formats one frame of the activity line.
 *
 * PURE: No side effects.
 */
export function formatActivityLine(
  label: string,
  frameIndex: number,
  elapsedMs: number
): string {
  const seconds =
    Math.floor(
      elapsedMs / 1000
    );
  const frame =
    FRAMES[
      frameIndex % FRAMES.length
    ];
  const hint =
    seconds >= ACTIVITY_HINT_AFTER_SECONDS
      ? "  ·  Ctrl+C to interrupt"
      : "";

  return `${frame}  ${label}…  ${seconds}s${hint}`;
}

export type ActivityIndicator = {
  /** Stops the indicator and clears its line. */
  readonly stop: () => void;
};

const NOOP_INDICATOR: ActivityIndicator = {
  stop: () => undefined,
};

/**
 * Starts an in-place activity indicator on the supplied stream.
 *
 * Returns a handle whose `stop` clears the line, so the caller can print real
 * output into a clean terminal. On a non-TTY stream this returns a no-op handle
 * and writes nothing at all.
 *
 * SIDE EFFECT:
 * - Writes and rewrites one terminal line until stopped.
 * - Holds an unref'd interval timer while running.
 */
export function startActivityIndicator(
  label: string,
  output: ActivityIndicatorStream = process.stdout,
  colourCodes = ""
): ActivityIndicator {
  if (output.isTTY !== true) {
    return NOOP_INDICATOR;
  }

  const startedAt =
    Date.now();
  let frameIndex =
    0;
  let stopped =
    false;

  const clear = (): void => {
    output.write("\r[2K");
  };

  const draw = (): void => {
    if (stopped) {
      return;
    }

    const line =
      formatActivityLine(
        label,
        frameIndex,
        Date.now() - startedAt
      );

    clear();
    output.write(
      colourCodes
        ? `${colourCodes}${line}[0m`
        : line
    );
    frameIndex += 1;
  };

  draw();

  const timer =
    setInterval(
      draw,
      ACTIVITY_FRAME_INTERVAL_MS
    );

  // Never keep the process alive for a purely cosmetic timer.
  timer.unref?.();

  return {
    stop: () => {
      if (stopped) {
        return;
      }

      stopped = true;
      clearInterval(timer);
      clear();
    },
  };
}
