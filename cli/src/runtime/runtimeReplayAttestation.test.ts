import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createRuntimeReplayAttestation,
  signRuntimeReplayAttestation,
  verifyRuntimeReplayAttestationSignature,
} from "./runtimeReplayAttestation";

describe(
  "runtimeReplayAttestation",
  () => {
    it(
      "creates replay attestation",
      () => {
        expect(
createRuntimeReplayAttestation(
  "abc123",
  5,
  100
)
        ).toEqual({
          replayHash:
            "abc123",
          eventCount: 5,
          generatedAt: 100,
        });
      }
    );

    it(
      "signs replay attestation",
      () => {
        const signature =
          signRuntimeReplayAttestation(
            {
              replayHash:
                "abc123",
              eventCount: 5,
              generatedAt: 100,
            },
            "secret"
          );

        expect(
          signature.length
        ).toBeGreaterThan(
          10
        );
      }
    );

    it(
      "verifies replay attestation signature",
      () => {
        const attestation =
          {
            replayHash:
              "abc123",
            eventCount: 5,
            generatedAt: 100,
          };

        const signature =
          signRuntimeReplayAttestation(
            attestation,
            "secret"
          );

        expect(
          verifyRuntimeReplayAttestationSignature(
            attestation,
            "secret",
            signature
          )
        ).toBe(
          true
        );
      }
    );

    it(
      "rejects invalid replay attestation signature",
      () => {
        expect(
          verifyRuntimeReplayAttestationSignature(
            {
              replayHash:
                "abc123",
              eventCount: 5,
              generatedAt: 100,
            },
            "secret",
            "invalid"
          )
        ).toBe(
          false
        );
      }
    );
  }
);