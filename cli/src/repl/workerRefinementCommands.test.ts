import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  addWorker,
  clearWorkers,
  getWorker,
} from "../control/workers";

import {
  formatRefineWorkerUsage,
  handleRefineWorkerCommand,
} from "./workerRefinementCommands";

beforeEach(() => {
  clearWorkers();
  vi.clearAllMocks();
});

describe("workerRefinementCommands", () => {
  it("formats refine-worker usage", () => {
    expect(
      formatRefineWorkerUsage()
    ).toBe(
      '/refine-worker <worker-name> "<refinement instructions>"'
    );
  });

  it("prints usage when worker name is missing", () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => undefined
      );

    handleRefineWorkerCommand([]);

    expect(log).toHaveBeenCalledWith(
      'Usage: /refine-worker <worker-name> "<refinement instructions>"'
    );
  });

  it("prints not found when worker does not exist", () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => undefined
      );

    handleRefineWorkerCommand([
      "missing-worker",
      "Be more specific.",
    ]);

    expect(log).toHaveBeenCalledWith(
      "worker not found: missing-worker"
    );
  });

  it("updates worker refinement", () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => undefined
      );

    addWorker({
      name: "auto-designer",
      kind: "ai",
      archetype: "creator",
      model: "llama3.2",
      trust: false,
      capabilities: [
        "llm",
      ],
      run: function* (ctx: any) {
        return ctx;
      },
    });

    handleRefineWorkerCommand([
      "auto-designer",
      "Produce detailed garment specs.",
    ]);

    expect(
      getWorker(
        "auto-designer"
      )?.refinement
    ).toBe(
      "Produce detailed garment specs."
    );

    expect(log).toHaveBeenCalledWith(
      "worker refined: auto-designer"
    );
  });
});