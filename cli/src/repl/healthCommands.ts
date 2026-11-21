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

import type {
  HealthIndicator,
  HealthReport,
} from "../health/healthModel";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

/**
 * Purpose: Formats one Health Model indicator.
 *
 * Params:
 * - indicator: Health indicator.
 *
 * Returns:
 * - Human-readable indicator line.
 *
 * PURE: No side effects.
 */
export function formatHealthIndicator(
  indicator: HealthIndicator
): string {
  return `  ${indicator.label.padEnd(24)} ${indicator.value}`;
}

/**
 * Purpose: Formats a Health Report for Chapter 10 output.
 *
 * Params:
 * - report: Health report.
 *
 * Returns:
 * - Human-readable health report.
 *
 * PURE: No side effects.
 */
export function formatHealthReport(
  report: HealthReport
): string {
  return [
    "Function:",
    `  ${report.businessFunctionLabel}`,
    "",
    "Overall Health:",
    `  ${report.overallHealth}`,
    "",
    "Indicators",
    ...report.indicators.map(
      formatHealthIndicator
    ),
    "",
    "Trend:",
    `  ${report.trend}`,
  ].join("\n");
}

/**
 * Purpose: Handles /health.
 *
 * Params:
 * - args: Health command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads Business Function definitions.
 * - Broadcasts a health checked Event.
 * - Writes CLI output.
 */
export function handleHealthCommand(
  args: readonly string[]
): void {
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
    console.log(
      'Usage: /health "<job-name-or-id>" [--enterprise "<enterprise-name-or-id>"]'
    );

    return;
  }

  const enterprise =
    enterpriseReference
      ? getEnterpriseByIdOrName(
          enterpriseReference
        )
      : undefined;
  if (enterpriseReference && !enterprise) {
    console.log(
      `enterprise not found: ${enterpriseReference}`
    );
    return;
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
    console.log(
      `function not found: ${idOrLabel}`
    );

    return;
  }

  const report =
    evaluateBusinessFunctionHealth(
      definition
    );

  console.log(
    formatHealthReport(
      report
    )
  );

  broadcastEvent(
    "health.updated",
    "success",
    `Health updated: ${report.businessFunctionLabel} is ${report.overallHealth}`
  );
}
