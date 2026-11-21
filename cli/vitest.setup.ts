/**
 * Makes a test run independent of how it was launched.
 *
 * `isInteractiveSession()` reads `process.stdin.isTTY`, and the terminal's
 * colour is `process.stdout.isTTY`. Both differ between `npm run test:run` in a
 * terminal and the same command with its output piped, so without this the same
 * commit passes one way and fails the other: guided flows engage instead of
 * refusing, and formatter assertions see ANSI escapes.
 *
 * That was hidden until the suite moved to the `forks` pool. Worker threads
 * report `isTTY` as undefined whatever the parent was, so every run looked
 * non-interactive by accident; a forked child inherits the real streams.
 *
 * Tests that need an interactive session still opt in by defining
 * `process.stdin.isTTY` themselves (see `uiLineRouter.test.ts`) — this only
 * fixes the default, rather than forcing the answer through
 * `ARTURO_NON_INTERACTIVE`, which would override those.
 */

for (const stream of [process.stdin, process.stdout, process.stderr]) {
  Object.defineProperty(stream, "isTTY", {
    configurable: true,
    writable: true,
    value: false,
  });
}

process.env.NO_COLOR = "1";
