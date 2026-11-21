import {
  getBusinessFunctionDefinitionByIdOrLabel,
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";

import {
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";

import {
  evaluateBusinessFunctionHealth,
} from "../health/healthModelStore";

import {
  formatHealthReport,
} from "../repl/healthCommands";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import type {
  WorkStreamEntry,
} from "./uiState";

/**
 * Purpose: Creates usage text for /health.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Health usage text.
 *
 * PURE: No side effects.
 */
export function createHealthUsageEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Usage",
    body: 'Use /health "<business-function-name-or-id>" [--enterprise "<enterprise-name-or-id>"]',
  };
}

/**
 * Purpose: Handles /health for terminal UI.
 *
 * Params:
 * - args: Health command arguments.
 *
 * Returns:
 * - Work stream entry containing health report, usage, or not-found message.
 *
 * SIDE EFFECT:
 * - Reads Business Function definitions.
 * - Broadcasts health checked Event.
 */
export function handleUiHealthCommand(
  args: readonly string[]
): WorkStreamEntry {
  const [
    idOrLabel,
  ] = args;
  const enterpriseIndex =
    args.indexOf(
      "--enterprise"
    );
  const enterpriseReference =
    enterpriseIndex >= 0
      ? args[enterpriseIndex + 1]
      : undefined;

  if (!idOrLabel) {
    return createHealthUsageEntry();
  }

  const enterprise =
    enterpriseReference
      ? getEnterpriseByIdOrName(
          enterpriseReference
        )
      : undefined;
  if (enterpriseReference && !enterprise) {
    return {
      actor: "Arturo",
      label: "Enterprise not found",
      body: `enterprise not found: ${enterpriseReference}`,
    };
  }
  const definition =
    enterprise
      ? listBusinessFunctionDefinitionsByEnterprise(
          enterprise.id
        ).find(
          (candidate) =>
            candidate.id === idOrLabel ||
            candidate.label.trim().toLowerCase() ===
              idOrLabel.toLowerCase()
        )
      : getBusinessFunctionDefinitionByIdOrLabel(
          idOrLabel
        );

  if (!definition) {
    return {
      actor: "Arturo",
      label: "Function not found",
      body: `function not found: ${idOrLabel}`,
    };
  }

  const report =
    evaluateBusinessFunctionHealth(
      definition
    );

  broadcastEvent(
    "health.updated",
    "success",
    `Health updated: ${report.businessFunctionLabel} is ${report.overallHealth}`
  );

  return {
    actor: "Arturo",
    label: "Health",
    body: formatHealthReport(
      report
    ),
  };
}
