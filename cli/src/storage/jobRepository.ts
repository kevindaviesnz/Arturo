import type {
  WorkflowExecutionPlan,
} from "../agents/workflowExecution";

import type {
  HumanTaskRevisionMetadata,
  Job,
  ReviewLoopJobMetadata,
} from "../runtime/jobQueue";

import type {
  ApprovalPolicy,
} from "../runtime/approvalPolicy";

import {
  runtimeDb,
} from "./runtimeDatabase";

export function parseRequiredCapabilities(
  value: unknown
): string[] | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const parsed =
      JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed
      : undefined;
  } catch {
    return undefined;
  }
}

export function parseWorkflowPlan(
  value: unknown
): WorkflowExecutionPlan | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  try {
    const parsed =
      JSON.parse(value);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.objective !== "string" ||
      !Array.isArray(parsed.steps)
    ) {
      return undefined;
    }

    return parsed as WorkflowExecutionPlan;
  } catch {
    return undefined;
  }
}

/**
 * Purpose: Parse optional JSON metadata whose loss would change Job behaviour after restart.
 * Params: value - Stored database value; fieldName - Human-readable field name for corruption errors.
 * Returns: Parsed metadata or undefined when the field was not persisted.
 * PURE: No side effects.
 */
export function parsePersistedJobJson<T>(
  value: unknown,
  fieldName: string
): T | undefined {
  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(
      `Invalid persisted Job ${fieldName}: expected JSON text.`
    );
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    throw new Error(
      `Invalid persisted Job ${fieldName}: malformed JSON.`
    );
  }
}

/**
 * Purpose: Persist the complete Job state required to preserve execution and governance semantics across restart.
 * Params: job - Runtime Job to store.
 * Returns: void.
 * SIDE EFFECT: Inserts or replaces one Job row in the runtime SQLite database.
 */
