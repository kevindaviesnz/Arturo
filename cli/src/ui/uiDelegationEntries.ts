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

import {
  getDelegationFlagValue,
} from "../repl/delegationCommands";

import type {
  WorkStreamEntry,
} from "./uiState";

/**
 * Purpose: Handles /delegation request from the terminal UI.
 *
 * Params:
 * - args: Command arguments after "request".
 *
 * Returns:
 * - Work stream entry.
 *
 * SIDE EFFECT:
 * - Creates and completes a delegation request.
 */
export function handleUiDelegationRequestCommand(
  args: readonly string[]
): WorkStreamEntry {
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
    return {
      actor:
        "Arturo",
      label:
        "Usage",
      body:
        'Use /delegation request "<bounded-work>" --from "<business-function>" --to "<business-function>" [--enterprise "<enterprise-name-or-id>"]',
    };
  }

  try {
    const delegation = requestDelegatedWork({
      fromBusinessFunction: from,
      toBusinessFunction: to,
      work,
      enterprise,
    });
    return {
      actor: "Arturo",
      label: "Delegation requested",
      body: formatDelegationRequest(delegation),
    };
  } catch (error: unknown) {
    return {
      actor: "Arturo",
      label: "Delegation not created",
      body: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Purpose: Handles /delegation from the terminal UI.
 *
 * Params:
 * - args: Delegation command arguments.
 *
 * Returns:
 * - Work stream entry.
 *
 * SIDE EFFECT:
 * - May create delegation requests.
 */
export function handleUiDelegationCommand(
  args: readonly string[]
): WorkStreamEntry {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (subcommand === "request") {
    return handleUiDelegationRequestCommand(
      subcommandArgs
    );
  }

  if (subcommand === "list") {
    const requests = listDelegationRequests();
    return {
      actor: "Arturo",
      label: "Delegations",
      body: requests.length
        ? requests.map(formatDelegationSummary).join("\n\n")
        : "No delegations found.",
    };
  }

  if (subcommand === "inspect") {
    const request = subcommandArgs[0]
      ? getDelegationRequest(subcommandArgs[0])
      : undefined;
    return {
      actor: "Arturo",
      label: request ? "Delegation" : "Delegation not found",
      body: request
        ? formatDelegationRequest(request)
        : subcommandArgs[0]
          ? `delegation not found: ${subcommandArgs[0]}`
          : "Use /delegation inspect <delegation-id>",
    };
  }

  return {
    actor:
      "Arturo",
    label:
      "Usage",
    body:
      'Use /delegation request "<bounded-work>" --from "<business-function>" --to "<business-function>" [--enterprise "<enterprise-name-or-id>"], /delegation list, or /delegation inspect <delegation-id>',
  };
}
