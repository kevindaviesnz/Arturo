import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearJobs,
  completeJob,
  completeJobFromHumanTask,
  createReadableJobId,
  enqueueJob,
  enqueueScheduledJob,
  getJob,
  hasWorkInFlight,
  listJobs,
  nextJob,
  requestJobHumanTask,
  requestJobRevision,
  queueScheduledTaskOccurrence,
  startJob,
  cancelJob,
  markJobCancelled,
  replaceJob,
  CANCELLABLE_JOB_STATUSES,
} from "./jobQueue";

import {
  loadJobs,
} from "../storage/jobRepository";

beforeEach(() => {
  clearJobs();
});

describe("enqueueJob", () => {
  it("creates a queued job", () => {
    const job =
      enqueueJob(
        "Write a short article",
        "Writer AI"
      );

    expect(job).toMatchObject({
      task:
        "Write a short article",
      worker:
        "Writer AI",
      status:
        "queued",
    });

    expect(
      typeof job.id
    ).toBe("string");

    expect(
      typeof job.createdAt
    ).toBe("number");
  });

  it("stores workflow routing metadata", () => {
    const job =
      enqueueJob(
        "Review the article",
        "Reviewer AI",
        {
          workflowRunId:
            "run-1",
          workflowName:
            "Article workflow",
          workflowStepIndex:
            1,
          workflowStepCount:
            3,
          workflowBaseTask:
            "Create an article",
        }
      );

    expect(job).toMatchObject({
      workflowRunId:
        "run-1",
      workflowName:
        "Article workflow",
      workflowStepIndex:
        1,
      workflowStepCount:
        3,
      workflowBaseTask:
        "Create an article",
    });
  });

  it("persists Job ownership and an explicit Web Search query", () => {
    const job =
      enqueueJob(
        "Summarize the captured sources.",
        "Research Worker",
        {
          owningJobId:
            "enterprise-1:trend-research",
          enterpriseId:
            "enterprise-1",
          webSearchQuery:
            "current recycled cotton outerwear trends",
          requiredCapabilities: [
            "web-research",
          ],
        }
      );

    expect(
      loadJobs().find(
        (candidate) =>
          candidate.id ===
          job.id
      )
    ).toMatchObject({
      owningJobId:
        "enterprise-1:trend-research",
      enterpriseId:
        "enterprise-1",
      webSearchQuery:
        "current recycled cotton outerwear trends",
      requiredCapabilities: [
        "web-research",
      ],
    });
  });

  it("creates a dormant Task schedule without queuing it", () => {
    expect(
      enqueueScheduledJob(
        "Verify the weekly backup",
        {
          owningJobId:
            "enterprise-1:backups",
        }
      )
    ).toMatchObject({
      status:
        "scheduled",
      worker:
        undefined,
      owningJobId:
        "enterprise-1:backups",
    });
  });

  it("queues a completed scheduled Task for the runtime with a new Worker", () => {
    const completed =
      completeJob(
        enqueueJob(
          "Verify the weekly backup",
          "Alice-Bot",
          {
            owningJobId:
              "enterprise-1:backups",
          }
        ).id,
        "Backup verified"
      );

    expect(
      queueScheduledTaskOccurrence(
        completed,
        "Sam-Bot",
        "Schedule reassigned Sam-Bot.",
        100,
        101
      )
    ).toMatchObject({
      owningJobId:
        "enterprise-1:backups",
      worker:
        "Sam-Bot",
      status:
        "queued",
      scheduledOccurrenceAt:
        100,
      startedAt:
        undefined,
    });
  });
});

describe("listJobs", () => {
  it("lists queued jobs", () => {
    enqueueJob(
      "First task",
      "Worker One"
    );

    enqueueJob(
      "Second task",
      "Worker Two"
    );

    expect(
      listJobs().map(
        (job) => job.task
      )
    ).toEqual([
      "First task",
      "Second task",
    ]);
  });
});

