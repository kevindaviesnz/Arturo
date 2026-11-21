import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createSnapshotIntegrityRecord,
  hashSnapshot,
  serializeSnapshot,
  verifySnapshotIntegrity,
} from "./runtimeSnapshotIntegrity";

/**
 * Creates snapshot fixture.
 *
 * @returns Snapshot fixture.
 *
 * PURE: No side effects.
 */
function createSnapshot() {
  return {
    jobs: [
      {
        id: "job-1",
        status: "completed",
      },
    ],
    workflows: [],
    approvals: [],
  };
}

describe(
  "runtimeSnapshotIntegrity",
  () => {
    it(
      "serializes snapshots deterministically",
      () => {
        expect(
          serializeSnapshot({
            b: 2,
            a: 1,
          })
        ).toBe(
          JSON.stringify({
            a: 1,
            b: 2,
          })
        );
      }
    );

    it(
      "creates stable snapshot hashes",
      () => {
        const first =
          hashSnapshot(
            createSnapshot()
          );

        const second =
          hashSnapshot(
            createSnapshot()
          );

        expect(first).toBe(
          second
        );
      }
    );

    it(
      "creates integrity records",
      () => {
        expect(
          createSnapshotIntegrityRecord(
            createSnapshot()
          )
        ).toMatchObject({
          algorithm:
            "sha256",
        });
      }
    );

    it(
      "verifies valid snapshot integrity",
      () => {
        const snapshot =
          createSnapshot();

        const integrity =
          createSnapshotIntegrityRecord(
            snapshot
          );

        expect(
          verifySnapshotIntegrity(
            snapshot,
            integrity
          )
        ).toEqual({
          valid: true,
        });
      }
    );

    it(
      "rejects tampered snapshots",
      () => {
        const integrity =
          createSnapshotIntegrityRecord(
            createSnapshot()
          );

        expect(
          verifySnapshotIntegrity(
            {
              ...createSnapshot(),
              jobs: [],
            },
            integrity
          )
        ).toEqual({
          valid: false,
          error:
            "Snapshot integrity verification failed",
        });
      }
    );
  }
);