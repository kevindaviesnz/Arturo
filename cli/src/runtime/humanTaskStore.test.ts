import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  blockHumanTask,
  clearHumanTasks,
  completeHumanTask,
  createHumanTask,
  getHumanTask,
  listHumanTasks,
  requestHumanTaskRevision,
} from "./humanTaskStore";

beforeEach(() => {
  clearHumanTasks();
});

describe("createHumanTask", () => {
  it("creates an open human task", () => {
    const task =
      createHumanTask({
        title:
          "Interview startup CTOs",
        owner:
          "Founder",
        purpose:
          "Validate Arturo",
        instructions:
          "Interview 5 startup CTOs.",
        completionEvidence:
          "Summarise interview evidence.",
        workflowRunId:
          "run-1",
        sourceJobId:
          "job-1",
      });

    expect(task).toMatchObject({
      id:
        "human-task-1",
      title:
        "Interview startup CTOs",
      owner:
        "Founder",
      status:
        "open",
      workflowRunId:
        "run-1",
      sourceJobId:
        "job-1",
    });

    expect(
      typeof task.createdAt
    ).toBe("number");
  });

  it("creates deterministic sequential ids", () => {
    const first =
      createHumanTask({
        title:
          "First task",
        instructions:
          "Do the first thing.",
      });

    const second =
      createHumanTask({
        title:
          "Second task",
        instructions:
          "Do the second thing.",
      });

    expect(first.id).toBe(
      "human-task-1"
    );

    expect(second.id).toBe(
      "human-task-2"
    );
  });
});

describe("listHumanTasks", () => {
  it("lists human tasks in creation order", () => {
    createHumanTask({
      title:
        "First task",
      instructions:
        "Do the first thing.",
    });

    createHumanTask({
      title:
        "Second task",
      instructions:
        "Do the second thing.",
    });

    expect(
      listHumanTasks().map(
        (task) => task.title
      )
    ).toEqual([
      "First task",
      "Second task",
    ]);
  });
});

describe("getHumanTask", () => {
  it("gets a human task by id", () => {
    const task =
      createHumanTask({
        title:
          "Interview startup CTOs",
        instructions:
          "Interview 5 startup CTOs.",
      });

    expect(
      getHumanTask(task.id)
    ).toEqual(task);
  });

  it("returns undefined for a missing task", () => {
    expect(
      getHumanTask(
        "missing-task"
      )
    ).toBeUndefined();
  });
});

describe("completeHumanTask", () => {
  it("completes a human task with evidence notes", () => {
    const task =
      createHumanTask({
        title:
          "Interview startup CTOs",
        instructions:
          "Interview 5 startup CTOs.",
      });

    const updated =
      completeHumanTask(
        task.id,
        "Interviewed 5 CTOs."
      );

    expect(updated).toMatchObject({
      id:
        task.id,
      status:
        "completed",
      notes:
        "Interviewed 5 CTOs.",
      blockReason:
        undefined,
      blockedAt:
        undefined,
    });

    expect(
      typeof updated?.completedAt
    ).toBe("number");
  });

  it("returns undefined for a missing task", () => {
    expect(
      completeHumanTask(
        "missing-task",
        "Done."
      )
    ).toBeUndefined();
  });
});

describe("blockHumanTask", () => {
  it("blocks a human task with a reason", () => {
    const task =
      createHumanTask({
        title:
          "Interview startup CTOs",
        instructions:
          "Interview 5 startup CTOs.",
      });

    const updated =
      blockHumanTask(
        task.id,
        "Could not contact CTOs."
      );

    expect(updated).toMatchObject({
      id:
        task.id,
      status:
        "blocked",
      blockReason:
        "Could not contact CTOs.",
    });

    expect(
      typeof updated?.blockedAt
    ).toBe("number");
  });

  it("returns undefined for a missing task", () => {
    expect(
      blockHumanTask(
        "missing-task",
        "Blocked."
      )
    ).toBeUndefined();
  });
});

describe("requestHumanTaskRevision", () => {
  it("marks a human task as needing revision", () => {
    const task =
      createHumanTask({
        title:
          "Create article",
        owner:
          "Human Creator",
        instructions:
          "Create an article from the research.",
        workflowRunId:
          "run-1",
        sourceJobId:
          "job-2",
      });

    const updated =
      requestHumanTaskRevision(
        task.id,
        "Research is inadequate. Please find stronger evidence."
      );

    expect(updated).toMatchObject({
      id:
        task.id,
      status:
        "needs_revision",
      revisionInstructions:
        "Research is inadequate. Please find stronger evidence.",
      workflowRunId:
        "run-1",
      sourceJobId:
        "job-2",
    });

    expect(
      typeof updated?.revisionRequestedAt
    ).toBe("number");
  });

  it("stores revision instructions without completing or blocking the task", () => {
    const task =
      createHumanTask({
        title:
          "Create article",
        instructions:
          "Create an article from the research.",
      });

    const updated =
      requestHumanTaskRevision(
        task.id,
        "Add 3 concrete examples and cite stronger evidence."
      );

    expect(updated?.status).toBe(
      "needs_revision"
    );

    expect(
      updated?.revisionInstructions
    ).toBe(
      "Add 3 concrete examples and cite stronger evidence."
    );

    expect(
      updated?.completedAt
    ).toBeUndefined();

    expect(
      updated?.blockedAt
    ).toBeUndefined();

    expect(
      updated?.blockReason
    ).toBeUndefined();
  });

  it("returns undefined for a missing task", () => {
    expect(
      requestHumanTaskRevision(
        "missing-task",
        "Please revise."
      )
    ).toBeUndefined();
  });

  it("stores structured handoff context", () => {
  const task =
    createHumanTask({
      title:
        "Create article",
      owner:
        "Human Creator",
      fromWorker:
        "AI Researcher",
      toWorker:
        "Human Creator",
      instructions:
        "Create an article from the research.",
      inputSummary:
        "Research on AI-native startup workflows.",
      inputArtifact:
        "Full research output.",
      requestedAction:
        "Write a 900-word article.",
      acceptanceCriteria: [
        "Use plain English.",
        "Mention review loops.",
      ],
    });

  expect(task).toMatchObject({
    fromWorker:
      "AI Researcher",
    toWorker:
      "Human Creator",
    inputSummary:
      "Research on AI-native startup workflows.",
    inputArtifact:
      "Full research output.",
    requestedAction:
      "Write a 900-word article.",
    acceptanceCriteria: [
      "Use plain English.",
      "Mention review loops.",
    ],
  });
});
});