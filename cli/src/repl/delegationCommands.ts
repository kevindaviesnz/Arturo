import {
  formatDelegationRequest,
  formatDelegationSummary,
} from "../delegation/delegation";

import {
  requestDelegatedWork,
} from "../delegation/delegationRuntime";

import {
  getDelegationRequest,
  listDelegationRequests,
} from "../delegation/delegationStore";

/**
 * Purpose: Reads a flag value from delegation command args.
 *
 * Params:
 * - args: Command arguments.
 * - flag: Flag name.
 *
 * Returns:
 * - Flag value or undefined.
 *
 * PURE: No side effects.
 */
export function getDelegationFlagValue(
  args: readonly string[],
  flag: string
): string | undefined {
  const equalsPrefix =
    `${flag}=`;

  const equalsValue =
    args.find(
      (arg) =>
        arg.startsWith(
          equalsPrefix
        )
    );

  if (equalsValue) {
    return equalsValue.slice(
      equalsPrefix.length
    );
  }

  const flagIndex =
    args.indexOf(
      flag
    );

  if (flagIndex === -1) {
    return undefined;
  }

  return args[flagIndex + 1];
}

/**
 * Purpose: Handles /delegation request.
 *
 * Params:
 * - args: Command arguments after "request".
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Creates and completes a delegation request.
 * - Writes terminal output.
 */
export function handleDelegationRequestCommand(
  args: readonly string[]
): void {
  const [
    work,
  ] = args;

  const from =
    getDelegationFlagValue(
      args,
      "--from"
    )?.trim();

  const to =
    getDelegationFlagValue(
      args,
      "--to"
    )?.trim();

  const enterprise =
    getDelegationFlagValue(
      args,
      "--enterprise"
    )?.trim();

  if (!work || !from || !to) {
    console.log(
      'Usage: /delegation request "<bounded-work>" --from "<business-function>" --to "<business-function>" [--enterprise "<enterprise-name-or-id>"]'
    );

    return;
  }

  try {
    console.log(formatDelegationRequest(requestDelegatedWork({
      fromBusinessFunction: from,
      toBusinessFunction: to,
      work,
      enterprise,
    })));
  } catch (error: unknown) {
    console.log(error instanceof Error ? error.message : String(error));
  }
}

/**
 * Purpose: Handles /delegation.
 *
 * Params:
 * - args: Delegation command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - May create delegation requests.
 * - Writes terminal output.
 */
export function handleDelegationCommand(
  args: readonly string[]
): void {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (subcommand === "request") {
    handleDelegationRequestCommand(
      subcommandArgs
    );

    return;
  }

  if (subcommand === "list") {
    const requests = listDelegationRequests();
    console.log(requests.length
      ? requests.map(formatDelegationSummary).join("\n\n")
      : "No delegations found.");
    return;
  }

  if (subcommand === "inspect") {
    const request = subcommandArgs[0]
      ? getDelegationRequest(subcommandArgs[0])
      : undefined;
    console.log(request
      ? formatDelegationRequest(request)
      : subcommandArgs[0]
        ? `delegation not found: ${subcommandArgs[0]}`
        : "Usage: /delegation inspect <delegation-id>");
    return;
  }

  console.log(
    [
      "Usage:",
      '  /delegation request "<bounded-work>" --from "<business-function>" --to "<business-function>" [--enterprise "<enterprise-name-or-id>"]',
      "  /delegation list",
      "  /delegation inspect <delegation-id>",
    ].join("\n")
  );
}
