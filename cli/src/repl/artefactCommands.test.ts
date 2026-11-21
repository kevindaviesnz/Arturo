import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveArtefactSourceLinks,
} from "./artefactCommands";

describe("artefact source terminology", () => {
  it("uses --task for bounded Task links", () => {
    expect(
      resolveArtefactSourceLinks([
        "--task",
        "task-123",
      ])
    ).toEqual({
      sourceJobId:
        "task-123",
      sourceHumanTaskId:
        undefined,
    });
  });

  it("uses --human-task for Human Task links", () => {
    expect(
      resolveArtefactSourceLinks([
        "--human-task",
        "human-task-123",
      ])
    ).toEqual({
      sourceJobId:
        undefined,
      sourceHumanTaskId:
        "human-task-123",
    });
  });

  it("retains the older --job execution ID alias", () => {
    expect(
      resolveArtefactSourceLinks([
        "--job",
        "old-job-123",
      ])
    ).toEqual({
      sourceJobId:
        "old-job-123",
      sourceHumanTaskId:
        undefined,
    });
  });
});
