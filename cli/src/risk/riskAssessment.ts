export type RiskCategory =
  | "financial"
  | "legal"
  | "operational"
  | "ethical"
  | "technical";

export type RiskLevel =
  | "low"
  | "medium"
  | "high";

export type RiskResponse =
  | "proceed"
  | "request_approval"
  | "assign_specialist_worker"
  | "pause_execution"
  | "escalate_to_human";

export type RiskSignal = {
  readonly category: RiskCategory;
  readonly level: RiskLevel;
  readonly reason: string;
};

export type RiskAssessmentInput = {
  readonly businessFunctionLabel: string;
  readonly jobDescription?: string;
  readonly signals: readonly RiskSignal[];
};

export type RiskAssessment = {
  readonly businessFunctionLabel: string;
  readonly jobDescription?: string;
  readonly category: RiskCategory;
  readonly level: RiskLevel;
  readonly response: RiskResponse;
  readonly reason: string;
  readonly signals: readonly RiskSignal[];
};

/**
 * Purpose: Converts a Risk level into a comparable numeric severity.
 *
 * Params:
 * - level: Risk level.
 *
 * Returns:
 * - Numeric severity.
 *
 * PURE: No side effects.
 */
export function getRiskLevelSeverity(
  level: RiskLevel
): number {
  if (level === "high") {
    return 3;
  }

  if (level === "medium") {
    return 2;
  }

  return 1;
}

/**
 * Purpose: Selects the highest-severity Risk signal.
 *
 * Params:
 * - signals: Risk signals.
 *
 * Returns:
 * - Highest-severity signal, or undefined when none exist.
 *
 * PURE: No side effects.
 */
export function selectHighestRiskSignal(
  signals: readonly RiskSignal[]
): RiskSignal | undefined {
  return signals
    .slice()
    .sort(
      (left, right) =>
        getRiskLevelSeverity(
          right.level
        ) -
        getRiskLevelSeverity(
          left.level
        )
    )[0];
}

/**
 * Purpose: Chooses a Runtime response for a Risk signal.
 *
 * Params:
 * - signal: Highest Risk signal.
 *
 * Returns:
 * - Runtime Risk response.
 *
 * PURE: No side effects.
 */
export function chooseRiskResponse(
  signal: RiskSignal
): RiskResponse {
  if (signal.level === "low") {
    return "proceed";
  }

  if (
    signal.level === "medium" &&
    (
      signal.category === "technical" ||
      signal.category === "operational"
    )
  ) {
    return "assign_specialist_worker";
  }

  if (
    signal.level === "medium"
  ) {
    return "request_approval";
  }

  if (
    signal.category === "ethical" ||
    signal.category === "legal"
  ) {
    return "escalate_to_human";
  }

  if (
    signal.category === "technical" ||
    signal.category === "operational"
  ) {
    return "pause_execution";
  }

  return "request_approval";
}

/**
 * Purpose: Creates a default low-risk signal when no explicit Risk signal exists.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Default low-risk signal.
 *
 * PURE: No side effects.
 */
export function createDefaultRiskSignal(): RiskSignal {
  return {
    category: "operational",
    level: "low",
    reason:
      "No elevated operating Risk signals detected.",
  };
}

/**
 * Purpose: Evaluates Runtime-level Risk from explicit signals.
 *
 * Params:
 * - input: Risk assessment input.
 *
 * Returns:
 * - Risk assessment.
 *
 * PURE: No side effects.
 */
export function evaluateRisk(
  input: RiskAssessmentInput
): RiskAssessment {
  const highestSignal =
    selectHighestRiskSignal(
      input.signals
    ) ??
    createDefaultRiskSignal();

  return {
    businessFunctionLabel:
      input.businessFunctionLabel,
    jobDescription:
      input.jobDescription,
    category:
      highestSignal.category,
    level:
      highestSignal.level,
    response:
      chooseRiskResponse(
        highestSignal
      ),
    reason:
      highestSignal.reason,
    signals:
      input.signals,
  };
}

/**
 * Purpose: Formats a Risk response for display or Events.
 *
 * Params:
 * - response: Risk response.
 *
 * Returns:
 * - Human-readable response label.
 *
 * PURE: No side effects.
 */
export function formatRiskResponse(
  response: RiskResponse
): string {
  const labels: Record<RiskResponse, string> = {
    proceed: "Proceed",
    request_approval: "Request approval",
    assign_specialist_worker: "Assign specialist Worker",
    pause_execution: "Pause execution",
    escalate_to_human: "Escalate to human",
  };

  return labels[response];
}
