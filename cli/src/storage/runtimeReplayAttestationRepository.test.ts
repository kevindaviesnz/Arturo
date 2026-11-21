import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type {
  RuntimeReplayAttestation,
} from "../runtime/runtimeReplayAttestation";

import {
  addRuntimeReplayAttestation,
  clearRuntimeReplayAttestations,
  loadRuntimeReplayAttestations,
  parseRuntimeReplayAttestations,
  saveRuntimeReplayAttestations,
  serializeRuntimeReplayAttestations,
} from "./runtimeReplayAttestationRepository";

/**
 * Creates replay attestation fixture.
 *
 * @param id Replay hash suffix.
 * @returns Replay attestation fixture.
 *
 * PURE: No side effects.
 */
function createReplayAttestationFixture(
  id = "1"
): RuntimeReplayAttestation {
  return {
    replayHash:
      `hash-${id}`,
    eventCount: 1,
    generatedAt: 100,
  };
}

/**
 * Clears replay attestation repository test state.
 *
 * @returns void
 *
 * SIDE EFFECT: Clears persisted replay attestations.
 */
function clearReplayAttestationRepositoryTestState():
  void {
  clearRuntimeReplayAttestations();
}

beforeEach(() => {
  clearReplayAttestationRepositoryTestState();
});

afterEach(() => {
  clearReplayAttestationRepositoryTestState();
});

describe("runtimeReplayAttestationRepository", () => {
  it("serializes and parses replay attestations", () => {
    const attestations = [
      createReplayAttestationFixture(),
    ];

    expect(
      parseRuntimeReplayAttestations(
        serializeRuntimeReplayAttestations(
          attestations
        )
      )
    ).toEqual(
      attestations
    );
  });

  it("parses empty replay attestation content", () => {
    expect(
      parseRuntimeReplayAttestations(
        ""
      )
    ).toEqual([]);
  });

  it("returns empty list when no attestations exist", () => {
    expect(
      loadRuntimeReplayAttestations()
    ).toEqual([]);
  });

  it("saves and loads replay attestations", () => {
    const attestations = [
      createReplayAttestationFixture(),
    ];

    saveRuntimeReplayAttestations(
      attestations
    );

    expect(
      loadRuntimeReplayAttestations()
    ).toEqual(
      attestations
    );
  });

  it("adds replay attestation", () => {
    addRuntimeReplayAttestation(
      createReplayAttestationFixture(
        "1"
      )
    );

    addRuntimeReplayAttestation(
      createReplayAttestationFixture(
        "2"
      )
    );

    expect(
      loadRuntimeReplayAttestations()
    ).toHaveLength(2);
  });

  it("clears replay attestations", () => {
    saveRuntimeReplayAttestations([
      createReplayAttestationFixture(),
    ]);

    clearRuntimeReplayAttestations();

    expect(
      loadRuntimeReplayAttestations()
    ).toEqual([]);
  });
});