import {
  getJob,
  listJobs,
} from "../runtime/jobQueue";

import {
  formatJobRawView,
  formatJobView,
} from "../runtime/jobView";

/**
 * Checks whether a job is still active.
 *
 * @param status Job status.
 * @returns True when job should appear in default /jobs output.
 *
 * PURE: No side effects.
 */
export function isActiveJobStatus(
  status: string
): boolean {
  return [
    "scheduled",
    "queued",
    "running",
    "awaiting_review",
    "awaiting_approval",
    "awaiting_human_task",
    "awaiting_artefact_approval",
  ].includes(status);
}

/**
 * Purpose: Checks whether a job is the Chapter 12 approval demo job.
 *
 * Params:
 * - job: Job record.
 *
 * Returns:
 * - True when the job is an approval job.
 *
 * PURE: No side effects.
 */
export function isApprovalJob(
  job: ReturnType<typeof listJobs>[number]
): boolean {
  return job.task.startsWith(
    "Approve:"
  );
}

/**
 * Purpose: Formats a Job status for book-facing display.
 *
 * Params:
 * - job: Job record.
 *
 * Returns:
 * - Human-readable status.
 *
 * PURE: No side effects.
 */
export function formatChapterJobStatus(
  job: ReturnType<typeof listJobs>[number]
): string {
  if (
    job.status === "awaiting_approval"
  ) {
    return "Blocked — awaiting approval";
  }

  if (
    job.status ===
    "awaiting_artefact_approval"
  ) {
    return "Blocked — awaiting Artefact approval";
  }

  if (
    isApprovalJob(
      job
    ) &&
    job.status === "queued"
  ) {
    return "Assigned";
  }

  if (
    isApprovalJob(
      job
    ) &&
    job.status === "awaiting_review"
  ) {
    return "Awaiting Decision";
  }

  return formatDisplayStatus(
    job.status
  );
}

/**
 * Purpose: Finds a job by id or exact task title.
 *
 * Params:
 * - reference: Job id or task title.
 *
 * Returns:
 * - Matching job, or undefined.
 *
 * PURE: No side effects.
 */
export function findJobByIdOrTask(
  reference: string
): ReturnType<typeof listJobs>[number] | undefined {
  return listJobs().find(
    (job) =>
      job.id === reference ||
      job.task === reference
  );
}

/**
 * Formats Chapter-style active jobs output.
 *
 * @param jobs Job records.
 * @returns Chapter-style jobs output.
 *
 * PURE: No side effects.
 */
export function formatChapterJobsList(
  jobs: readonly ReturnType<typeof listJobs>[number][]
): string {
  if (jobs.length === 0) {
    return "(no active tasks; use /tasks --all to show completed tasks)";
  }

  return [
    "Tasks",
    "",
...jobs.map(
  (job, index) => {
    const lines = [
      `${index + 1}. ${formatCompactTaskPreview(
        job.task
      )}`,
      `   Status: ${formatChapterJobStatus(
  job
)}`,
    ];

    if (job.worker) {
      lines.push(
        `   Worker: ${job.worker}`
      );
    }

    if (job.output) {
      lines.push(
        `   Result: ${job.output}`
      );
    }

    return lines.join("\n");
  }
),
  ].join("\n\n");
}

/**
 * Creates a compact single-line preview for non-workflow job tasks.
 *
 * @param task Job task text.
 * @returns Single-line task preview.
 *
 * PURE: No side effects.
 */
export function formatCompactTaskPreview(
  task: string
): string {
  const singleLine =
    task
      .replace(/\s+/g, " ")
      .trim();

  return singleLine.length > 80
    ? `${singleLine.slice(0, 77)}...`
    : singleLine;
}

/**
 * Gets the display round for a job.
 *
 * @param job Job record.
 * @returns Review-loop round number, defaulting to 1.
 *
 * PURE: No side effects.
 */
export function getJobRound(
  job: ReturnType<typeof listJobs>[number]
): number {
  return job.reviewLoop?.attempt ?? 1;
}

/**
 * Purpose: Formats a Chapter 12 approval Job inspection view.
 *
 * Params:
 * - job: Approval Job.
 *
 * Returns:
 * - Human-readable approval Job detail.
 *
 * PURE: No side effects.
 */
