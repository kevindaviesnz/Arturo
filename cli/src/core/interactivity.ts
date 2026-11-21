/**
 * Determines whether Arturo is running in an interactive session where a human
 * can answer prompts. In a non-interactive session (a CI/CD pipeline, a piped
 * or redirected run, or an explicit override) commands must never block waiting
 * for input, and human-approval gates must stay fail-closed rather than be
 * auto-satisfied.
 */

export type InteractivityStream = {
  readonly isTTY?: boolean;
};

/**
 * Returns whether the current session is interactive.
 *
 * A session is non-interactive when the input stream is not a TTY, or when it is
 * explicitly marked non-interactive via `ARTURO_NON_INTERACTIVE=true` or the
 * conventional `CI=true` environment variable.
 *
 * PURE: No side effects. Reads only the supplied env and stream objects.
 */
export function isInteractiveSession(
  env: NodeJS.ProcessEnv = process.env,
  stream: InteractivityStream = process.stdin
): boolean {
  if (
    env.ARTURO_NON_INTERACTIVE === "true" ||
    env.CI === "true"
  ) {
    return false;
  }

  return stream.isTTY === true;
}

/**
 * Returns a standard message for refusing an interactive-only action in a
 * non-interactive session, pointing the operator at the non-interactive path.
 *
 * PURE: No side effects.
 */
export function nonInteractiveRefusal(
  action: string,
  alternative: string
): string {
  return (
    `${action} needs an interactive terminal and cannot run in a ` +
    `non-interactive session (CI, a pipe, or ARTURO_NON_INTERACTIVE=true). ` +
    `${alternative}`
  );
}