describe("getJob", () => {
  it("gets a job by id", () => {
    const job =
      enqueueJob(
        "Write a short article",
        "Writer AI"
      );

    expect(
      getJob(job.id)
    ).toEqual(job);
  });

  it("returns undefined for a missing job", () => {
    expect(
      getJob(
        "missing-job"
      )
    ).toBeUndefined();
  });
});

describe("nextJob", () => {
  it("returns the first queued job", () => {
    const first =
      enqueueJob(
        "First task",
        "Worker One"
      );

    enqueueJob(
      "Second task",
      "Worker Two"
    );

    expect(
      nextJob()?.id
    ).toBe(first.id);
  });

  it("skips running jobs", () => {
    const first =
      enqueueJob(
        "First task",
        "Worker One"
      );

    const second =
      enqueueJob(
        "Second task",
        "Worker Two"
      );

    startJob(
      first.id
    );

    expect(
      nextJob()?.id
    ).toBe(second.id);
  });
});

describe("hasWorkInFlight", () => {
  it("is false with nothing queued", () => {
    expect(
      hasWorkInFlight()
    ).toBe(false);
  });

  it("is true while a job is queued, and while it is running", () => {
    const job =
      enqueueJob(
        "A task",
        "Worker One"
      );

    expect(
      hasWorkInFlight()
    ).toBe(true);

    startJob(
      job.id
    );

    expect(
      hasWorkInFlight()
    ).toBe(true);
  });

  it("is false once the job is done", () => {
    const job =
      enqueueJob(
        "A task",
        "Worker One"
      );

    startJob(
      job.id
    );

    completeJob(
      job.id,
      "Done"
    );

    expect(
      hasWorkInFlight()
    ).toBe(false);
  });

  it("is false while a job rests on a person", () => {
    const job =
      enqueueJob(
        "A task",
        "Worker One"
      );

    startJob(
      job.id
    );

    requestJobHumanTask(
      job.id
    );

    // The work has stopped and the next thing typed is what releases it, so a
    // wait that counted this would sit out its whole ceiling for nothing.
    expect(
      hasWorkInFlight()
    ).toBe(false);
  });

  it("is false for a dormant recurring job", () => {
    enqueueScheduledJob(
      "A recurring task"
    );

    // Waiting on one of these would be waiting forever.
    expect(
      hasWorkInFlight()
    ).toBe(false);
  });
});

describe("requestJobHumanTask", () => {
  it("marks a job as awaiting human task completion", () => {
    const job =
      enqueueJob(
        "Create an article from the research",
        "Human Creator"
      );

    const updated =
      requestJobHumanTask(
        job.id
      );

    expect(updated.status).toBe(
      "awaiting_human_task"
    );

    expect(
      typeof updated.approvalRequestedAt
    ).toBe("number");
  });

  it("throws for a missing job", () => {
    expect(() =>
      requestJobHumanTask(
        "missing-job"
      )
    ).toThrow(
      "Task not found: missing-job"
    );
  });
});

describe("completeJobFromHumanTask", () => {
  it("completes a job from human task evidence", () => {
    const job =
      enqueueJob(
        "Create an article from the research",
        "Human Creator"
      );

    requestJobHumanTask(
      job.id
    );

    const updated =
      completeJobFromHumanTask(
        job.id,
        "Created the article draft."
      );

    expect(updated).toMatchObject({
      id:
        job.id,
      status:
        "completed",
      rawOutput:
        "Created the article draft.",
      output:
        "Created the article draft.",
    });

    expect(
      typeof updated.completedAt
    ).toBe("number");
  });

  it("throws when the job is not awaiting human task completion", () => {
    const job =
      enqueueJob(
        "Create an article from the research",
        "Human Creator"
      );

    expect(() =>
      completeJobFromHumanTask(
        job.id,
        "Done."
      )
    ).toThrow(
      `Task is not awaiting Human Task completion: ${job.id}`
    );
  });
});

