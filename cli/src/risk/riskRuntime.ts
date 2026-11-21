import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  evaluateRisk,
  formatRiskResponse,
  type RiskAssessment,
  type RiskAssessmentInput,
  type RiskLevel,
} from "./riskAssessment";

import type {
  RuntimeLevel,
} from "../types/runtime";

/**
 * Purpose: Converts a Risk level into a Runtime event level.
 *
 * Params:
 * - level: Risk level.
 *
 * Returns:
 * - Runtime event level.
 *
 * PURE: No side effects.
 */
export function riskLevelToRuntimeLevel(
  level: RiskLevel
): RuntimeLevel {
  if (level === "high") {
    return "error";
  }

  if (level === "medium") {
    return "warn";
  }

  return "info";
}

/**
 * Purpose: Formats a Risk assessment Event message.
 *
 * Params:
 * - assessment: Risk assessment.
 *
 * Returns:
 * - Human-readable Event message.
 *
 * PURE: No side effects.
 */
export function formatRiskAssessedEventMessage(
  assessment: RiskAssessment
): string {
  return [
    `Risk assessed: ${assessment.businessFunctionLabel}`,
    `${assessment.category}/${assessment.level}`,
    `response: ${formatRiskResponse(
      assessment.response
    )}`,
  ].join(" — ");
}

/**
 * Purpose: Assesses Runtime-level Risk and records an Event.
 *
 * Params:
 * - input: Risk assessment input.
 *
 * Returns:
 * - Risk assessment.
 *
 * SIDE EFFECT:
 * - Broadcasts and persists a Runtime Risk Event.
 */
export function assessRuntimeRisk(
  input: RiskAssessmentInput
): RiskAssessment {
  const assessment =
    evaluateRisk(
      input
    );

  broadcastEvent(
    "risk.assessed",
    riskLevelToRuntimeLevel(
      assessment.level
    ),
    formatRiskAssessedEventMessage(
      assessment
    )
  );

  return assessment;
}