import type {
  HumanTask,
} from "../runtime/humanTaskStore";

import {
  runtimeDb,
} from "./runtimeDatabase";

/** Persists one Human Task and its current lifecycle state. */
export function savePersistedHumanTask(task: HumanTask): void {
  runtimeDb.prepare(`
    INSERT OR REPLACE INTO human_tasks (
      id, status, title, owner, purpose, instructions, completion_evidence,
      workflow_run_id, source_job_id, handover_job_id, from_worker, to_worker, input_summary,
      input_artifact, input_artefact_refs, output_artefact_refs,
      requested_action, acceptance_criteria,
      revision_instructions, notes, block_reason, created_at, completed_at,
      completed_by, blocked_at, revision_requested_at
    ) VALUES (
      @id, @status, @title, @owner, @purpose, @instructions, @completionEvidence,
      @workflowRunId, @sourceJobId, @handoverJobId, @fromWorker, @toWorker, @inputSummary,
      @inputArtifact, @inputArtefactRefs, @outputArtefactRefs,
      @requestedAction, @acceptanceCriteria,
      @revisionInstructions, @notes, @blockReason, @createdAt, @completedAt,
      @completedBy, @blockedAt, @revisionRequestedAt
    )
  `).run({
    ...task,
    owner: task.owner ?? null,
    purpose: task.purpose ?? null,
    completionEvidence: task.completionEvidence ?? null,
    workflowRunId: task.workflowRunId ?? null,
    sourceJobId: task.sourceJobId ?? null,
    handoverJobId: task.handoverJobId ?? null,
    fromWorker: task.fromWorker ?? null,
    toWorker: task.toWorker ?? null,
    inputSummary: task.inputSummary ?? null,
    inputArtifact: task.inputArtifact ?? null,
    inputArtefactRefs:
      JSON.stringify(
        task.inputArtefactRefs ??
        []
      ),
    outputArtefactRefs:
      JSON.stringify(
        task.outputArtefactRefs ??
        []
      ),
    requestedAction: task.requestedAction ?? null,
    acceptanceCriteria: JSON.stringify(task.acceptanceCriteria ?? []),
    revisionInstructions: task.revisionInstructions ?? null,
    notes: task.notes ?? null,
    blockReason: task.blockReason ?? null,
    completedAt: task.completedAt ?? null,
    completedBy: task.completedBy ?? null,
    blockedAt: task.blockedAt ?? null,
    revisionRequestedAt: task.revisionRequestedAt ?? null,
  });
}

/** Loads every persisted Human Task in creation order. */
export function loadPersistedHumanTasks(): HumanTask[] {
  return (runtimeDb.prepare(`
    SELECT id, status, title, owner, purpose, instructions,
      completion_evidence as completionEvidence,
      workflow_run_id as workflowRunId, source_job_id as sourceJobId,
      handover_job_id as handoverJobId,
      from_worker as fromWorker, to_worker as toWorker,
      input_summary as inputSummary, input_artifact as inputArtifact,
      input_artefact_refs as inputArtefactRefs,
      output_artefact_refs as outputArtefactRefs,
      requested_action as requestedAction,
      acceptance_criteria as acceptanceCriteria,
      revision_instructions as revisionInstructions,
      notes, block_reason as blockReason, created_at as createdAt,
      completed_at as completedAt, completed_by as completedBy,
      blocked_at as blockedAt,
      revision_requested_at as revisionRequestedAt
    FROM human_tasks ORDER BY created_at ASC, id ASC
  `).all() as any[]).map((row) => ({
    ...row,
    owner: row.owner ?? undefined,
    purpose: row.purpose ?? undefined,
    completionEvidence: row.completionEvidence ?? undefined,
    workflowRunId: row.workflowRunId ?? undefined,
    sourceJobId: row.sourceJobId ?? undefined,
    handoverJobId: row.handoverJobId ?? undefined,
    fromWorker: row.fromWorker ?? undefined,
    toWorker: row.toWorker ?? undefined,
    inputSummary: row.inputSummary ?? undefined,
    inputArtifact: row.inputArtifact ?? undefined,
    inputArtefactRefs:
      JSON.parse(
        row.inputArtefactRefs ??
        "[]"
      ),
    outputArtefactRefs:
      JSON.parse(
        row.outputArtefactRefs ??
        "[]"
      ),
    requestedAction: row.requestedAction ?? undefined,
    acceptanceCriteria: JSON.parse(row.acceptanceCriteria ?? "[]"),
    revisionInstructions: row.revisionInstructions ?? undefined,
    notes: row.notes ?? undefined,
    blockReason: row.blockReason ?? undefined,
    completedAt: row.completedAt ?? undefined,
    completedBy: row.completedBy ?? undefined,
    blockedAt: row.blockedAt ?? undefined,
    revisionRequestedAt: row.revisionRequestedAt ?? undefined,
  }));
}

/** Deletes every persisted Human Task. */
export function clearPersistedHumanTasks(): void {
  runtimeDb.prepare("DELETE FROM human_tasks").run();
}
