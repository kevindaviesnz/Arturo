import {
  listJobs,
} from "../runtime/jobQueue";

import {
  getWorker,
  listWorkers,
  parseWorkerCapability,
  type Worker,
  type WorkerCapability,
} from "../control/workers";

import {
  formatWorkerCapabilityLabel,
} from "./workerRegistrationCommands";

import {
  safelyRemoveWorker,
  type WorkerRemovalResult,
} from "../control/workerRemoval";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

/**
 * Purpose: Formats a worker availability value for display.
 *
 * Params:
 * - availability: Worker availability.
 *
 * Returns:
 * - Human-readable availability.
 *
 * PURE: No side effects.
 */
export function formatWorkerAvailabilityStatus(
  availability: string | undefined
): string {
  const value =
    availability ?? "available";

  return value
    .slice(
      0,
      1
    )
    .toUpperCase() +
    value.slice(
      1
    );
}

/**
 * Purpose: Counts current active Jobs assigned to a Worker.
 *
 * Params:
 * - worker: Worker to inspect.
 *
 * Returns:
 * - Current active Job count.
 *
 * SIDE EFFECT:
 * - Reads Job queue.
 */
export function countCurrentWorkerJobs(
  worker: Worker<any, any>
): number {
  const workerName =
    worker.displayName ?? worker.name;

  return listJobs().filter(
    (job) =>
      job.worker === workerName &&
      [
        "queued",
        "running",
        "awaiting_review",
        "awaiting_approval",
        "awaiting_human_task",
        "awaiting_artefact_approval",
        "awaiting_revision",
      ].includes(
        job.status
      )
  ).length;
}

/**
 * Purpose: Formats the default Chapter 13 human availability window.
 *
 * Params:
 * - worker: Worker to inspect.
 *
 * Returns:
 * - Human-readable availability lines.
 *
 * PURE: No side effects.
 */
export function formatHumanWorkerAvailabilityLines(
  worker: Worker<any, any>
): readonly string[] {
  return [
    worker.availability ??
      "available",
  ];
}

/**
 * Purpose: Formats Worker capabilities as a comma-separated display value.
 *
 * Params:
 * - worker: Worker to inspect.
 *
 * Returns:
 * - Human-readable capabilities.
 *
 * PURE: No side effects.
 */
export function formatWorkerCapabilitySummary(
  worker: Worker<any, any>
): string {
  const capabilities =
    worker.capabilities ?? [];

  if (capabilities.length === 0) {
    return "none";
  }

  return capabilities
    .map(
      formatWorkerCapabilityLabel
    )
    .join(", ");
}

/**
 * Purpose: Formats a Worker type for Chapter 13 display.
 *
 * Params:
 * - worker: Worker to inspect.
 *
 * Returns:
 * - Human-readable Worker type.
 *
 * PURE: No side effects.
 */
export function formatWorkerType(
  worker: Worker<any, any>
): string {
  return worker.kind === "human"
    ? "Human"
    : "AI";
}

/**
 * Purpose: Formats Chapter 13 Worker inspection output.
 *
 * Params:
 * - worker: Worker to inspect.
 *
 * Returns:
 * - Human-readable Worker detail.
 *
 * PURE: No side effects.
 */
export function formatWorkerInspection(
  worker: Worker<any, any>
): string {
  return [
    `Worker: ${worker.displayName ?? worker.name}`,
    `  Type:          ${formatWorkerType(worker)}`,
    `  Archetype:     ${worker.archetype ?? "none"}`,
    `  Capabilities:  ${formatWorkerCapabilitySummary(worker)}`,
    `  Specialization: ${worker.refinement?.trim() || "none"}`,
    "",
    "  Availability:",
    ...formatHumanWorkerAvailabilityLines(
      worker
    ).map(
      (line) =>
        `    ${line}`
    ),
  ].join("\n");
}

/**
 * Purpose: Resolves a human-facing capability label to an internal Worker capability id.
 *
 * Params:
 * - capability: Capability label from command args.
 *
 * Returns:
 * - Internal Worker capability id.
 *
 * PURE: No side effects.
 */
export function resolveWorkerCapabilityFilter(
  capability: string
): WorkerCapability {
  const normalised =
    capability
      .trim()
      .toLowerCase();

  if (
    normalised === "approve" ||
    normalised === "approval"
  ) {
    return "human-review";
  }

  if (normalised === "review") {
    return "review";
  }

  return parseWorkerCapability(
    normalised === "product safety"
      ? "safety"
      : normalised.replace(/\s+/g, "-")
  );
}

/**
 * Purpose: Filters Workers by one capability.
 *
 * Params:
 * - workers: Workers to filter.
 * - capability: Internal capability id.
 *
 * Returns:
 * - Matching Workers.
 *
 * PURE: No side effects.
 */
export function filterWorkersByCapability(
  workers: readonly Worker<any, any>[],
  capability: WorkerCapability
): readonly Worker<any, any>[] {
  return workers.filter(
    (worker) =>
      (worker.capabilities ?? []).includes(
        capability
      )
  );
}

