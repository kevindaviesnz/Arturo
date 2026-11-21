import {
  describeApprovalReason,
  describeRecordedDecisions,
} from "../runtime/approvalFormatter";

import {
  getApprovalChain,
} from "../runtime/approvalChainStore";

import {
  getJob,
  listJobs,
} from "../runtime/jobQueue";

import {
  describeResultSignOff,
  readResultSignOffStanding,
} from "../runtime/resultSignOff";

import {
  WorkStreamEntry,
} from "./uiState";

import {
  findJobByUiReference,
} from "./uiJobEntries";

import {
  formatDisplayedJobTask,
  formatGrayText,
  formatPreviousStepOutputSection,
  splitDisplayedJobTask,
} from "./uiJobTaskFormatting";

import {
  formatApprovalJobInspection,
  isApprovalJob,
} from "../repl/jobCommands";
import {
  listBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";
import {
  getBusinessFunctionDefinitionByRuntimeId,
} from "../business/businessFunctionDefinitionStore";
import {
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";
import {
  followUpDepthOf,
  MAX_CHAIN_DEPTH,
} from "../runtime/followUpChain";
import {
  withoutEvidenceBanner,
  describeEvidenceStatus,
} from "../runtime/taskExecutor";

export {
  colourPreviousStepOutput,
  formatDisplayedJobTask,
  formatPreviousStepOutputSection,
  normalizeDisplayedJobTask,
  splitDisplayedJobTask,
} from "./uiJobTaskFormatting";

type UiJob =
  NonNullable<ReturnType<typeof getJob>>;

const JOB_DETAIL_SEPARATOR =
  "────────────────────────────────────────";

/**
 * Purpose: Formats optional job text for terminal display.
 *
 * Params:
 * - value: Optional text value.
 * - fallback: Text to use when value is missing.
 *
 * Returns:
 * - Display-safe text.
 *
 * PURE: No side effects.
 */
export function formatOptionalJobText(
  value: string | undefined,
  fallback: string
): string {
  return value && value.trim().length > 0
    ? value
    : fallback;
}

/**
 * Purpose: Formats a worker name for display.
 *
 * Params:
 * - value: Raw worker name.
 *
 * Returns:
 * - Display-friendly worker name.
 *
 * PURE: No side effects.
 */
export function formatWorkerDisplayName(
  value: string | undefined
): string {
  if (!value) {
    return "None";
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

/**
 * Purpose: Finds a job's one-based display position in a job list.
 *
 * Params:
 * - job: Job to locate.
 * - jobs: Ordered job list.
 *
 * Returns:
 * - One-based job position or undefined.
 *
 * PURE: No side effects.
 */
export function findJobDisplayPosition(
  job: UiJob,
  jobs: readonly UiJob[]
): number | undefined {
  const index =
    jobs.findIndex(
      (candidate) =>
        candidate.id === job.id
    );

  return index === -1
    ? undefined
    : index + 1;
}

/**
 * Purpose: Formats a job position as "x / n".
 *
 * Params:
 * - job: Job to describe.
 * - jobs: Ordered job list.
 *
 * Returns:
 * - Display position text, preferring workflow step numbering when available.
 *
 * PURE: No side effects.
 */
export function formatJobDisplayPosition(
  job: UiJob,
  jobs: readonly UiJob[]
): string {
  if (
    typeof job.workflowStepIndex === "number" &&
    typeof job.workflowStepCount === "number"
  ) {
    return `${job.workflowStepIndex + 1} / ${job.workflowStepCount}`;
  }

  const position =
    findJobDisplayPosition(
      job,
      jobs
    );

  return `${position ?? "?"} / ${jobs.length}`;
}

/**
 * Purpose: Finds the previous workflow job for a given workflow job.
 *
 * Params:
 * - job: Current job.
 * - jobs: Ordered job list.
 *
 * Returns:
 * - Previous workflow job or undefined.
 *
 * PURE: No side effects.
 */
/**
 * Purpose: Finds the previous workflow job for a given workflow job.
 *
 * Params:
 * - job: Current job.
 * - jobs: Ordered job list.
 *
 * Returns:
 * - Previous workflow job or undefined.
 *
 * PURE: No side effects.
 */
export function findPreviousWorkflowJob(
  job: UiJob,
  jobs: readonly UiJob[]
): UiJob | undefined {
  if (
    !job.workflowRunId ||
    typeof job.workflowStepIndex !== "number"
  ) {
    return undefined;
  }

  const workflowRunId =
    job.workflowRunId;

  const previousStepIndex =
    job.workflowStepIndex - 1;

  return jobs.find(
    (candidate) =>
      candidate.workflowRunId === workflowRunId &&
      candidate.workflowStepIndex === previousStepIndex
  );
}

/**
 * Purpose: Formats the current output for a job.
 *
 * Params:
 * - job: Current job.
 *
 * Returns:
 * - Current output text or a useful fallback.
 *
 * PURE: No side effects.
 */
export function formatCurrentJobOutput(
  job: UiJob
): string {
  return formatOptionalJobText(
    plainEvidenceBanner(job.output ?? job.rawOutput),
    "No output yet."
  );
}

/**
 * Removes the stored evidence banner from a result before it is shown.
 *
 * Only the display changes. The stored text keeps the shouted marker: it is
 * the audit record, `taskExecutor` writes it, and
 * `businessFunctionRuntimeOutcome` reads it back with `startsWith` to decide
 * what Arturo may learn from — rewriting the record to suit a reader would
 * quietly turn learning exclusion off for every Task saved afterwards.
 *
 * PURE: No side effects.
 */
export function plainEvidenceBanner(
  output: string | undefined
): string | undefined {
  return withoutEvidenceBanner(output);
}

/**
 * Turns a raw job status ("awaiting_approval") into a human label and a plain
 * one-line meaning, so an operator does not have to decode an enum with an
 * underscore in it. Unknown statuses fall back to a de-underscored, capitalised
 * label with no hint.
 *
 * PURE: No side effects.
 */
export function describeJobStatus(
  status: string
): { readonly label: string; readonly hint?: string } {
  const label = status
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());

  const hint: Record<string, string> = {
    queued: "Waiting its turn to run.",
    awaiting_approval: "Waiting for a person to approve it before it runs.",
    awaiting_review: "Done — waiting for a person to review the result.",
    running: "Being worked on now.",
    in_progress: "Being worked on now.",
    completed: "Finished.",
    failed: "Didn't finish — see the error below.",
    blocked: "Can't go ahead yet.",
    rejected: "Turned down by an approver.",
  };

  return hint[status] ? { label, hint: hint[status] } : { label };
}

/**
 * Purpose: Formats the main current job section.
 *
 * Params:
 * - job: Current job.
 * - jobs: Ordered job list.
 *
 * Returns:
 * - Current job detail section.
 *
 * SIDE EFFECT: Reads the Enterprise store to show the business name.
 */
/**
 * Resolves why a Task is waiting for approval, for the detail view.
 *
 * SIDE EFFECT: Reads the approval chain store and the stored policy rules.
 */
function describeJobApprovalReason(jobId: string): string {
  const chain = getApprovalChain(jobId);
  return chain
    ? describeApprovalReason(chain)
    : "a person needs to approve it before it runs";
}

export function formatCurrentJobSection(
  job: UiJob,
  jobs: readonly UiJob[]
): string {
  const status = describeJobStatus(job.status);

  return [
    `Worker: ${formatWorkerDisplayName(
      job.worker ?? job.selectedWorker
    )}`,
    `ID: ${job.id}`,
    `Status: ${status.label}`,
    ...(status.hint ? [`  (${status.hint})`] : []),
    // Name the rule that is holding it. Without this, an operator whose own
    // Governance rule never matched sees the Task waiting and concludes their
    // rule is what stopped it, when something else entirely did.
    ...(job.status === "awaiting_approval"
      ? [`Waiting because: ${describeJobApprovalReason(job.id)}`]
      : []),
    // How many generations of automatic follow-on work led here, so a Task
    // that appeared without anyone asking says where it came from and how much
    // further Arturo may carry on. Same shape as the review loop's attempt
    // counter.
    ...(followUpDepthOf(job) > 0
      ? [`Follow-up: ${followUpDepthOf(job)} of ${MAX_CHAIN_DEPTH}`]
      : []),
    // What the Worker was given to work from, named on the record. Without
    // this the result reasons from measurements that appear nowhere in its
    // instruction, and nothing on screen says where they came from.
    ...(job.sourceTaskId ? [`Continues from: ${job.sourceTaskId}`] : []),
    ...(job.sourceHumanTaskId
      ? [`Continues from: ${job.sourceHumanTaskId} (what a person found)`]
      : []),
    ...(
      job.webSearchQuery
        ? [
            `Web search query: ${job.webSearchQuery}`,
          ]
        : []
    ),
    ...(
      job.inputArtefactRefs?.length
        ? [
            `Input Artefacts: ${job.inputArtefactRefs.join(", ")}`,
          ]
        : []
    ),
    ...(
      job.artefactApprovalDependencies?.length
        ? [
            `Waiting on these Artefacts being approved: ${job.artefactApprovalDependencies.join(", ")}`,
          ]
        : []
    ),
    `Task: ${formatJobDisplayPosition(
      job,
      jobs
    )}`,
    `Instruction: ${formatDisplayedJobTask(
      job.task
    )}`,
    // The stored banner is stripped from the result below, so what it recorded
    // is said here. Without this line a model's draft reads as checked work.
    ...(describeEvidenceStatus(job.output ?? job.rawOutput)
      ? [`Checked: ${
          // Once a person has signed it off, "nobody has checked it" is no
          // longer true; the sign-off line below says who did and what that means.
          readResultSignOffStanding(job).state === "signed"
            ? describeEvidenceStatus(job.output ?? job.rawOutput)?.replace(" Nobody has checked it.", "")
            : describeEvidenceStatus(job.output ?? job.rawOutput)
        }`]
      : []),
    // "Approved" on its own reads as approval of the result below. Say which
    // decision was actually recorded, so a go-ahead is never taken for one.
    ...describeRecordedDecisions(
      getApprovalChain(job.id) ?? { decisions: [] }
    ).map((line) => `Decision: ${line}`),
    ...[describeResultSignOff(job, readResultSignOffStanding(job))].flatMap(
      (line) => (line ? [`Sign-off: ${line}`] : [])
    ),
    "",
    formatCurrentJobOutput(
      job
    ),
  ].join("\n");
}

/**
 * Purpose: Formats a previous job's output section.
 *
 * Params:
 * - previousJob: Previous workflow job.
 * - jobs: Ordered job list.
 *
 * Returns:
 * - Previous job output section.
 *
 * PURE: No side effects.
 */
export function formatPreviousWorkflowJobSection(
  previousJob: UiJob,
  jobs: readonly UiJob[]
): string {
  return [
    JOB_DETAIL_SEPARATOR,
    "",
    "Previous output",
    "",
    `Worker: ${formatWorkerDisplayName(
      previousJob.worker ?? previousJob.selectedWorker
    )}`,
    `Task: ${formatJobDisplayPosition(
      previousJob,
      jobs
    )}`,
    `Instruction: ${formatDisplayedJobTask(
      previousJob.task
    )}`,
    "",
    formatGrayText(
      formatOptionalJobText(
        previousJob.output ?? previousJob.rawOutput,
        "No previous output available."
      )
    ),
  ].join("\n");
}

/**
 * Purpose: Formats embedded previous-step output when no previous job record is available.
 *
 * Params:
 * - currentJob: Current job.
 *
 * Returns:
 * - Previous output section or undefined.
 *
 * PURE: No side effects.
 */
export function formatEmbeddedPreviousOutputSection(
  currentJob: UiJob
): string | undefined {
  const taskParts =
    splitDisplayedJobTask(
      currentJob.task
    );

  const previousStepOutput =
    formatPreviousStepOutputSection(
      taskParts.previousStepOutput
    );

  if (!previousStepOutput) {
    return undefined;
  }

  return [
    JOB_DETAIL_SEPARATOR,
    "",
    "Previous output",
    "",
    previousStepOutput,
  ].join("\n");
}

/**
 * Purpose: Formats the previous job output section.
 *
 * Params:
 * - currentJob: Current job.
 * - jobs: Ordered job list.
 *
 * Returns:
 * - Previous output section or undefined.
 *
 * PURE: No side effects.
 */
export function formatPreviousJobSection(
  currentJob: UiJob,
  jobs: readonly UiJob[]
): string | undefined {
  const previousJob =
    findPreviousWorkflowJob(
      currentJob,
      jobs
    );

  return previousJob
    ? formatPreviousWorkflowJobSection(
        previousJob,
        jobs
      )
    : formatEmbeddedPreviousOutputSection(
        currentJob
      );
}

/**
 * Purpose: Formats a job error section when an error exists.
 *
 * Params:
 * - job: Current job.
 *
 * Returns:
 * - Error section or undefined.
 *
 * PURE: No side effects.
 */
export function formatJobErrorSection(
  job: UiJob
): string | undefined {
  return job.error && job.error.trim().length > 0
    ? `error: ${job.error}`
    : undefined;
}

/**
 * Purpose: Joins optional detail sections with blank spacing.
 *
 * Params:
 * - sections: Detail sections, some of which may be undefined.
 *
 * Returns:
 * - Joined display body text.
 *
 * PURE: No side effects.
 */
export function joinJobDetailSections(
  sections: readonly (string | undefined)[]
): string {
  return sections
    .filter(
      (section): section is string =>
        Boolean(section && section.trim().length > 0)
    )
    .join("\n\n");
}

/**
 * Purpose: Builds detailed job body for terminal display.
 *
 * Params:
 * - job: Runtime job record.
 * - jobs: Ordered job list.
 *
 * Returns:
 * - Display body text.
 *
 * PURE: No side effects.
 */
export function createJobDetailBody(
  job: UiJob,
  jobs: readonly UiJob[] = [
    job,
  ]
): string {

    if (
    isApprovalJob(
      job
    )
  ) {
    return formatApprovalJobInspection(
      job
    );
    }
  
  return joinJobDetailSections([
    formatCurrentJobSection(
      job,
      jobs
    ),
    formatPreviousJobSection(
      job,
      jobs
    ),
    formatJobErrorSection(
      job
    ),
  ]);
}

/**
 * Purpose: Creates a usage entry for the /job command.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entry explaining /job usage.
 *
 * PURE: No side effects.
 */
export function createJobUsageEntry(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Usage",
    body: '/task inspect "<task-id>"',
  };
}

/**
 * Purpose: Creates a not-found entry for a missing job.
 *
 * Params:
 * - reference: Job id or task title that was not found.
 *
 * Returns:
 * - Work stream entry explaining the job was not found.
 *
 * PURE: No side effects.
 */
export function createJobNotFoundEntry(
  reference: string
): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Task not found",
    body: `No task found with id or title: ${reference}`,
  };
}

