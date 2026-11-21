import fs from "fs";
import os from "os";
import path from "path";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCapabilityAttestation,
} from "./capabilityAttestation";

import {
  loadCapabilityAttestations,
  parseCapabilityAttestations,
  saveCapabilityAttestations,
  serializeCapabilityAttestations,
} from "./capabilityAttestationPersistence";

describe(
  "capabilityAttestationPersistence",
  () => {
    it(
      "serializes attestations",
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
            },
            "llama3.2"
          );

        const serialized =
          serializeCapabilityAttestations(
            [attestation!]
          );

        expect(
          serialized
        ).toContain(
          '"jobId": "job-1"'
        );
      }
    );

    it(
      "parses attestations",
      () => {
        const parsed =
          parseCapabilityAttestations(
            JSON.stringify([
              {
                id: "1",
                jobId:
                  "job-1",
              },
            ])
          );

        expect(
          parsed
        ).toEqual([
          {
            id: "1",
            jobId:
              "job-1",
          },
        ]);
      }
    );

    it(
      "saves and loads attestations",
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
            },
            "llama3.2"
          );

        const filePath =
          path.join(
            os.tmpdir(),
            "Arturo-attestations-test.json"
          );

        saveCapabilityAttestations(
          filePath,
          [attestation!]
        );

        const loaded =
          loadCapabilityAttestations(
            filePath
          );

        expect(
          loaded
        ).toHaveLength(1);

        expect(
          loaded[0].jobId
        ).toBe("job-1");

        fs.unlinkSync(
          filePath
        );
      }
    );
  }
);