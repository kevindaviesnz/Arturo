import {
  describe,
  expect,
  it,
} from "vitest";

import {
  assignQueuedJobsToWorker,
  removeWorkerFlagPairs,
  registerWorkerFromArgs,
} from "./workerRegistrationCommands";

import {
  clearWorkers,
} from "../control/workers";

import {
  clearJobs,
  enqueueJob,
  listJobs,
} from "../runtime/jobQueue";

import {
  beforeEach,
  afterEach,
} from "vitest";

beforeEach(() => {
  clearJobs();
  clearWorkers();
});

afterEach(() => {
  clearJobs();
  clearWorkers();
});

describe("workerRegistrationCommands", () => {
  it("derives AI Worker capabilities from its archetype", () => {
    const result = registerWorkerFromArgs([
      "Writing Assistant",
      "--archetype",
      "assistant",
    ]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.worker.model).toBe(
        process.env.ARTURO_LLM_MODEL ??
        "llama3.2:latest"
      );
      expect(result.worker.capabilities).toEqual(
        expect.arrayContaining([
          "llm",
          "writing",
          "summarisation",
          "human-contact",
        ])
      );
    }
  });

  it("rejects direct capability grants", () => {
    const result = registerWorkerFromArgs([
      "Product Safety Reasoning Worker",
      "--archetype",
      "assistant",
      "--capabilities",
      "safety",
      "--model",
      "local",
    ]);

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining(
        "derived from the selected archetype"
      ),
    });
  });

  it("rejects a model switch for Human Workers", () => {
    const result = registerWorkerFromArgs([
      "Design Approver",
      "--type",
      "human",
      "--archetype",
      "reviewer",
      "--model",
      "local",
    ]);

    expect(result).toEqual({
      ok: false,
      message: expect.stringContaining("Human Workers do not use AI models"),
    });
  });

  it("assigns queued Runtime work to a matching Worker", () => {
    const job = enqueueJob(
      "Assess toy safety evidence.",
      undefined,
      {
        requiredCapabilities: [
          "safety",
        ],
      }
    );

    expect(
      assignQueuedJobsToWorker({
        name: "product-safety-worker",
        kind: "ai",
        capabilities: [
          "safety",
        ],
        run: function* () {
          return undefined;
        },
      })
    ).toBe(1);

    expect(
      listJobs().find(
        (candidate) => candidate.id === job.id
      )?.worker
    ).toBe("product-safety-worker");
  });

  it("removes multiple Worker flag pairs", () => {
    expect(
      removeWorkerFlagPairs(
        [
          "Kevin",
          "--type",
          "human",
          "--availability",
          "available",
        ],
        [
          "--type",
          "--availability",
        ]
      )
    ).toEqual([
      "Kevin",
    ]);
  });

  it("removes equals-form Worker flags", () => {
    expect(
      removeWorkerFlagPairs(
        [
          "Kevin",
          "--type=human",
          "--availability=available",
        ],
        [
          "--type",
          "--availability",
        ]
      )
    ).toEqual([
      "Kevin",
    ]);
  });
});
