import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  endWorkerChat,
  getActiveWorkerChat,
  startWorkerChat,
} from "../chat/workerChat";

import {
  clearHumanTasks,
  createHumanTask,
} from "../runtime/humanTaskStore";

import {
  clearJobs,
  completeJob,
  enqueueJob,
  listJobs,
  startJob,
} from "../runtime/jobQueue";

import {
  clearStaffingAssignments,
  listStaffingAssignments,
  saveStaffingAssignment,
} from "../staffing/staffingStore";

import {
  loadWorkers,
} from "../storage/workerRepository";

import {
  clearWorkflows,
  createWorkflow,
} from "./workflows";

import {
  addWorker,
  clearWorkers,
  createHumanWorker,
  createInitialUserWorker,
  getWorker,
  registerAiWorker,
} from "./workers";

import {
  safelyRemoveWorker,
} from "./workerRemoval";

beforeEach(() => {
  endWorkerChat();
  clearHumanTasks();
  clearJobs();
  clearStaffingAssignments();
  clearWorkflows();
  clearWorkers();
});

afterEach(() => {
  endWorkerChat();
  clearHumanTasks();
  clearJobs();
  clearStaffingAssignments();
  clearWorkflows();
  clearWorkers();
});

describe("safelyRemoveWorker", () => {
  it("removes registration and current staffing while retaining history", () => {
    registerAiWorker(
      "Old Research Worker",
      "researcher"
    );
    saveStaffingAssignment({
      businessFunctionId:
        "enterprise-1:function-1",
      workerName:
        "Old Research Worker",
      role:
        "ai",
      rationale:
        "Historical coverage",
    });
    createWorkflow(
      "Old research path",
      [
        "Old Research Worker",
      ]
    );
    const job =
      enqueueJob(
        "Prepare a completed historical note.",
        "Old Research Worker"
      );
    startJob(
      job.id
    );
    completeJob(
      job.id,
      "Completed note."
    );
    startWorkerChat(
      "Old Research Worker"
    );

    const result =
      safelyRemoveWorker(
        "Old Research Worker"
      );

    expect(result).toMatchObject({
      staffingAssignmentsRemoved:
        1,
      historicalJobsRetained:
        1,
      savedWorkflowReferences:
        1,
      activeChatEnded:
        true,
    });
    expect(
      getWorker(
        "Old Research Worker"
      )
    ).toBeUndefined();
    expect(
      loadWorkers().some(
        (worker) =>
          worker.name ===
          "Old Research Worker"
      )
    ).toBe(false);
    expect(
      listStaffingAssignments()
    ).toEqual([]);
    expect(
      listJobs().find(
        (item) =>
          item.id === job.id
      )?.status
    ).toBe(
      "completed"
    );
    expect(
      getActiveWorkerChat()
    ).toBeUndefined();
  });

  it("refuses to remove a system Worker", () => {
    addWorker(
      createInitialUserWorker()
    );

    expect(() =>
      safelyRemoveWorker(
        "operator"
      )
    ).toThrow(
      "System Worker cannot be removed"
    );
    expect(
      getWorker(
        "operator"
      )
    ).toBeDefined();
  });

  it("refuses to remove a Worker assigned to an unfinished Job", () => {
    registerAiWorker(
      "Busy Analyst",
      "analyst"
    );
    const job =
      enqueueJob(
        "Finish the analysis.",
        "Busy Analyst"
      );

    expect(() =>
      safelyRemoveWorker(
        "Busy Analyst"
      )
    ).toThrow(
      job.id
    );
    expect(
      getWorker(
        "Busy Analyst"
      )
    ).toBeDefined();
  });

  it("refuses to remove a Human Worker who owns an open Human Task", () => {
    addWorker(
      createHumanWorker(
        "Kevin",
        "reviewer"
      )
    );
    const task =
      createHumanTask({
        title:
          "Review the report",
        owner:
          "Kevin",
        instructions:
          "Review the supplied report and record a decision.",
      });

    expect(() =>
      safelyRemoveWorker(
        "Kevin"
      )
    ).toThrow(
      task.id
    );
    expect(
      getWorker(
        "Kevin"
      )
    ).toBeDefined();
  });

  it("refuses removal when an unfinished Workflow Job names the Worker in a later step", () => {
    registerAiWorker(
      "Future Reviewer",
      "reviewer"
    );
    const job =
      enqueueJob(
        "Run an ordered review.",
        undefined,
        {
          workflowPlan: {
            objective:
              "Review the work.",
            steps: [
              {
                archetype:
                  "reviewer",
                workerName:
                  "Future Reviewer",
                instruction:
                  "Review the earlier result.",
              },
            ],
          },
        }
      );

    expect(() =>
      safelyRemoveWorker(
        "Future Reviewer"
      )
    ).toThrow(
      job.id
    );
  });
});
