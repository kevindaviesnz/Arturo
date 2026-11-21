import { beforeEach, describe, expect, it } from "vitest";
import { addWorker, clearWorkers, isWorkerAvailableForNewTask, selectAiWorkerForCapabilities, selectWorkerForCapabilities } from "./workers";
beforeEach(clearWorkers);
describe("Worker availability", () => {
  it("treats legacy missing availability as available, busy and offline as unable to accept new work", () => {
    expect(isWorkerAvailableForNewTask(undefined)).toBe(false);
    for (const availability of [undefined, "available", "busy", "offline"] as const) {
      expect(isWorkerAvailableForNewTask({ availability })).toBe(availability === undefined || availability === "available");
    }
  });
  it("all central selectors skip busy and offline Workers", () => {
    for (const availability of ["busy", "offline", "available"] as const) {
      addWorker({ name: availability, kind: "ai", availability, capabilities: ["conversion"], run: function* (input) { return input; } });
    }
    expect(selectWorkerForCapabilities(["conversion"])?.name).toBe("available");
    expect(selectAiWorkerForCapabilities(["conversion"])?.name).toBe("available");
  });
});