export function formatApprovalJobInspection(
  job: ReturnType<typeof listJobs>[number]
): string {
  return [
    `Task: ${job.task}`,
    "  Type:               Approval",
    "  Function:           Hydration Reminder",
    "  Requested Action:   Send hydration reminder to user at 21:40",
    "  Context:",
    "    - User has not logged water intake in 6 hours.",
    "    - Prior reminder at this hour was well received (Operational Memory).",
    `  Assigned:           ${job.worker ?? job.selectedWorker ?? "Unassigned"}`,
    "  Status:             Awaiting Decision",
  ].join("\n");
}

/**
 * Gets the display step for a job.
 *
 * @param job Job record.
 * @returns One-based workflow step number, defaulting to 1.
 *
 * PURE: No side effects.
 */
export function getJobStep(
  job: ReturnType<typeof listJobs>[number]
): number {
  return job.workflowStepIndex === undefined
    ? 1
    : job.workflowStepIndex + 1;
}

/**
 * Formats a job or workflow status for display.
 *
 * @param status Raw status value.
 * @returns Human-readable status.
 *
 * PURE: No side effects.
 */
export function formatDisplayStatus(
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
 * Formats a job position label.
 *
 * @param job Job record.
 * @returns Human-readable job position.
 *
 * PURE: No side effects.
 */
export function formatJobPositionLabel(
  job: ReturnType<typeof listJobs>[number]
): string {
  return `Step ${getJobStep(
    job
  )} of round ${getJobRound(
    job
  )}`;
}

/**
 * Formats the workflow position for a job.
 *
 * @param job Job record.
 * @returns Human-readable workflow position.
 *
 * PURE: No side effects.
 */
export function formatJobPosition(
  job: ReturnType<typeof listJobs>[number]
): string {
  if (job.workflowRunId) {
    return formatJobPositionLabel(
      job
    );
  }

  return "Standalone task";
}

/**
 * Formats a compact job reference.
 *
 * @param job Job record.
 * @returns Compact job reference.
 *
 * PURE: No side effects.
 */
export function formatJobReference(
  job: ReturnType<typeof listJobs>[number]
): string {
  return `Task id: ${job.id} (${formatJobPositionLabel(
    job
  )})`;
}

/**
 * Extracts the final output block from noisy worker output.
 *
 * @param output Worker output text.
 * @returns Final output block.
 *
 * PURE: No side effects.
 */
export function extractFinalOutputPreviewBlock(
  output: string
): string {
  const marker =
    "Output:";

  const index =
    output.lastIndexOf(
      marker
    );

  if (index < 0) {
    return output.trim();
  }

  return output
    .slice(
      index + marker.length
    )
    .trim();
}

/**
 * Returns the best cleaned job output preview.
 *
 * @param job Job record.
 * @returns Preview text.
 *
 * PURE: No side effects.
 */
export function formatCleanJobPreview(
  job: ReturnType<typeof listJobs>[number]
): string {
  const output =
    job.output ??
    job.rawOutput ??
    job.error ??
    "";

  return formatCompactTaskPreview(
    extractFinalOutputPreviewBlock(
      output
    )
  );
}

/**
 * Returns the best output preview for a job list row.
 *
 * @param job Job record.
 * @returns Compact output preview.
 *
 * PURE: No side effects.
 */
export function formatJobOutputPreview(
  job: ReturnType<typeof listJobs>[number]
): string {
  const output =
    job.output ??
    job.rawOutput ??
    job.error ??
    job.task;

  return formatCompactTaskPreview(
    extractFinalOutputPreviewBlock(
      output
    )
  );
}

/**
 * Formats one readable standalone job list row.
 *
 * @param job Job record.
 * @returns Readable display row.
 *
 * PURE: No side effects.
 */
export function formatJobListRow(
  job: ReturnType<typeof listJobs>[number]
): string {
  const lines = [
    formatJobPosition(
      job
    ),
    `Worker: ${job.worker ?? "-"}`,
    `Status: ${formatDisplayStatus(
      job.status
    )}`,
    `Task id: ${job.id}`,
    "",
    "Output:",
    formatJobOutputPreview(
      job
    ) || "(no output yet)",
  ];

  if (job.kernelCallId) {
    lines.push(
      "",
      `Kernel call: ${job.kernelCallId.slice(
        0,
        8
      )}`
    );
  }

  return lines.join(
    "\n"
  );
}

/**
 * Sorts workflow jobs into round and step order.
 *
 * @param jobs Workflow jobs.
 * @returns Sorted workflow jobs.
 *
 * PURE: No side effects.
 */
export function sortWorkflowThreadJobs(
  jobs: readonly ReturnType<typeof listJobs>[number][]
): ReturnType<typeof listJobs>[number][] {
  return [...jobs].sort(
    (left, right) =>
      getJobRound(left) -
        getJobRound(right) ||
      getJobStep(left) -
        getJobStep(right) ||
      left.createdAt -
        right.createdAt
  );
}

/**
 * Finds the previous step in the same review-loop round.
 *
 * @param jobs Ordered workflow jobs.
 * @param current Current job.
 * @returns Previous step job or undefined.
 *
 * PURE: No side effects.
 */
export function findPreviousStepInSameRound(
  jobs: readonly ReturnType<typeof listJobs>[number][],
  current: ReturnType<typeof listJobs>[number]
): ReturnType<typeof listJobs>[number] | undefined {
  const currentRound =
    getJobRound(
      current
    );

  const currentStep =
    getJobStep(
      current
    );

  return [...jobs]
    .reverse()
    .find(
      (job) =>
        job.id !== current.id &&
        getJobRound(
          job
        ) === currentRound &&
        getJobStep(
          job
        ) === currentStep - 1
    );
}

/**
 * Finds the previous reviewer decision that requested a revision.
 *
 * @param jobs Ordered workflow jobs.
 * @param current Current job.
 * @returns Previous-round reviewer job or undefined.
 *
 * PURE: No side effects.
 */
export function findPreviousRoundReviewerJob(
  jobs: readonly ReturnType<typeof listJobs>[number][],
  current: ReturnType<typeof listJobs>[number]
): ReturnType<typeof listJobs>[number] | undefined {
  const currentRound =
    getJobRound(
      current
    );

  return [...jobs]
    .reverse()
    .find(
      (job) =>
        job.id !== current.id &&
        getJobRound(
          job
        ) === currentRound - 1 &&
        getJobStep(
          job
        ) === 2
    );
}

/**
 * Finds the previous draft job being revised.
 *
 * @param jobs Ordered workflow jobs.
 * @param current Current job.
 * @returns Previous-round draft job or undefined.
 *
 * PURE: No side effects.
 */
export function findPreviousRoundDraftJob(
  jobs: readonly ReturnType<typeof listJobs>[number][],
  current: ReturnType<typeof listJobs>[number]
): ReturnType<typeof listJobs>[number] | undefined {
  const currentRound =
    getJobRound(
      current
    );

  return [...jobs]
    .reverse()
    .find(
      (job) =>
        job.id !== current.id &&
        getJobRound(
          job
        ) === currentRound - 1 &&
        getJobStep(
          job
        ) === 1
    );
}

/**
 * Groups jobs by workflow run id.
 *
 * @param jobs Job records.
 * @returns Workflow jobs grouped by workflow run id.
 *
 * PURE: No side effects.
 */
export function groupJobsByWorkflowRunId(
  jobs: readonly ReturnType<typeof listJobs>[number][]
): Map<string, ReturnType<typeof listJobs>[number][]> {
  return jobs.reduce(
    (groups, job) => {
      if (!job.workflowRunId) {
        return groups;
      }

      const existing =
        groups.get(
          job.workflowRunId
        ) ?? [];

      groups.set(
        job.workflowRunId,
        [
          ...existing,
          job,
        ]
      );

      return groups;
    },
    new Map<string, ReturnType<typeof listJobs>[number][]>()
  );
}

/**
 * Formats one workflow as a latest job with previous context.
 *
 * @param workflowRunId Workflow run id.
 * @param jobs Jobs in the workflow.
 * @returns Human-readable workflow thread view.
 *
 * PURE: No side effects.
 */
export function formatWorkflowJobThreadView(
  workflowRunId: string,
  jobs: readonly ReturnType<typeof listJobs>[number][]
): string {
  const ordered =
    sortWorkflowThreadJobs(
      jobs
    );

  const latest =
    ordered[
      ordered.length - 1
    ];

  if (!latest) {
    return `Workflow: ${workflowRunId}\n(no tasks)`;
  }

  const previousStep =
    findPreviousStepInSameRound(
      ordered,
      latest
    );

  const previousReviewer =
    findPreviousRoundReviewerJob(
      ordered,
      latest
    );

  const previousDraft =
    findPreviousRoundDraftJob(
      ordered,
      latest
    );

  const referencedJobIds =
    new Set(
      [
        latest.id,
        previousStep?.id,
        previousReviewer?.id,
        previousDraft?.id,
      ].filter(
        (id): id is string =>
          typeof id === "string"
      )
    );

  const previous =
    ordered
      .filter(
        (job) =>
          job.id !== latest.id
      )
      .reverse();

  const unreferencedPrevious =
    previous.filter(
      (job) =>
        !referencedJobIds.has(
          job.id
        )
    );

  const lines = [
    `Workflow: ${workflowRunId}`,
    "",
    "Latest:",
    formatJobPositionLabel(
      latest
    ),
    `Worker: ${latest.worker ?? "-"}`,
    `Status: ${formatDisplayStatus(
      latest.status
    )}`,
    `Task id: ${latest.id}`,
    "",
    "Output:",
    formatCleanJobPreview(
      latest
    ) || "(no output yet)",
  ];

  if (
    getJobStep(
      latest
    ) === 2 &&
    previousStep
  ) {
    lines.push(
      "",
      "In reply to:",
      formatJobReference(
        previousStep
      )
    );
  }

  if (
    getJobStep(
      latest
    ) === 1 &&
    getJobRound(
      latest
    ) > 1
  ) {
    if (previousDraft) {
      lines.push(
        "",
        "Revising:",
        formatJobReference(
          previousDraft
        )
      );
    }

    if (previousReviewer) {
      lines.push(
        "",
        "Requested by:",
        formatJobReference(
          previousReviewer
        )
      );
    }
  }

  if (previous.length) {
    lines.push(
      "",
      "Previous:"
    );

    for (const job of unreferencedPrevious) {
      lines.push(
        formatJobReference(
          job
        )
      );
    }
  }

  return lines.join(
    "\n"
  );
}

/**
 * Handles the /job-raw command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads job store.
 * - Writes CLI output.
 */
export function handleJobRawCommand(
  args: readonly string[]
): void {
  const id =
    args[0];

  if (!id) {
    console.log(
      "Usage: /job-raw <task-id>"
    );

    return;
  }

  const job =
    getJob(
      id
    );

  if (!job) {
    console.log(
      `task not found: ${id}`
    );

    return;
  }

  console.log(
    formatJobRawView(
      job
    )
  );
}

/**
 * Handles the /jobs command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads job store.
 * - Writes CLI output.
 */
export function handleJobsCommand(
  args: readonly string[]
): void {

    const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (subcommand === "inspect") {
    const [
      reference,
    ] = subcommandArgs;

    if (!reference) {
      console.log(
        'Usage: /task inspect "<task-title-or-id>"'
      );

      return;
    }

    const job =
      findJobByIdOrTask(
        reference
      );

    if (!job) {
      console.log(
        `task not found: ${reference}`
      );

      return;
    }

    console.log(
      isApprovalJob(
        job
      )
        ? formatApprovalJobInspection(
            job
          )
        : formatJobView(
            job
          )
    );

    return;
  }

  const showAll =
    args.includes("--all");

  const jobs =
    listJobs().filter((job) =>
      showAll
        ? true
        : isActiveJobStatus(
            job.status
          )
    );

if (!jobs.length) {
  console.log(
    showAll
      ? "(no tasks)"
      : "(no active tasks; use /tasks --all to show completed tasks)"
  );

  return;
}

if (!showAll) {
  console.log(
    formatChapterJobsList(
      jobs
    )
  );

  return;
}
  for (const job of jobs) {
    console.log(
      formatJobListRow(
        job
      )
    );

    console.log("");
  }
}

/**
 * Handles the /job command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads job store.
 * - Writes CLI output.
 */
export function handleJobCommand(
  args: readonly string[]
): void {
  const id =
    args[0];

  if (!id) {
    console.log(
      'Usage: /task inspect "<task-id>"'
    );

    return;
  }

  const job =
    getJob(
      id
    );

  if (!job) {
    console.log(
      `task not found: ${id}`
    );

    return;
  }

  console.log(
    formatJobView(
      job
    )
  );
}

/**
 * Handles the /job-output command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads job store.
 * - Writes CLI output.
 */
export function handleJobOutputCommand(
  args: readonly string[]
): void {
  const id =
    args[0];

  if (!id) {
    console.log(
      "Usage: /job-output <task-id>"
    );

    return;
  }

  const job =
    getJob(
      id
    );

  if (!job) {
    console.log(
      `task not found: ${id}`
    );

    return;
  }

  if (!job.output) {
    console.log(
      "(no output)"
    );

    return;
  }

  console.log(
    "\n=== OUTPUT ===\n"
  );

  console.log(
    job.output
  );
}
