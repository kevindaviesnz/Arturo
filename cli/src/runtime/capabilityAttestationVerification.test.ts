import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCapabilityAttestation,
} from "./capabilityAttestation";

import {
  verifyCapabilityAttestation,
} from "./capabilityAttestationVerification";

describe(
  "verifyCapabilityAttestation",
  () => {
    it(
      "verifies valid attestation",
      () => {
        const attestation =
          createCapabilityAttestation(
            {
              id: "job-1",
              task:
                "Research AI",
              worker:
                "researcher",
              requiredCapabilities:
                [
                  "research" as any,
                ],
              status:
                "completed",
              rawOutput:
                "Result",
              createdAt:
                1,
            } as any,
            "llama3.2"
          );

        expect(
          attestation
        ).toBeDefined();

        const result =
          verifyCapabilityAttestation(
            attestation!,
            "Research AI",
            "Result"
          );

        expect(
          result
        ).toEqual({
          valid: true,
          errors: [],
        });
      }
    );

    it(
      "detects tampered task",
      () => {
        const attestation =
          createCapabilityAttestation(
            {
              id: "job-1",
              task:
                "Research AI",
              worker:
                "researcher",
              requiredCapabilities:
                [
                  "research" as any,
                ],
              status:
                "completed",
              rawOutput:
                "Result",
              createdAt:
                1,
            } as any,
            "llama3.2"
          );

        const result =
          verifyCapabilityAttestation(
            attestation!,
            "Modified task",
            "Result"
          );

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.errors
        ).toContain(
          "Task hash mismatch"
        );
      }
    );

    it(
      "detects tampered output",
      () => {
        const attestation =
          createCapabilityAttestation(
            {
              id: "job-1",
              task:
                "Research AI",
              worker:
                "researcher",
              requiredCapabilities:
                [
                  "research" as any,
                ],
              status:
                "completed",
              rawOutput:
                "Result",
              createdAt:
                1,
            } as any,
            "llama3.2"
          );

        const result =
          verifyCapabilityAttestation(
            attestation!,
            "Research AI",
            "Tampered"
          );

        expect(
          result.valid
        ).toBe(false);

        expect(
          result.errors
        ).toContain(
          "Output hash mismatch"
        );
      }
    );
  }
);