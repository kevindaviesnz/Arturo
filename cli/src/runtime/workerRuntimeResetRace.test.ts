import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearJobs,
  enqueueJob,
  getJob,
  listJobs,
  startJob,
} from "./jobQueue";

import {
  executeWorkerJobWithCapabilityTimeout,
} from "./workerRuntime";

import {
  addWorker,
  clearWorkers,
} from "../control/workers";

// An AI Worker's work is a model call — `executeWorkerJob` never runs the
// generator below — so without this the test reached a live Ollama, took about
// a second, and timed out at five whenever the model happened to be busy. It
// also meant the failure path it claims to exercise was never forced: the call
// mostly *succeeded*.
vi.mock("../llm/llmClient", () => ({
  resolveConfiguredProvider: () => ({ provider: "ollama", routingMode: "single" }),
  generateWithConfiguredLlm: () => Promise.reject(new Error("model unavailable")),
  generateWithPaidEscalation: () => Promise.reject(new Error("model unavailable")),
  generateWithModelProfile: () => Promise.reject(new Error("model unavailable")),
}));

/**
 * /reset clears the Task store, but the Worker runtime may already be part-way
 * through a Task it picked up beforehand — a local model call takes seconds.
 * When execution finishes, the runtime tries to record the outcome against a
 * Task that no longer exists.
 *
 * Observed: the operator ran /reset and got a raw Node stack trace in the
 * terminal — "Worker runtime error Error: Task not found: task-1" with five
 * frames of internal paths. Nothing was wrong that the operator could act on,
 * and nothing else in the product speaks that way.
 */
describe("a Task that vanishes mid-execution", () => {
  beforeEach(() => {
    clearJobs();
    clearWorkers();
  });
  afterEach(() => {
    clearJobs();
    clearWorkers();
    vi.restoreAllMocks();
  });

  /** Registers an AI Worker. Its work fails, because the model call above does. */
  function addFailingWorker(name: string): void {
    addWorker({
      name,
      kind: "ai",
      capabilities: ["llm"],
      run: function* () {
        throw new Error("model unavailable");
      },
    });
  }

  it("does not throw when the Task was deleted before the outcome is recorded", async () => {
    addFailingWorker("Analyst");
    const queued = enqueueJob("Do a thing", "Analyst", {
      requiredCapabilities: ["llm"],
    });
    const running = startJob(queued.id);

    // /reset lands while the model call is in flight.
    clearJobs();

    await expect(
      executeWorkerJobWithCapabilityTimeout(running, "llama3.2:latest")
    ).resolves.not.toThrow();

    // Nothing to record, and nothing resurrected.
    expect(getJob(queued.id)).toBeUndefined();
    expect(listJobs()).toHaveLength(0);
  });

  it("still records the outcome when the Task is still there", async () => {
    addFailingWorker("Analyst");
    const queued = enqueueJob("Do a thing", "Analyst", {
      requiredCapabilities: ["llm"],
    });
    const running = startJob(queued.id);

    await executeWorkerJobWithCapabilityTimeout(running, "llama3.2:latest");

    // The Task is still there and reached a terminal state, rather than being
    // left running forever.
    const settled = getJob(queued.id);
    expect(settled).toBeDefined();
    expect(["completed", "failed"]).toContain(settled?.status);
  });
});
