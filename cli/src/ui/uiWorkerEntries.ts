import {
  listJobs,
} from "../runtime/jobQueue";

import {
  listWorkers,
  type WorkerCapability,
} from "../control/workers";

import {
  WorkStreamEntry,
} from "./uiState";

import {
  getWorker,
} from "../control/workers";

import {
  filterWorkersByCapability,
  formatWorkerInspection,
  formatWorkersByCapability,
  resolveWorkerCapabilityFilter,
} from "../repl/workerInspectionCommands";

type UiWorker =
  ReturnType<typeof listWorkers>[number];

/**
 * Purpose: Formats worker capabilities for compact terminal display.
 *
 * Params:
 * - capabilities: Worker capabilities.
 * - limit: Maximum number of capabilities to show.
 *
 * Returns:
 * - Compact capability summary.
 *
 * PURE: No side effects.
 */
export function formatWorkerCapabilities(
  capabilities: readonly string[] | undefined,
  limit: number
): string {
  if (!capabilities || capabilities.length === 0) {
    return "none";
  }

  const visible =
    capabilities.slice(
      0,
      limit
    );

  const remaining =
    capabilities.length - visible.length;

  if (remaining <= 0) {
    return visible.join(", ");
  }

  return `${visible.join(", ")} +${remaining} more`;
}

/**
 * Purpose: Formats worker refinement text for display.
 *
 * Params:
 * - refinement: Optional worker-specific refinement text.
 *
 * Returns:
 * - Display text for refinement.
 *
 * PURE: No side effects.
 */
export function formatWorkerRefinement(
  refinement: string | undefined
): string {
  return refinement && refinement.trim().length > 0
    ? refinement.trim()
    : "none";
}

/**
 * Purpose: Formats Worker availability as display status.
 *
 * Params:
 * - availability: Worker availability.
 *
 * Returns:
 * - Display status.
 *
 * PURE: No side effects.
 */
export function formatUiWorkerStatus(
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
export function countUiCurrentWorkerJobs(
  worker: UiWorker
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
 * Purpose: Formats one Chapter 6 Worker item.
 *
 * Params:
 * - worker: Registered worker.
 * - index: Worker index.
 *
 * Returns:
 * - Worker list item.
 *
 * SIDE EFFECT:
 * - Reads Job queue for current Job count.
 */
export function formatChapterWorkerItem(
  worker: UiWorker,
  index: number
): string {
  return [
    `${index + 1}.`,
    `  ${worker.displayName ?? worker.name}`,
    `  Type:         ${worker.kind === "human" ? "Human" : "AI"}`,
    // "none" rather than "unknown": a person added as "just do the tasks
    // they're given" is deliberately given no archetype, and Arturo knows that
    // perfectly well. "unknown" read as missing data in /workers.
    `  Archetype:    ${worker.archetype ?? "none"}`,
    ...(worker.kind === "human"
      ? [
          `  Participation: ${worker.humanMode ?? "task"}`,
          `  Email:        ${worker.email ?? "none"}`,
        ]
      : []),
    `  Availability: ${worker.availability ?? "available"}`,
    `  Status:       ${formatUiWorkerStatus(
      worker.availability
    )}`,
    `  Current Tasks: ${countUiCurrentWorkerJobs(
      worker
    )}`,
  ].join("\n");
}

/**
 * Purpose: Converts a runtime worker into a UI work stream entry.
 *
 * Params:
 * - worker: Runtime worker record.
 *
 * Returns:
 * - Work stream entry representing the worker.
 *
 * PURE: No side effects.
 */
export function createWorkerWorkStreamEntry(
  worker: UiWorker
): WorkStreamEntry {
  return {
    actor: worker.displayName ?? worker.name,
    label: `${worker.kind} · ${worker.archetype ?? "no archetype"}`,
    body: [
      `name: ${worker.name}`,
      `model: ${worker.model ?? "none"}`,
      `availability: ${worker.availability ?? "available"}`,
      `trusted: ${worker.trust ? "yes" : "no"}`,
      `capabilities: ${formatWorkerCapabilities(
        worker.capabilities,
        5
      )}`,
      `refinement: ${formatWorkerRefinement(
        worker.refinement
      )}`,
    ].join("\n"),
  };
}

/**
 * Purpose: Converts workers into one Chapter 6 UI work stream entry.
 *
 * Params:
 * - workers: Runtime workers.
 *
 * Returns:
 * - Work stream entries for workers, or an empty-state message.
 *
 * SIDE EFFECT:
 * - Reads Job queue for current Job counts.
 */
export function createWorkerEntries(
  workers: readonly UiWorker[]
): readonly WorkStreamEntry[] {
  if (workers.length === 0) {
    return [
      {
        actor: "Arturo",
        label: "Workers",
        body: "No workers found.",
      },
    ];
  }

  return [
    {
      actor: "Arturo",
      label: "Workers",
      body: [
        "Workers",
        "",
        workers
          .map(
            formatChapterWorkerItem
          )
          .join("\n\n"),
      ].join("\n"),
    },
  ];
}

/**
 * Purpose: Reads current workers for the terminal UI.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entries for current workers.
 *
 * SIDE EFFECT:
 * - Reads worker registry.
 */
export function readWorkerEntries(): readonly WorkStreamEntry[] {
  return createWorkerEntries(
    listWorkers()
  );
}

/**
 * Purpose: Reads one Worker inspection entry for the terminal UI.
 *
 * Params:
 * - args: Worker inspect command arguments.
 *
 * Returns:
 * - Work stream entry for Worker inspection, usage, or not-found.
 *
 * SIDE EFFECT:
 * - Reads worker registry.
 */
export function readWorkerInspectionEntry(
  args: readonly string[]
): WorkStreamEntry {
  const [
    name,
  ] = args;

  if (!name) {
    return {
      actor: "Arturo",
      label: "Usage",
      body: 'Use /workers inspect "<worker-name>"',
    };
  }

  const worker =
    getWorker(
      name
    );

  if (!worker) {
    return {
      actor: "Arturo",
      label: "Worker not found",
      body: `worker not found: ${name}`,
    };
  }

  return {
    actor: "Arturo",
    label: "Worker detail",
    body: formatWorkerInspection(
      worker
    ),
  };
}

/**
 * Purpose: Reads Workers filtered by capability for the terminal UI.
 *
 * Params:
 * - capabilityLabel: Human-facing capability label.
 *
 * Returns:
 * - Work stream entry containing matching Workers.
 *
 * SIDE EFFECT:
 * - Reads worker registry.
 */
export function readWorkersByCapabilityEntry(
  capabilityLabel: string
): WorkStreamEntry {
  let capability: WorkerCapability;
  try {
    capability =
      resolveWorkerCapabilityFilter(
        capabilityLabel
      );
  } catch (error) {
    return {
      actor: "Arturo",
      label: "Unknown capability",
      body: [
        error instanceof Error
          ? error.message
          : String(error),
        "Run /capabilities to list the accepted capability IDs.",
      ].join("\n"),
    };
  }

  return {
    actor: "Arturo",
    label: "Workers",
    body: formatWorkersByCapability(
      capabilityLabel,
      filterWorkersByCapability(
        listWorkers(),
        capability
      )
    ),
  };
}