export function saveJob(
  job: Job
): void {
  const row = {
    id: job.id,
    task: job.task,
    owningJobId:
      job.owningJobId ??
      null,
    worker: job.worker ?? null,
    status: job.status,
    output: job.output ?? null,
    error: job.error ?? null,
    createdAt: job.createdAt,
    startedAt: job.startedAt ?? null,
    completedAt: job.completedAt ?? null,
    approvalRequestedAt:
      job.approvalRequestedAt ?? null,
    approvedAt:
      job.approvedAt ?? null,
    rejectedAt:
      job.rejectedAt ?? null,
    failedAt:
      job.failedAt ?? null,
    requiredCapabilities:
      job.requiredCapabilities
        ? JSON.stringify(
            job.requiredCapabilities
          )
        : null,
    selectedWorker:
      job.selectedWorker ?? null,
    routingReason:
      job.routingReason ?? null,
    workflowRunId:
      job.workflowRunId ?? null,
    workflowName:
      job.workflowName ?? null,
    workflowStepIndex:
      job.workflowStepIndex ?? null,
    workflowStepCount:
      job.workflowStepCount ?? null,
    workflowBaseTask:
      job.workflowBaseTask ?? null,
    workflowCapabilities:
      job.workflowCapabilities
        ? JSON.stringify(
            job.workflowCapabilities
          )
        : null,
    workflowPlan:
      job.workflowPlan
        ? JSON.stringify(
            job.workflowPlan
          )
        : null,
    enterpriseId:
      job.enterpriseId ??
      null,
    sourceTaskId:
      job.sourceTaskId ??
      null,
    sourceHumanTaskId:
      job.sourceHumanTaskId ??
      null,
    requestedBy:
      job.requestedBy ??
      null,
    clientId:
      job.clientId ??
      null,
    workId:
      job.workId ??
      null,
    cancelledAt:
      job.cancelledAt ??
      null,
    followUpDepth:
      job.followUpDepth ??
      null,
    businessFunctionId:
      job.businessFunctionId ??
      null,
    scheduledOccurrenceAt:
      job.scheduledOccurrenceAt ??
      null,
    webSearchQuery:
      job.webSearchQuery ??
      null,
    inputArtefactRefs:
      job.inputArtefactRefs
        ? JSON.stringify(
            job.inputArtefactRefs
          )
        : null,
    artefactApprovalDependencies:
      job.artefactApprovalDependencies
        ? JSON.stringify(
            job.artefactApprovalDependencies
          )
        : null,
    reviewToken:
      job.reviewToken ?? null,
    procedureRef:
      job.procedureRef ?? null,
    reviewLoop:
      job.reviewLoop
        ? JSON.stringify(
            job.reviewLoop
          )
        : null,
    kernelCallId:
      job.kernelCallId ?? null,
    rawOutput:
      job.rawOutput ?? null,
    assignedAt:
      job.assignedAt ?? null,
    requiredApprovals:
      job.requiredApprovals ?? null,
    approvalPolicy:
      job.approvalPolicy
        ? JSON.stringify(
            job.approvalPolicy
          )
        : null,
    revisionRequestedAt:
      job.revisionRequestedAt ?? null,
    revisionInstructions:
      job.revisionInstructions ?? null,
    humanTaskRevision:
      job.humanTaskRevision
        ? JSON.stringify(
            job.humanTaskRevision
          )
        : null,
  };

  runtimeDb
    .prepare(`
      INSERT OR REPLACE INTO jobs (
        id,
        task,
        owning_job_id,
        worker,
        status,
        output,
        error,
        created_at,
        started_at,
        completed_at,
        approval_requested_at,
        approved_at,
        rejected_at,
        failed_at,
        required_capabilities,
        selected_worker,
        routing_reason,
        workflow_run_id,
        workflow_name,
        workflow_step_index,
        workflow_step_count,
        workflow_base_task,
        workflow_capabilities,
        workflow_plan,
        enterprise_id,
        business_function_id,
        source_task_id,
        source_human_task_id,
        requested_by,
        client_id,
        work_id,
        cancelled_at,
        follow_up_depth,
        scheduled_occurrence_at,
        web_search_query,
        input_artefact_refs,
        artefact_approval_dependencies,
        review_token,
        procedure_ref,
        review_loop,
        kernel_call_id,
        raw_output,
        assigned_at,
        required_approvals,
        approval_policy,
        revision_requested_at,
        revision_instructions,
        human_task_revision
      )
      VALUES (
        @id,
        @task,
        @owningJobId,
        @worker,
        @status,
        @output,
        @error,
        @createdAt,
        @startedAt,
        @completedAt,
        @approvalRequestedAt,
        @approvedAt,
        @rejectedAt,
        @failedAt,
        @requiredCapabilities,
        @selectedWorker,
        @routingReason,
        @workflowRunId,
        @workflowName,
        @workflowStepIndex,
        @workflowStepCount,
        @workflowBaseTask,
        @workflowCapabilities,
        @workflowPlan,
        @enterpriseId,
        @businessFunctionId,
        @sourceTaskId,
        @sourceHumanTaskId,
        @requestedBy,
        @clientId,
        @workId,
        @cancelledAt,
        @followUpDepth,
        @scheduledOccurrenceAt,
        @webSearchQuery,
        @inputArtefactRefs,
        @artefactApprovalDependencies,
        @reviewToken,
        @procedureRef,
        @reviewLoop,
        @kernelCallId,
        @rawOutput,
        @assignedAt,
        @requiredApprovals,
        @approvalPolicy,
        @revisionRequestedAt,
        @revisionInstructions,
        @humanTaskRevision
      )
    `)
    .run(row);
}

/**
 * Purpose: Load persisted Jobs with the execution and governance state needed after restart.
 * Params: None.
 * Returns: Jobs ordered by creation time.
 * SIDE EFFECT: Reads Job rows from the runtime SQLite database.
 */
