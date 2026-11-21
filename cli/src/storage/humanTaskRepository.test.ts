import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearPersistedHumanTasks,
  loadPersistedHumanTasks,
  savePersistedHumanTask,
} from "./humanTaskRepository";

beforeEach(clearPersistedHumanTasks);

describe("humanTaskRepository", () => {
  it("persists task linkage, evidence, and lifecycle state", () => {
    savePersistedHumanTask({
      id: "human-task-7",
      status: "completed",
      title: "Resolve release conflict",
      owner: "Kevin",
      purpose: "Adjudicate competing recommendations",
      instructions: "Review both positions.",
      completionEvidence: "Record rationale.",
      workflowRunId: "run-1",
      sourceJobId: "job-1",
      fromWorker: "Curriculum Research Worker",
      toWorker: "Kevin",
      inputSummary: "Two functions disagree.",
      inputArtifact: "job-1, job-2",
      requestedAction: "Choose the next action.",
      acceptanceCriteria: ["Rationale recorded"],
      notes: "Return for revision.",
      createdAt: 100,
      completedAt: 200,
    });

    expect(loadPersistedHumanTasks()).toEqual([
      {
        id: "human-task-7",
        status: "completed",
        title: "Resolve release conflict",
        owner: "Kevin",
        purpose: "Adjudicate competing recommendations",
        instructions: "Review both positions.",
        completionEvidence: "Record rationale.",
        workflowRunId: "run-1",
        sourceJobId: "job-1",
        fromWorker: "Curriculum Research Worker",
        toWorker: "Kevin",
        inputSummary: "Two functions disagree.",
        inputArtifact: "job-1, job-2",
        inputArtefactRefs: [],
        outputArtefactRefs: [],
        requestedAction: "Choose the next action.",
        acceptanceCriteria: ["Rationale recorded"],
        revisionInstructions: undefined,
        notes: "Return for revision.",
        blockReason: undefined,
        createdAt: 100,
        completedAt: 200,
        completedBy: undefined,
        blockedAt: undefined,
        revisionRequestedAt: undefined,
      },
    ]);
  });
});
