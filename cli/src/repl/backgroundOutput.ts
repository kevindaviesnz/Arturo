import type {
  Interface,
} from "readline";

import {
  clearLine,
  cursorTo,
} from "readline";

import type {
  Writable,
} from "stream";

type PromptableRepl = Pick<
  Interface,
  "prompt"
>;

type ReplOutput = Writable & {
  readonly isTTY?: boolean;
};

let activeRepl:
  | PromptableRepl
  | undefined;

let activeOutput:
  | ReplOutput
  | undefined;

/**
 * Registers the active REPL interface for background output rendering.
 *
 * @param repl Readline interface.
 * @param output REPL output stream.
 * @returns void
 *
 * SIDE EFFECT: Stores active REPL output references.
 */
export function registerBackgroundOutputRepl(
  repl: PromptableRepl,
  output: ReplOutput
): void {
  activeRepl =
    repl;

  activeOutput =
    output;
}

/**
 * Clears the active REPL interface.
 *
 * @returns void
 *
 * SIDE EFFECT: Clears active REPL output references.
 */
export function clearBackgroundOutputRepl():
  void {
  activeRepl =
    undefined;

  activeOutput =
    undefined;
}

/**
 * Prints background output without leaving the prompt in a misleading state.
 *
 * @param lines Lines to print.
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears the current terminal prompt line when possible.
 * - Writes background output.
 * - Reprints the REPL prompt when possible.
 */
export function printBackgroundOutput(
  lines: readonly string[]
): void {
  if (
    !activeRepl ||
    !activeOutput
  ) {
    console.log(
      lines.join("\n")
    );

    return;
  }

  if (
    activeOutput.isTTY
  ) {
    clearLine(
      activeOutput,
      0
    );

    cursorTo(
      activeOutput,
      0
    );
  }

  console.log(
    lines.join("\n")
  );

  activeRepl.prompt(true);
}