/**
 * Purpose: Converts a job into a detailed UI work stream entry.
 *
 * Params:
 * - job: Runtime job record.
 * - jobs: Ordered job list used for job numbering and previous-output lookup.
 *
 * Returns:
 * - Work stream entry containing job details.
 *
 * PURE: No side effects.
 */
export function createJobDetailEntry(
  job: UiJob,
  jobs: readonly UiJob[] = [
    job,
  ]
): WorkStreamEntry {
  return {
    actor: "",
    // An empty label fell through to formatLineInterfaceEntry's "Task detail"
    // default, which is a fallback for an entry that forgot to name itself
    // rather than a title chosen for this view.
    label: "Task details",
    body:
      createJobDetailBody(
        job,
        jobs
      ),
  };
}

/**
 * Purpose: Reads and formats a job by id, "latest", or numbered UI reference.
 *
 * Params:
 * - reference: Job id, "latest", or numbered recent-job index.
 *
 * Returns:
 * - Work stream entry for the job, or a not-found entry.
 *
 * SIDE EFFECT:
 * - Reads runtime job store.
 */
export function readJobDetailEntry(
  reference: string
): WorkStreamEntry {
  const jobs =
    listJobs();

  const job =
    findJobByUiReference(
      jobs,
      reference
    );

  return job
    ? createJobDetailEntry(
        job,
        jobs
      )
    : createJobNotFoundEntry(
        reference
      );
}

