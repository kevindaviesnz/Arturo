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
  createCapabilityAttestation,
} from "./capabilityAttestation";

import {
  addCapabilityAttestation,
  clearCapabilityAttestations,
  listCapabilityAttestations,
} from "./capabilityAttestationStore";

/**
 * Creates completed capability job fixture.
 *
 * PURE: No side effects.
 */
function createCompletedJob(): Job {
  return {
    id: "job-1",
    task: "Research AI agents",
    worker: "researcher",
    requiredCapabilities: [
      "research" as any,
    ],
    status: "completed",
    rawOutput:
      "AI agents coordinate tools.",
    output:
      "AI agents coordinate tools.",
    createdAt: 1,
    completedAt: 2,
  };
}

/**
 * Creates failed capability job fixture.
 *
 * PURE: No side effects.
 */
function createFailedJob(): Job {
  return {
    id: "job-2",
    task: "Research failure",
    worker: "researcher",
    requiredCapabilities: [
      "research" as any,
    ],
    status: "failed",
    rawOutput:
      "Partial output",
    output:
      "Partial output",
    error:
      "Timeout",
    createdAt: 1,
    failedAt: 2,
  };
}

beforeEach(() => {
  clearCapabilityAttestations();
});

describe(
  "createCapabilityAttestation",
  () => {
    it(
      "creates attestation for completed capability job",
      () => {
        const attestation =
          createCapabilityAttestation(
            createCompletedJob(),
            "llama3.2"
          );

        expect(
          attestation
        ).toMatchObject({
          capability:
            "research",
          worker:
            "researcher",
          model:
            "llama3.2",
          status:
            "completed",
        });

        expect(
          attestation?.taskHash
        ).toBeDefined();

        expect(
          attestation?.outputHash
        ).toBeDefined();
      }
    );

    it(
      "creates attestation for failed capability job",
      () => {
        const attestation =
          createCapabilityAttestation(
            createFailedJob(),
            "llama3.2"
          );

        expect(
          attestation
        ).toMatchObject({
          capability:
            "research",
          status:
            "failed",
        });
      }
    );

    it(
      "returns undefined when no capability exists",
      () => {
        const attestation =
          createCapabilityAttestation(
            {
              ...createCompletedJob(),
              requiredCapabilities:
                undefined,
            },
            "llama3.2"
          );

        expect(
          attestation
        ).toBeUndefined();
      }
    );

    it(
      "produces stable hashes",
      () => {
        const first =
          createCapabilityAttestation(
            createCompletedJob(),
            "llama3.2"
          );

        const second =
          createCapabilityAttestation(
            createCompletedJob(),
            "llama3.2"
          );

        expect(
          first?.taskHash
        ).toBe(
          second?.taskHash
        );

        expect(
          first?.outputHash
        ).toBe(
          second?.outputHash
        );
      }
    );
  }
);

describe(
  "capabilityAttestationStore",
  () => {
    it(
      "stores attestations",
      () => {
        const attestation =
          createCapabilityAttestation(
            createCompletedJob(),
            "llama3.2"
          );

        addCapabilityAttestation(
          attestation!
        );

        expect(
          listCapabilityAttestations()
        ).toHaveLength(1);

        expect(
          listCapabilityAttestations()[0]
        ).toMatchObject({
          capability:
            "research",
          model:
            "llama3.2",
        });
      }
    );
  }
);