import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type {
  Job,
} from "./jobQueue";

import {
  addCapabilityReceipt,
  clearCapabilityReceipts,
  createCapabilityReceipt,
  createHash,
  listCapabilityReceipts,
} from "./capabilityReceiptStore";

beforeEach(() => {
  clearCapabilityReceipts();
});

/**
 * Creates a completed capability job.
 *
 * @returns Completed job fixture.
 *
 * PURE: No side effects.
 */
function createCompletedJob():
  Job {
  return {
    id: "job-1",
    task:
      "Research AI safety",

    worker:
      "researcher",

    requiredCapabilities: [
      "research" as any,
    ],

    status:
      "completed",

    rawOutput:
      "Research results",

    output:
      "Research results",

    createdAt: 1,

    startedAt: 10,

    completedAt: 30,
  };
}

describe(
  "createHash",
  () => {
    it(
      "creates deterministic hashes",
      () => {
        expect(
          createHash("hello")
        ).toBe(
          createHash("hello")
        );

        expect(
          createHash("hello")
        ).not.toBe(
          createHash("world")
        );
      }
    );
  }
);

describe(
  "createCapabilityReceipt",
  () => {
    it(
      "creates capability receipts",
      () => {
        const receipt =
          createCapabilityReceipt(
            createCompletedJob()
          );

        expect(
          receipt
        ).toMatchObject({
          jobId: "job-1",
          capability:
            "research",
          worker:
            "researcher",
          status:
            "completed",
          durationMs: 20,
        });

        expect(
          receipt?.inputHash
        ).toBeDefined();

        expect(
          receipt?.outputHash
        ).toBeDefined();
      }
    );

    it(
      "returns undefined when job has no capability",
      () => {
        const job =
          createCompletedJob();

        job.requiredCapabilities =
          undefined;

        expect(
          createCapabilityReceipt(
            job
          )
        ).toBeUndefined();
      }
    );
  }
);

describe(
  "capability receipt store",
  () => {
    it(
      "stores receipts",
      () => {
        const receipt =
          createCapabilityReceipt(
            createCompletedJob()
          );

        expect(
          receipt
        ).toBeDefined();

        addCapabilityReceipt(
          receipt!
        );

        expect(
          listCapabilityReceipts()
        ).toHaveLength(1);
      }
    );
  }
);