import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearPersistedArtefacts,
  loadArtefacts,
  saveArtefact,
  saveArtefactVersion,
} from "./artefactRepository";

beforeEach(
  clearPersistedArtefacts
);

describe(
  "artefactRepository",
  () => {
    it(
      "persists exact versions and signed Human review metadata",
      () => {
        saveArtefact({
          id:
            "artefact-9",
          enterpriseId:
            "enterprise-1",
          name:
            "Look 09 design",
          kind:
            "design",
          createdAt:
            100,
          versions:
            [],
        });
        saveArtefactVersion({
          artefactId:
            "artefact-9",
          version:
            2,
          uri:
            "file:///tmp/look-09.svg",
          localPath:
            "/tmp/look-09.svg",
          mediaType:
            "image/svg+xml",
          sha256:
            "a".repeat(
              64
            ),
          sizeBytes:
            123,
          createdBy:
            "Design File Creator",
          sourceJobId:
            "job-2",
          sourceHumanTaskId:
            "human-task-4",
          notes:
            "Revised dimensions.",
          createdAt:
            200,
          reviewStatus:
            "approved",
          reviewTaskId:
            "job-3",
          reviewer:
            "Design Approver",
          reviewedAt:
            300,
          reviewNotes:
            "Approved for costing.",
          reviewSignature:
            "signed-review",
        });

        expect(
          loadArtefacts()
        ).toEqual([
          {
            id:
              "artefact-9",
            enterpriseId:
              "enterprise-1",
            name:
              "Look 09 design",
            kind:
              "design",
            createdAt:
              100,
            versions: [
              {
                artefactId:
                  "artefact-9",
                version:
                  2,
                uri:
                  "file:///tmp/look-09.svg",
                localPath:
                  "/tmp/look-09.svg",
                mediaType:
                  "image/svg+xml",
                sha256:
                  "a".repeat(
                    64
                  ),
                sizeBytes:
                  123,
                createdBy:
                  "Design File Creator",
                sourceJobId:
                  "job-2",
                sourceHumanTaskId:
                  "human-task-4",
                notes:
                  "Revised dimensions.",
                createdAt:
                  200,
                reviewStatus:
                  "approved",
                reviewTaskId:
                  "job-3",
                reviewer:
                  "Design Approver",
                reviewedAt:
                  300,
                reviewNotes:
                  "Approved for costing.",
                reviewSignature:
                  "signed-review",
              },
            ],
          },
        ]);
      }
    );
  }
);
