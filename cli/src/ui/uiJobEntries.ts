import {
  listJobs,
} from "../runtime/jobQueue";

import {
  WorkStreamEntry,
} from "./uiState";

import {
  formatJobTaskPreviewText,
} from "./uiJobTaskFormatting";

import {
  formatChapterJobStatus,
} from "../repl/jobCommands";

import {
  plainEvidenceBanner,
} from "./uiJobDetailEntries";

type UiJob =
  ReturnType<typeof listJobs>[number];

/**
 * Purpose: Returns jobs in newest-first order.
 *
 * Params:
 * - jobs: Runtime jobs.
 *
 * Returns:
 * - Jobs ordered newest first.
 *
 * PURE: No side effects.
 */
export function sortJobsNewestFirst(
  jobs: readonly UiJob[]
): readonly UiJob[] {
  return jobs
    .slice()
    .reverse();
}

/**
 * Purpose: Returns jobs in oldest-first order.
 *
 * Params:
 * - jobs: Runtime jobs.
 *
 * Returns:
 * - Jobs ordered oldest first.
 *
 * PURE: No side effects.
 */
export function sortJobsOldestFirst(
  jobs: readonly UiJob[]
): readonly UiJob[] {
  return jobs
    .slice();
}

/**
 * Purpose: Formats a short preview of a job task.
 *
 * Params:
 * - task: Raw job task text.
 * - maxLength: Maximum number of characters to include.
 *
 * Returns:
 * - Shortened task preview.
 *
 * PURE: No side effects.
 */
export function formatTaskPreview(
  task: string,
  maxLength: number
): string {
  const normalizedTask =
    formatJobTaskPreviewText(
      task
    );

  return normalizedTask.length <= maxLength
    ? normalizedTask
    : `${normalizedTask.slice(
        0,
        maxLength
      )}...`;
}

/**
 * Purpose: Converts a runtime job into a UI work stream entry.
 *
 * Params:
 * - job: Runtime job record.
 *
 * Returns:
 * - Work stream entry representing the job.
 *
 * PURE: No side effects.
 */
export function createJobWorkStreamEntry(
  job: UiJob
): WorkStreamEntry {
  return {
    actor: job.worker ?? job.selectedWorker ?? "Unassigned",
    label: `Task ${job.id} · ${job.status}`,
    body: formatTaskPreview(
      job.task,
      160
    ),
  };
}

/**
 * Purpose: Formats a job status for Chapter-style UI output.
 *
 * Params:
 * - status: Raw job status.
 *
 * Returns:
 * - Human-readable status.
 *
 * PURE: No side effects.
 */
export function formatUiJobStatus(
  status: string
): string {
  const words =
    status
      .replace(
        /_/g,
        " "
      )
      .trim();

  return words
    .slice(
      0,
      1
    )
    .toUpperCase() +
    words.slice(
      1
    );
}

/**
 * Purpose: Formats one Chapter-style job list item.
 *
 * Params:
 * - job: Runtime job.
 * - index: Zero-based job index.
 *
 * Returns:
 * - Numbered job list item.
 *
 * PURE: No side effects.
 */
export function formatChapterJobListItem(
  job: UiJob,
  index: number
): string {
  const lines = [
    `${index + 1}. ${formatTaskPreview(
      job.task,
      160
    )}`,
    `   ID: ${job.id}`,
    `   Status: ${formatChapterJobStatus(
  job
)}`,
  ];

  if (job.worker) {
    lines.push(
      `   Worker: ${job.worker}`
    );
  }

  // Required capabilities are routing detail, and this is the list view. They
  // still show in /task inspect, where the question being asked is why this
  // Worker took the work.

  if (job.webSearchQuery) {
    lines.push(
      `   Web search query: ${job.webSearchQuery}`
    );
  }

  if (job.inputArtefactRefs?.length) {
    lines.push(
      `   Input Artefacts: ${job.inputArtefactRefs.join(", ")}`
    );
  }

  if (job.artefactApprovalDependencies?.length) {
    lines.push(
      `   Artefact gate: ${job.artefactApprovalDependencies.join(", ")}`
    );
  }

  if (job.output) {
    // The stored banner is stripped for display only — the record keeps it.
    const resultPreview =
      (plainEvidenceBanner(job.output) ?? "").replace(/\s+/g, " ").trim();
    lines.push(
      `   Result preview: ${resultPreview.length <= 240 ? resultPreview : `${resultPreview.slice(0, 237)}...`}`
    );
  }

  return lines.join("\n");
}