export function loadJobs(): Job[] {
  const rows =
    runtimeDb
      .prepare(`
        SELECT
          id,
          task,
          owning_job_id as owningJobId,
          worker,
          status,
          output,
          error,
          created_at as createdAt,
          started_at as startedAt,
          completed_at as completedAt,
          approval_requested_at as approvalRequestedAt,
          approved_at as approvedAt,
          rejected_at as rejectedAt,
          failed_at as failedAt,
          required_capabilities as requiredCapabilities,
          selected_worker as selectedWorker,
          routing_reason as routingReason,
          workflow_run_id as workflowRunId,
          workflow_name as workflowName,
          workflow_step_index as workflowStepIndex,
          workflow_step_count as workflowStepCount,
          workflow_base_task as workflowBaseTask,
          workflow_capabilities as workflowCapabilities,
          workflow_plan as workflowPlan,
          enterprise_id as enterpriseId,
          business_function_id as businessFunctionId,
          source_task_id as sourceTaskId,
          source_human_task_id as sourceHumanTaskId,
          requested_by as requestedBy,
          client_id as clientId,
          work_id as workId,
          cancelled_at as cancelledAt,
          follow_up_depth as followUpDepth,
          scheduled_occurrence_at as scheduledOccurrenceAt,
          web_search_query as webSearchQuery,
          input_artefact_refs as inputArtefactRefs,
          artefact_approval_dependencies as artefactApprovalDependencies,
          review_token as reviewToken,
          procedure_ref as procedureRef,
          review_loop as reviewLoop,
          kernel_call_id as kernelCallId,
          raw_output as rawOutput,
          assigned_at as assignedAt,
          required_approvals as requiredApprovals,
          approval_policy as approvalPolicy,
          revision_requested_at as revisionRequestedAt,
          revision_instructions as revisionInstructions,
          human_task_revision as humanTaskRevision
        FROM jobs
        ORDER BY created_at ASC
      `)
      .all() as any[];

  return rows.map((row) => ({
    ...row,
    worker:
      row.worker ?? undefined,
    output:
      row.output ?? undefined,
    error:
      row.error ?? undefined,
    startedAt:
      row.startedAt ?? undefined,
    completedAt:
      row.completedAt ?? undefined,
    approvalRequestedAt:
      row.approvalRequestedAt ?? undefined,
    approvedAt:
      row.approvedAt ?? undefined,
    rejectedAt:
      row.rejectedAt ?? undefined,
    failedAt:
      row.failedAt ?? undefined,
    requiredCapabilities:
      parseRequiredCapabilities(
        row.requiredCapabilities
      ),
    selectedWorker:
      row.selectedWorker ?? undefined,
    routingReason:
      row.routingReason ?? undefined,
    workflowRunId:
      row.workflowRunId ?? undefined,
    workflowName:
      row.workflowName ?? undefined,
    workflowStepIndex:
      row.workflowStepIndex ?? undefined,
    workflowStepCount:
      row.workflowStepCount ?? undefined,
    workflowBaseTask:
      row.workflowBaseTask ?? undefined,
    workflowCapabilities:
      parseRequiredCapabilities(
        row.workflowCapabilities
      ),
    workflowPlan:
      parseWorkflowPlan(
        row.workflowPlan
      ),
    enterpriseId:
      row.enterpriseId ??
      undefined,
    sourceTaskId:
      row.sourceTaskId ??
      undefined,
    sourceHumanTaskId:
      row.sourceHumanTaskId ??
      undefined,
    requestedBy:
      row.requestedBy ??
      undefined,
    clientId:
      row.clientId ??
      undefined,
    workId:
      row.workId ??
      undefined,
    cancelledAt:
      row.cancelledAt ??
      undefined,
    followUpDepth:
      row.followUpDepth ??
      undefined,
    businessFunctionId:
      row.businessFunctionId ??
      undefined,
    owningJobId:
      row.owningJobId ??
      undefined,
    scheduledOccurrenceAt:
      row.scheduledOccurrenceAt ??
      undefined,
    webSearchQuery:
      row.webSearchQuery ??
      undefined,
    inputArtefactRefs:
      parseRequiredCapabilities(
        row.inputArtefactRefs
      ),
    artefactApprovalDependencies:
      parseRequiredCapabilities(
        row.artefactApprovalDependencies
      ),
    reviewToken:
      row.reviewToken ?? undefined,
    procedureRef:
      row.procedureRef ?? undefined,
    reviewLoop:
      parsePersistedJobJson<ReviewLoopJobMetadata>(
        row.reviewLoop,
        "reviewLoop"
      ),
    kernelCallId:
      row.kernelCallId ?? undefined,
    rawOutput:
      row.rawOutput ?? undefined,
    assignedAt:
      row.assignedAt ?? undefined,
    requiredApprovals:
      row.requiredApprovals ?? undefined,
    approvalPolicy:
      parsePersistedJobJson<ApprovalPolicy>(
        row.approvalPolicy,
        "approvalPolicy"
      ),
    revisionRequestedAt:
      row.revisionRequestedAt ?? undefined,
    revisionInstructions:
      row.revisionInstructions ?? undefined,
    humanTaskRevision:
      parsePersistedJobJson<HumanTaskRevisionMetadata>(
        row.humanTaskRevision,
        "humanTaskRevision"
      ),
  }));
}

export function clearPersistedJobs(): void {
  runtimeDb
    .prepare("DELETE FROM jobs")
    .run();
}
