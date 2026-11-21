import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearHumanTasks, listHumanTasks } from "../runtime/humanTaskStore";
import { clearJobs, enqueueJob, replaceJob } from "../runtime/jobQueue";
import { clearResultSignOffs, recordResultSignOff } from "../runtime/resultSignOff";
import { handleCreateTaskCommand } from "./humanTaskCommands";

const said = (run: () => void): string => {
  const lines: string[] = [];
  const spy = vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  });
  try {
    run();
  } finally {
    spy.mockRestore();
  }
  return lines.join("\n");
};

describe("handing a brief to the designer", () => {
  const reset = () => {
    clearJobs();
    clearHumanTasks();
    clearResultSignOffs();
    clearWorkers();
  };
  beforeEach(() => {
    reset();
    addWorker(createHumanWorker("Kevin", "guardian"));
  });
  afterEach(reset);

  it("waits for the owner to accept an AI-written brief before a person is given it", () => {
    const brief = replaceJob({
      ...enqueueJob("Write one brief.", "Design Brief Creator", { requiredCapabilities: ["writing"] }),
      status: "completed",
      output: "Evidence status: UNVERIFIED MODEL SYNTHESIS\nExternal tools used: none\n\nBallet flats.",
    });
    const create = () =>
      handleCreateTaskCommand(["Draw the ballet flats", "Draw it from the brief.", "--assign-to", "Kevin", "--follows", brief.id]);

    expect(said(create)).toContain("nobody has signed it off, so it was not handed to a person");
    expect(listHumanTasks()).toHaveLength(0);

    recordResultSignOff(brief, "Kevin");
    said(create);

    expect(listHumanTasks()).toHaveLength(1);
  });
});