function formatJobTimestamp(value: number | undefined): string {
  return value === undefined
    ? "(not yet)"
    : new Date(value).toISOString();
}

/** Formats the Chapter 7 Runtime-to-Worker lifecycle for one Job. */
export function readChapterJobInspectionEntry(
  reference: string
): WorkStreamEntry {
  const jobs = listJobs();
  const job = findJobByUiReference(jobs, reference);

  if (!job) {
    return createJobNotFoundEntry(reference);
  }

  const runtime = listBusinessFunctions().find(
    (candidate) => candidate.jobIds.includes(job.id)
  );
  const definition = runtime
    ? getBusinessFunctionDefinitionByRuntimeId(runtime.id)
    : undefined;
  const status = job.status
    .replace(/_/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());

  return {
    actor: "Arturo",
    label: "Task detail",
    body: [
      `Task: ${job.task}`,
      `  ID:                 ${job.id}`,
      `  Function:           ${definition?.label ?? "(not attached)"}`,
      `  Operating process:  ${runtime?.id ?? "(not attached)"}`,
      `  Status:              ${status}`,
      `  Worker:              ${job.worker ?? "(unassigned)"}`,
      `  Created:             ${formatJobTimestamp(job.createdAt)}`,
      `  Assigned:            ${formatJobTimestamp(job.assignedAt)}`,
      `  Started:             ${formatJobTimestamp(job.startedAt)}`,
      job.status === "failed"
        ? `  Failed:              ${formatJobTimestamp(job.failedAt)}`
        : `  Completed:           ${formatJobTimestamp(job.completedAt)}`,
      ...(job.output || job.rawOutput
        ? [
            `  Result:              ${plainEvidenceBanner(job.output) ?? job.rawOutput}`,
          ]
        : []),
      ...(job.error
        ? [
            `  Error:               ${job.error}`,
          ]
        : []),
    ].join("\n"),
  };
}
