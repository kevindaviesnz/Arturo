import {
  updateInitialUserDetails,
} from "../control/workers";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

/**
 * Handles the /setup-user command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Updates initial operator/user details.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
export function handleSetupUserCommand(
  args: readonly string[]
): void {
  const [
    displayName,
    email,
  ] = args;

  if (!displayName) {
    console.log(
      'Usage: /setup-user "<name>" [email]'
    );

    return;
  }

  updateInitialUserDetails({
    displayName,
    email,
  });

  console.log(
    `operator updated: ${displayName}`
  );

  broadcastEvent(
    "operator.updated",
    "success",
    `Operator updated: ${displayName}`
  );
}