/**
 * Purpose: Formats Chapter 13 Workers filtered by capability.
 *
 * Params:
 * - capabilityLabel: Human-facing capability label.
 * - workers: Matching Workers.
 *
 * Returns:
 * - Human-readable filtered Workers list.
 *
 * PURE: No side effects.
 */
export function formatWorkersByCapability(
  capabilityLabel: string,
  workers: readonly Worker<any, any>[]
): string {
  if (workers.length === 0) {
    return [
      `Workers with capability: ${capabilityLabel}`,
      "",
      "(none)",
    ].join("\n");
  }

  return [
    `Workers with capability: ${capabilityLabel}`,
    "",
    workers
      .map(
        (worker, index) =>
          [
            `${index + 1}. ${worker.displayName ?? worker.name}`,
            `   Availability: ${formatHumanWorkerAvailabilityLines(worker).join(" ")}`,
          ].join("\n")
      )
      .join("\n\n"),
  ].join("\n");
}

/**
 * Purpose: Formats Chapter 6 Workers list output.
 *
 * Params:
 * - workers: Registered workers.
 *
 * Returns:
 * - Human-readable Workers list.
 *
 * SIDE EFFECT:
 * - Reads Job queue for current Job counts.
 */
export function formatWorkersList(
  workers: readonly Worker<any, any>[]
): string {
  if (workers.length === 0) {
    return "(no workers registered)";
  }

  return [
    "Workers",
    "",
    workers
      .map(
        (worker, index) =>
          [
            `${index + 1}.`,
            `  ${worker.displayName ?? worker.name}`,
            `  Archetype:    ${worker.archetype ?? "none"}`,
            `  Availability: ${worker.availability ?? "available"}`,
            `  Status:       ${formatWorkerAvailabilityStatus(
              worker.availability
            )}`,
            `  Current Tasks: ${countCurrentWorkerJobs(
              worker
            )}`,
          ].join("\n")
      )
      .join("\n\n"),
  ].join("\n");
}

/** Formats the result of a safe Worker removal. */
export function formatWorkerRemoval(
  result:
    WorkerRemovalResult
): string {
  const name =
    result.worker
      .displayName ??
    result.worker.name;

  return [
    `Removed Worker: ${name}`,
    `Staffing assignments removed: ${result.staffingAssignmentsRemoved}`,
    `Historical Tasks retained: ${result.historicalJobsRetained}`,
    `Active chat ended: ${result.activeChatEnded ? "yes" : "no"}`,
    ...(
      result
        .savedWorkflowReferences >
      0
        ? [
            `Warning: ${result.savedWorkflowReferences} saved Workflow(s) still reference this Worker and must be updated before they can run successfully.`,
          ]
        : []
    ),
  ].join(
    "\n"
  );
}

/**
 * Handles the /workers command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads worker registry state.
 * - Writes CLI output.
 */
export function handleWorkersCommand(
  args: readonly string[] = []
): void {
  if (
    args[0] ===
    "remove"
  ) {
    const name =
      args[1];
    if (!name) {
      console.log(
        'Usage: /workers remove "<worker-name>"'
      );
      return;
    }

    try {
      const result =
        safelyRemoveWorker(
          name
        );
      console.log(
        formatWorkerRemoval(
          result
        )
      );
      broadcastEvent(
        "worker.removed",
        "success",
        `Worker removed: ${result.worker.displayName ?? result.worker.name}`
      );
    } catch (error) {
      console.log(
        error instanceof Error
          ? error.message
          : String(error)
      );
    }
    return;
  }

  if (args[0] === "inspect") {
    handleWorkerInspectCommand(
      args.slice(1)
    );
    return;
  }

  const capabilityFlagIndex =
    args.indexOf(
      "--capability"
    );

  if (capabilityFlagIndex >= 0) {
    const capabilityLabel =
      args[capabilityFlagIndex + 1];

    if (!capabilityLabel) {
      console.log(
        'Usage: /workers --capability "<capability>"'
      );

      return;
    }

    let capability: WorkerCapability;
    try {
      capability =
        resolveWorkerCapabilityFilter(
          capabilityLabel
        );
    } catch (error) {
      console.log(
        error instanceof Error
          ? error.message
          : String(error)
      );
      console.log(
        "Run /capabilities to list the accepted capability IDs."
      );
      return;
    }

    console.log(
      formatWorkersByCapability(
        capabilityLabel,
        filterWorkersByCapability(
          listWorkers(),
          capability
        )
      )
    );

    return;
  }

  console.log(
    formatWorkersList(
      listWorkers()
    )
  );
}

/**
 * Purpose: Handles /worker inspect.
 *
 * Params:
 * - args: Worker inspect arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads worker registry state.
 * - Writes CLI output.
 */
export function handleWorkerInspectCommand(
  args: readonly string[]
): void {
  const [
    name,
  ] = args;

  if (!name) {
    console.log(
      'Usage: /workers inspect "<worker-name>"'
    );

    return;
  }

  const worker =
    getWorker(
      name
    );

  if (!worker) {
    console.log(
      `worker not found: ${name}`
    );

    return;
  }

  console.log(
    formatWorkerInspection(
      worker
    )
  );
}
