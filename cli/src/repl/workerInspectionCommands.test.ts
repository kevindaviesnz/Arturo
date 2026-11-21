import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearWorkers,
  getWorker,
  registerAiWorker,
} from "../control/workers";

import {
  formatWorkerInspection,
  handleWorkersCommand,
} from "./workerInspectionCommands";

beforeEach(() => {
  clearWorkers();
});

describe("workerInspectionCommands", () => {
  it("shows archetype and stored specialization", () => {
    const body = formatWorkerInspection({
      name: "Product Evidence Analyst",
      displayName: "Product Evidence Analyst",
      kind: "ai",
      archetype: "analyst",
      capabilities: ["llm", "analysis"],
      refinement: "Treat Arturo as a software Enterprise.",
      run: function* (input: unknown) {
        return input;
      },
    });

    expect(body).toContain("Archetype:     analyst");
    expect(body).toContain(
      "Specialization: Treat Arturo as a software Enterprise."
    );
  });

  it("removes a Worker through the primary Workers command", () => {
    registerAiWorker(
      "Temporary Writer",
      "creator"
    );
    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () =>
          undefined
      );

    handleWorkersCommand([
      "remove",
      "Temporary Writer",
    ]);

    expect(
      getWorker(
        "Temporary Writer"
      )
    ).toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        "Removed Worker: Temporary Writer"
      )
    );
    log.mockRestore();
  });
});
