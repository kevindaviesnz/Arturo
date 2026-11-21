import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  appendRuntimeEvent,
  createRuntimeEventLog,
} from "./runtimeEventLog";

import {
  clearRuntimeEventLog,
  saveRuntimeEventLog,
} from "../storage/runtimeEventRepository";

import {
  clearRuntimeReplayAttestations,
  loadRuntimeReplayAttestations,
} from "../storage/runtimeReplayAttestationRepository";

import {
  verifyRuntimeReplayAttestationSignature,
} from "./runtimeReplayAttestation";

import {
  createAndSaveRuntimeReplayAttestation,
  createSignedRuntimeReplayAttestation,
} from "./runtimeReplayAttestationStore";

/**
 * Creates runtime event log fixture.
 *
 * @returns Runtime event log fixture.
 *
 * PURE: No side effects.
 */
function createRuntimeLogFixture() {
  return appendRuntimeEvent(
    createRuntimeEventLog(),
    {
      id: "event-1",
      type: "job.completed",
      level: "success",
      message: "Job completed",
      timestamp: 1000,
      payload: {
        jobId: "job-1",
      },
    }
  );
}

/**
 * Clears replay attestation store test state.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Clears runtime event log.
 * - Clears persisted replay attestations.
 */
function clearReplayAttestationStoreTestState():
  void {
  clearRuntimeEventLog();
  clearRuntimeReplayAttestations();
}

beforeEach(() => {
  clearReplayAttestationStoreTestState();
});

afterEach(() => {
  clearReplayAttestationStoreTestState();
});

describe("runtimeReplayAttestationStore", () => {
  it("creates signed replay attestation from persisted events", () => {
    saveRuntimeEventLog(
      createRuntimeLogFixture()
    );

    const attestation =
      createSignedRuntimeReplayAttestation(
        "secret",
        100
      );

    expect(attestation).toMatchObject({
      eventCount: 1,
      generatedAt: 100,
    });

    expect(
      attestation.replayHash
    ).toMatch(
      /^[a-f0-9]{64}$/
    );

    expect(
      verifyRuntimeReplayAttestationSignature(
        {
          replayHash:
            attestation.replayHash,
          eventCount:
            attestation.eventCount,
          generatedAt:
            attestation.generatedAt,
        },
        "secret",
        attestation.signature
      )
    ).toBe(true);
  });

  it("creates and saves replay attestation", () => {
    saveRuntimeEventLog(
      createRuntimeLogFixture()
    );

    const attestation =
      createAndSaveRuntimeReplayAttestation(
        "secret",
        100
      );

    expect(
      loadRuntimeReplayAttestations()
    ).toEqual([
      attestation,
    ]);
  });
});