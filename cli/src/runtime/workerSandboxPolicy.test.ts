import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Worker,
} from "../control/workers";

import type {
  Job,
} from "./jobQueue";

import {
  hostEffectCapabilitiesForJob,
  resolveWorkerSandboxMode,
  validateWorkerSandboxForJob,
} from "./workerSandboxPolicy";

const shellJob: Job = {
  id: "task-1",
  task: "Run a shell command",
  worker: "operator",
  requiredCapabilities: [
    "shell-execute",
  ],
  status: "queued",
  createdAt: 1,
};

const aiWorker: Worker<unknown, unknown> = {
  name: "operator",
  kind: "ai",
  run: function* (input: unknown) {
    return input;
  },
};

describe("workerSandboxPolicy", () => {
  it("defaults to requiring a sandbox", () => {
    expect(
      resolveWorkerSandboxMode({})
    ).toBe("required");
  });

  it("finds host filesystem and process capabilities on a Job", () => {
    expect(
      hostEffectCapabilitiesForJob(shellJob)
    ).toEqual([
      "shell-execute",
    ]);
  });

  it("fails closed for AI host capability work by default", () => {
    const violation =
      validateWorkerSandboxForJob(
        shellJob,
        aiWorker,
        {}
      );

    expect(
      violation
    ).toMatchObject({
      capabilities: [
        "shell-execute",
      ],
    });

    expect(
      violation?.message
    ).toContain(
      "Worker sandbox is required"
    );
  });

  it("allows explicit trusted-host development mode", () => {
    expect(
      validateWorkerSandboxForJob(
        shellJob,
        aiWorker,
        {
          ARTURO_WORKER_SANDBOX_MODE:
            "trusted-host-dev",
        }
      )
    ).toBeUndefined();
  });

  it("rejects unknown sandbox modes", () => {
    expect(() =>
      resolveWorkerSandboxMode({
        ARTURO_WORKER_SANDBOX_MODE:
          "disabled",
      })
    ).toThrow(
      "ARTURO_WORKER_SANDBOX_MODE must be required or trusted-host-dev"
    );
  });
});