/**
 * Purpose: Creates one numbered jobs-list entry.
 *
 * Params:
 * - jobs: Runtime jobs.
 * - limit: Maximum number of jobs to include.
 *
 * Returns:
 * - Work stream entry containing a Chapter-style numbered jobs list.
 *
 * PURE: No side effects.
 */
export function createNumberedJobsListEntry(
  jobs: readonly UiJob[],
  limit: number
): WorkStreamEntry {
  // The most recent, not the first: a real run had thirteen Tasks and the
  // list stopped at the eighth, so the three just created were the ones it
  // hid. They keep their place in the full numbering, which is what
  // /task inspect <number> reads.
  const ordered =
    sortJobsOldestFirst(
      jobs
    );
  const firstShown =
    Math.max(
      0,
      ordered.length - limit
    );
  const recentJobs =
    ordered.slice(
      firstShown
    );

  if (recentJobs.length === 0) {
    return {
      actor: "Arturo",
      label: "Tasks",
      body: "No tasks found.",
    };
  }

  // Silently showing 8 of 30 taught nothing about the other 22. Say what is
  // being held back and how to see it, without needing a switch to find out.
  const hidden =
    jobs.length -
    recentJobs.length;

  return {
    actor: "Arturo",
    label: "Tasks",
    body: [
      "Tasks",
      "",
      recentJobs
        .map(
          (job, index) =>
            formatChapterJobListItem(
              job,
              firstShown + index
            )
        )
        .join("\n\n"),
      ...(hidden > 0
        ? [
            "",
            `Showing the ${recentJobs.length} most recent of ${jobs.length} Tasks. Run /tasks all to see them all.`,
          ]
        : []),
    ].join("\n"),
  };
}

/**
 * Purpose: Resolves a job by UI reference.
 *
 * Params:
 * - jobs: Runtime jobs.
 * - reference: Job id, "latest", or numbered recent-job index.
 *
 * Returns:
 * - Matching job, or undefined.
 *
 * PURE: No side effects.
 */
export function findJobByUiReference(
  jobs: readonly UiJob[],
  reference: string
): UiJob | undefined {
  if (reference === "latest") {
    return sortJobsNewestFirst(
      jobs
    )[0];
  }

  const numericReference =
    Number(reference);

  if (
    Number.isInteger(numericReference) &&
    numericReference > 0
  ) {
    return sortJobsOldestFirst(
      jobs
    )[numericReference - 1];
  }

  const normalisedReference =
    reference
      .replace(
        /"/g,
        ""
      )
      .trim();

  return jobs.find(
    (job) => {
      const normalisedTask =
        job.task
          .replace(
            /"/g,
            ""
          )
          .trim();

      return (
        job.id === reference ||
        job.task === reference ||
        normalisedTask === normalisedReference
      );
    }
  );
}

/**
 * Purpose: Converts recent jobs into UI work stream entries.
 *
 * Params:
 * - jobs: Runtime jobs.
 * - limit: Maximum number of jobs to include.
 *
 * Returns:
 * - Work stream entries for the most recent jobs.
 *
 * PURE: No side effects.
 */
export function createRecentJobEntries(
  jobs: readonly UiJob[],
  limit: number
): readonly WorkStreamEntry[] {
  return sortJobsNewestFirst(
    jobs
  )
    .slice(
      0,
      limit
    )
    .map(
      createJobWorkStreamEntry
    );
}

/**
 * Purpose: Reads recent runtime jobs for the terminal UI.
 *
 * Params:
 * - limit: Maximum number of jobs to include.
 *
 * Returns:
 * - Work stream entries for recent jobs.
 *
 * SIDE EFFECT:
 * - Reads runtime job store.
 */
export function readRecentJobEntries(
  limit: number
): readonly WorkStreamEntry[] {
  return createRecentJobEntries(
    listJobs(),
    limit
  );
}
