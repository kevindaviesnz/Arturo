import fs from "fs";
import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearKernelSnapshot,
  createPersistedKernelSnapshot,
  getKernelSnapshotFile,
  loadKernelSnapshot,
  parsePersistedKernelSnapshot,
  saveKernelSnapshot,
} from "./kernelPersistence";

import type {
  KernelSnapshot,
} from "./kernelSnapshot";

const SNAPSHOT_FILE =
  getKernelSnapshotFile();

/**
 * Creates kernel snapshot fixture.
 *
 * @param overrides Optional snapshot overrides.
 * @returns Kernel snapshot fixture.
 *
 * PURE: No side effects.
 */
function createKernelSnapshotFixture(
  overrides: Partial<KernelSnapshot> = {}
): KernelSnapshot {
  return {
    version:
      "1.0.0",
    createdAt:
      123,
    nextPid:
      1,
    processes: {},
    readyQueue: [],
    blockedQueue: [],
    timers: [],
    pendingCalls: {},
    results: {},
    ...overrides,
  };
}

describe(
  "kernelPersistence",
  () => {
    afterEach(() => {
      clearKernelSnapshot();
    });

    it(
      "saves and loads snapshot",
      () => {
        const snapshot =
          createKernelSnapshotFixture({
            nextPid: 2,
          });

        saveKernelSnapshot(
          snapshot
        );

        expect(
          fs.existsSync(
            SNAPSHOT_FILE
          )
        ).toBe(true);

        expect(
          loadKernelSnapshot()
        ).toEqual(
          snapshot
        );
      }
    );

    it(
      "returns null when snapshot does not exist",
      () => {
        clearKernelSnapshot();

        expect(
          loadKernelSnapshot()
        ).toBeNull();
      }
    );

    it(
      "creates persisted snapshot envelope with integrity",
      () => {
        const snapshot =
          createKernelSnapshotFixture();

        expect(
          createPersistedKernelSnapshot(
            snapshot
          )
        ).toMatchObject({
          snapshot,
          integrity: {
            algorithm:
              "sha256",
          },
        });
      }
    );

    it(
      "rejects tampered persisted snapshots",
      () => {
        const snapshot =
          createKernelSnapshotFixture();

        saveKernelSnapshot(
          snapshot
        );

        const persisted =
          parsePersistedKernelSnapshot(
            fs.readFileSync(
              SNAPSHOT_FILE,
              "utf8"
            )
          );

        fs.writeFileSync(
          SNAPSHOT_FILE,
          JSON.stringify(
            {
              ...persisted,
              snapshot: {
                ...persisted.snapshot,
                nextPid: 999,
              },
            },
            null,
            2
          ),
          "utf8"
        );

        expect(() =>
          loadKernelSnapshot()
        ).toThrow(
          "Snapshot integrity verification failed"
        );
      }
    );

    it(
      "serializes and parses persisted snapshot envelope",
      () => {
        const persisted =
          createPersistedKernelSnapshot(
            createKernelSnapshotFixture()
          );

        expect(
          parsePersistedKernelSnapshot(
            JSON.stringify(
              persisted
            )
          )
        ).toEqual(
          persisted
        );
      }
    );

    it(
      "clears snapshot file",
      () => {
        saveKernelSnapshot(
          createKernelSnapshotFixture()
        );

        clearKernelSnapshot();

        expect(
          fs.existsSync(
            SNAPSHOT_FILE
          )
        ).toBe(false);
      }
    );
  }
);
