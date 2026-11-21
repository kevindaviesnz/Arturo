export type HealthStatus =
  | "Unknown"
  | "Healthy"
  | "Degrading"
  | "Unhealthy";

export type HealthTrend =
  | "Improving"
  | "Stable"
  | "Declining";

export type HealthIndicator = {
  readonly label: string;
  readonly value: string;
};

export type HealthReport = {
  readonly businessFunctionLabel: string;
  readonly overallHealth: HealthStatus;
  readonly indicators: readonly HealthIndicator[];
  readonly trend: HealthTrend;
};

/**
 * Purpose: Creates an honest report when insufficient outcome evidence exists.
 *
 * Params:
 * - businessFunctionLabel: Business Function label.
 *
 * Returns:
 * - Health report.
 *
 * PURE: No side effects.
 */
export function createDefaultHealthReport(
  businessFunctionLabel: string
): HealthReport {
  return {
    businessFunctionLabel,
    overallHealth: "Unknown",
    indicators: [
      {
        label: "Tasks Completed",
        value: "0/0",
      },
      {
        label: "Tasks Failed",
        value: "0",
      },
      {
        label: "Outcomes Measured",
        value: "0/0",
      },
    ],
    trend: "Stable",
  };
}