describe("requestJobRevision", () => {
  it("marks a job as awaiting revision", () => {
    const job =
      enqueueJob(
        "Create an article from the research",
        "Human Creator"
      );

    requestJobHumanTask(
      job.id
    );

    const updated =
      requestJobRevision(
        job.id,
        "Research is inadequate. Please find stronger evidence."
      );

    expect(updated).toMatchObject({
      id:
        job.id,
      status:
        "awaiting_revision",
      revisionInstructions:
        "Research is inadequate. Please find stronger evidence.",
    });

    expect(
      typeof updated.revisionRequestedAt
    ).toBe("number");
  });

  it("stores revision instructions without completing or failing the job", () => {
    const job =
      enqueueJob(
        "Create an article from the research",
        "Human Creator"
      );

    const updated =
      requestJobRevision(
        job.id,
        "Add stronger evidence and 3 concrete examples."
      );

    expect(updated.status).toBe(
      "awaiting_revision"
    );

    expect(
      updated.revisionInstructions
    ).toBe(
      "Add stronger evidence and 3 concrete examples."
    );

    expect(
      updated.completedAt
    ).toBeUndefined();

    expect(
      updated.failedAt
    ).toBeUndefined();

    expect(
      updated.error
    ).toBeUndefined();
  });

  it("throws for a missing job", () => {
    expect(() =>
      requestJobRevision(
        "missing-job",
        "Please revise."
      )
    ).toThrow(
      "Task not found: missing-job"
    );
  });
});

describe("createReadableJobId", () => {
  it("starts at task-1 on an empty installation", () => {
    expect(createReadableJobId([])).toBe("task-1");
  });

  it("continues from the highest number already issued", () => {
    expect(createReadableJobId(["task-1", "task-2"])).toBe("task-3");
  });

  it("does not reuse a number after an earlier Task is removed", () => {
    expect(createReadableJobId(["task-3"])).toBe("task-4");
  });

  it("ignores ids issued before Tasks were readable", () => {
    expect(
      createReadableJobId([
        "6b105cdb-785e-426a-bb25-aa6657cb5c23",
        "task-1",
      ])
    ).toBe("task-2");
  });

  it("is not fooled by an id that merely starts like one", () => {
    expect(createReadableJobId(["task-1-copy", "task-2x"])).toBe("task-1");
  });
});

describe("a Task's named work and cancelling", () => {
  it("workId is set once: replaceJob throws on change", () => {
    const job = enqueueJob("A task", "Worker One", { workId: "work-a" });
    expect(job.workId).toBe("work-a");
    expect(() => replaceJob({ ...job, workId: "work-b" })).toThrow("A Task's work can't change");
    expect(() => replaceJob({ ...job, workId: undefined })).toThrow("A Task's work can't change");
    expect(getJob(job.id)?.workId).toBe("work-a");
    const unbound = enqueueJob("Another task", "Worker One");
    expect(() => replaceJob({ ...unbound, workId: "work-a" })).toThrow("A Task's work can't change");
  });

  it("cancelJob only from statuses that haven't started", () => {
    expect(CANCELLABLE_JOB_STATUSES).not.toContain("running");
    const queued = enqueueJob("A task", "Worker One");
    const cancelled = cancelJob(queued.id, "Cancelled: no AI.");
    expect(cancelled).toMatchObject({ status: "cancelled", error: "Cancelled: no AI.", cancelledAt: expect.any(Number) });
    expect(() => cancelJob(queued.id, "again")).toThrow();
    const running = startJob(enqueueJob("Running task", "Worker One").id);
    expect(() => cancelJob(running.id, "no")).toThrow();
    const done = completeJob(startJob(enqueueJob("Done task", "Worker One").id).id, "Done");
    expect(() => markJobCancelled(done, "no", 1)).toThrow();
  });

  it("hasWorkInFlight ignores cancelled", () => {
    const job = enqueueJob("A task", "Worker One");
    expect(hasWorkInFlight()).toBe(true);
    cancelJob(job.id, "Cancelled.");
    expect(hasWorkInFlight()).toBe(false);
  });

  it("workId survives restart through jobRepository", () => {
    const job = enqueueJob("A task", "Worker One", { workId: "work-a" });
    cancelJob(job.id, "Cancelled.");
    expect(loadJobs().find((one) => one.id === job.id)).toMatchObject({ workId: "work-a", status: "cancelled", cancelledAt: expect.any(Number) });
  });
});
