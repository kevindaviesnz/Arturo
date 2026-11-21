import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createCapabilityAttestation,
} from "./capabilityAttestation";

import {
  addCapabilityAttestation,
  clearCapabilityAttestations,
  listCapabilityAttestations,
} from "./capabilityAttestationStore";

import type {
  Job,
} from "./jobQueue";

/**
 * Creates a completed capability job fixture.
 *
 * @returns Job fixture.
 *
 * PURE: No side effects.
 */
function createJob(): Job {
  return {
    id: "job-1",
    task: "Research AI safety",
    worker: "researcher",
    requiredCapabilities: [
      "research" as any,
    ],
    status: "completed",
    rawOutput: "Research results",
    output: "Research results",
    createdAt: 1,
  };
}

beforeEach(() => {
  clearCapabilityAttestations();
});

describe("capability attestation store", () => {
  it("stores attestations", () => {
    const attestation =
      createCapabilityAttestation(
        createJob(),
        "llama3.2"
      );

    expect(attestation).toBeDefined();

    addCapabilityAttestation(
      attestation!
    );

    expect(
      listCapabilityAttestations()
    ).toHaveLength(1);
  });

  it("returns immutable list copy", () => {
    const attestation =
      createCapabilityAttestation(
        createJob(),
        "llama3.2"
      );

    addCapabilityAttestation(
      attestation!
    );

    const listed =
      listCapabilityAttestations();

    listed.length = 0;

    expect(
      listCapabilityAttestations()
    ).toHaveLength(1);
  });

  it("clears attestations", () => {
    const attestation =
      createCapabilityAttestation(
        createJob(),
        "llama3.2"
      );

    addCapabilityAttestation(
      attestation!
    );

    clearCapabilityAttestations();

    expect(
      listCapabilityAttestations()
    ).toEqual([]);
  });
});