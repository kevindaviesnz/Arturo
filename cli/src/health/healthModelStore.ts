import type {
  BusinessFunctionDefinition,
} from "../business/businessFunctionDefinition";

import {
  createDefaultHealthReport,
  type HealthStatus,
  type HealthTrend,
  type HealthReport,
} from "./healthModel";
import {
  getBusinessFunction,
} from "../business/businessFunctionRuntimeStore";
import {
  getJob,
} from "../runtime/jobQueue";
import {
  isRetainedOperationalLesson,
  listOperationalMemory,
} from "../memory/operationalMemoryStore";
import {
  listRuntimeEventStore,
} from "../runtime/runtimeEventStore";

type OutcomeHealth = "healthy" | "monitoring" | "degraded" | "critical";

function mapOutcomeHealth(value: OutcomeHealth): HealthStatus {
  if (value === "healthy") return "Healthy";
  if (value === "critical") return "Unhealthy";
  return "Degrading";
}

function readOutcomeHealth(event: ReturnType<typeof listRuntimeEventStore>[number]): OutcomeHealth | undefined {
  const payload = event.payload;
  if (typeof payload !== "object" || payload === null || !("health" in payload)) {
    return undefined;
  }

  const health = payload.health;
  return health === "healthy" || health === "monitoring" || health === "degraded" || health === "critical"
    ? health
    : undefined;
}

function evaluateTrend(values: readonly OutcomeHealth[]): HealthTrend {
  if (values.length < 2) return "Stable";
  const score: Record<OutcomeHealth, number> = {
    critical: 0,
    degraded: 1,
    monitoring: 2,
    healthy: 3,
  };
  const previous = score[values[values.length - 2]];
  const latest = score[values[values.length - 1]];
  return latest > previous ? "Improving" : latest < previous ? "Declining" : "Stable";
}

/**
 * Purpose: Evaluates Business Function health using the current Chapter 10 Health Model.
 *
 * Params:
 * - definition: Business Function definition.
 *
 * Returns:
 * - Health report.
 *
 * PURE: No side effects.
 */
export function evaluateBusinessFunctionHealth(
  definition: BusinessFunctionDefinition
): HealthReport {
  if (!definition.runtimeId) {
    return createDefaultHealthReport(definition.label);
  }

  const runtime = getBusinessFunction(definition.runtimeId);
  if (!runtime) {
    return createDefaultHealthReport(definition.label);
  }

  const jobs = runtime.jobIds
    .map(getJob)
    .filter((job): job is NonNullable<typeof job> => Boolean(job));
  const completed = jobs.filter((job) => job.status === "completed").length;
  const failed = jobs.filter((job) => job.status === "failed").length;
  const terminal = completed + failed;
  const open = jobs.length - terminal;
  const outcomeEvents = listRuntimeEventStore().filter((event) => {
    if (event.type !== "runtime.outcome.measured") return false;
    const payload = event.payload;
    return typeof payload === "object" && payload !== null && "runtimeId" in payload && payload.runtimeId === runtime.id;
  });
  const outcomeHealth = outcomeEvents
    .map(readOutcomeHealth)
    .filter((value): value is OutcomeHealth => Boolean(value));
  const latestHealth = outcomeHealth.at(-1);
  const completionPercent = jobs.length > 0
    ? Math.round((completed / jobs.length) * 100)
    : 0;
  const retainedLessons = listOperationalMemory(runtime.id).filter(
    isRetainedOperationalLesson
  );

  return {
    businessFunctionLabel: definition.label,
    overallHealth: latestHealth
      ? mapOutcomeHealth(latestHealth)
      : failed > 0
        ? "Degrading"
        : "Unknown",
    indicators: [
      {
        label: "Tasks Completed",
        value: `${completed}/${jobs.length} (${completionPercent}%)`,
      },
      {
        label: "Tasks Failed",
        value: String(failed),
      },
      {
        label: "Open Tasks",
        value: String(open),
      },
      {
        label: "Outcomes Measured",
        value: `${outcomeEvents.length}/${terminal}`,
      },
      {
        label: "Lessons Retained",
        value: String(retainedLessons.length),
      },
      {
        label: "Governed Criteria",
        value: String(definition.successCriteria.length),
      },
    ],
    trend: evaluateTrend(outcomeHealth),
  };
}
