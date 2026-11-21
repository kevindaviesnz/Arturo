export type HumanTaskStatus =
  | "open"
  | "completed"
  | "blocked"
  | "needs_revision";

export type HumanTaskInput = {
  readonly title: string;
  readonly owner?: string;
  readonly purpose?: string;
  readonly instructions: string;
  readonly completionEvidence?: string;
  readonly workflowRunId?: string;
  /**
   * The Task that is *waiting* on this Human Task.
   *
   * Completing the Human Task completes that Task and advances its Workflow,
   * so it must only be set by the runtime when a Task actually parks on a
   * person. A finished Task whose result a person is merely acting on is
   * `handoverJobId` — putting it here made /complete-human-task try to advance
   * a Task that had already completed and refuse with "Task is not awaiting
   * Human Task completion".
   */
  readonly sourceJobId?: string;
  /**
   * A finished Task whose result this person is being asked to act on.
   *
   * Read-only by construction: nothing about completing this Human Task
   * touches that Task. It is how an AI Worker's output reaches the floor
   * without being pasted into the instructions.
   */
  readonly handoverJobId?: string;
  readonly fromWorker?: string;
  readonly toWorker?: string;
  readonly inputSummary?: string;
  readonly inputArtifact?: string;
  readonly inputArtefactRefs?: readonly string[];
  readonly outputArtefactRefs?: readonly string[];
  readonly requestedAction?: string;
  readonly acceptanceCriteria?: readonly string[];
  readonly revisionInstructions?: string;
};

export type HumanTask = HumanTaskInput & {
  readonly id: string;
  readonly status: HumanTaskStatus;
  readonly createdAt: number;
  readonly completedAt?: number;
  readonly completedBy?: string;
  readonly blockedAt?: number;
  readonly revisionRequestedAt?: number;
  readonly notes?: string;
  readonly blockReason?: string;
  readonly revisionInstructions?: string;
};

import {
  clearPersistedHumanTasks,
  loadPersistedHumanTasks,
  savePersistedHumanTask,
} from "../storage/humanTaskRepository";

const humanTasks =
  new Map<string, HumanTask>(
    loadPersistedHumanTasks().map((task) => [task.id, task])
  );

let nextHumanTaskId = Math.max(
  0,
  ...[...humanTasks.keys()].map((id) => {
    const match = /^human-task-(\d+)$/.exec(id);
    return match ? Number(match[1]) : 0;
  })
) + 1;

/**
 * Creates a deterministic human task id.
 *
 * @returns Human task id.
 *
 * SIDE EFFECT:
 * - Increments the in-memory human task id counter.
 */
export function createHumanTaskId(): string {
  const id =
    `human-task-${nextHumanTaskId}`;

  nextHumanTaskId += 1;

  return id;
}

/**
 * Creates a human task.
 *
 * @param input Human task input.
 * @returns Created human task.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory human task store.
 */
export function createHumanTask(
  input: HumanTaskInput
): HumanTask {
  const now =
    Date.now();

  const task: HumanTask = {
    ...input,
    id:
      createHumanTaskId(),
    status:
      "open",
    createdAt:
      now,
  };

  humanTasks.set(
    task.id,
    task
  );
  savePersistedHumanTask(task);

  return task;
}

/**
 * Lists human tasks.
 *
 * @returns Human tasks ordered by creation time.
 *
 * SIDE EFFECT:
 * - Reads the in-memory human task store.
 */
export function listHumanTasks(): readonly HumanTask[] {
  return [...humanTasks.values()]
    .sort(
      (left, right) =>
        left.createdAt -
        right.createdAt
    );
}

/**
 * Gets a human task by id.
 *
 * @param id Human task id.
 * @returns Human task or undefined.
 *
 * SIDE EFFECT:
 * - Reads the in-memory human task store.
 */
export function getHumanTask(
  id: string
): HumanTask | undefined {
  return humanTasks.get(
    id
  );
}

/**
 * Completes a human task with evidence notes.
 *
 * @param id Human task id.
 * @param notes Completion notes or evidence.
 * @returns Updated human task or undefined.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory human task store.
 */
export function completeHumanTask(
  id: string,
  notes: string,
  completedBy?: string,
  outputArtefactRefs?: readonly string[]
): HumanTask | undefined {
  const existing =
    humanTasks.get(
      id
    );

  if (!existing) {
    return undefined;
  }

  const updated: HumanTask = {
    ...existing,
    status:
      "completed",
    notes,
    completedAt:
      Date.now(),
    completedBy,
    outputArtefactRefs:
      outputArtefactRefs?.length
        ? [
            ...outputArtefactRefs,
          ]
        : existing.outputArtefactRefs,
    blockReason:
      undefined,
    blockedAt:
      undefined,
  };

  humanTasks.set(
    id,
    updated
  );
  savePersistedHumanTask(updated);

  return updated;
}

/**
 * Blocks a human task with a reason.
 *
 * @param id Human task id.
 * @param reason Block reason.
 * @returns Updated human task or undefined.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory human task store.
 */
export function blockHumanTask(
  id: string,
  reason: string
): HumanTask | undefined {
  const existing =
    humanTasks.get(
      id
    );

  if (!existing) {
    return undefined;
  }

  const updated: HumanTask = {
    ...existing,
    status:
      "blocked",
    blockReason:
      reason,
    blockedAt:
      Date.now(),
  };

  humanTasks.set(
    id,
    updated
  );
  savePersistedHumanTask(updated);

  return updated;
}

/**
 * Marks a human task as needing revision from a previous worker.
 *
 * @param id Human task id.
 * @param instructions Revision instructions.
 * @returns Updated human task or undefined.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory human task store.
 */
export function requestHumanTaskRevision(
  id: string,
  instructions: string
): HumanTask | undefined {
  const existing =
    humanTasks.get(
      id
    );

  if (!existing) {
    return undefined;
  }

  const updated: HumanTask = {
    ...existing,
    status:
      "needs_revision",
    revisionInstructions:
      instructions,
    revisionRequestedAt:
      Date.now(),
  };

  humanTasks.set(
    id,
    updated
  );
  savePersistedHumanTask(updated);

  return updated;
}

/**
 * Clears all human tasks.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears the in-memory human task store.
 * - Resets the in-memory human task id counter.
 */
export function clearHumanTasks(): void {
  humanTasks.clear();
  nextHumanTaskId = 1;
  clearPersistedHumanTasks();
}
