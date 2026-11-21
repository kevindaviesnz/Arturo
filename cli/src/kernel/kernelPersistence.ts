import fs from "fs";
import path from "path";

import type {
  KernelSnapshot,
} from "./kernelSnapshot";

import {
  createSnapshotIntegrityRecord,
  verifySnapshotIntegrity,
  type SnapshotIntegrityRecord,
} from "../runtime/runtimeSnapshotIntegrity";

import {
  resolveRuntimeDataDirectory,
} from "../storage/runtimeStoragePaths";

import {
  writePrivateFileAtomic,
} from "../storage/atomicFile";

export type PersistedKernelSnapshot = {
  snapshot: KernelSnapshot;
  integrity: SnapshotIntegrityRecord;
};

/**
 * Creates persisted kernel snapshot envelope.
 *
 * @param snapshot Kernel snapshot.
 * @returns Persisted kernel snapshot envelope.
 *
 * PURE: No side effects.
 */
export function createPersistedKernelSnapshot(
  snapshot: KernelSnapshot
): PersistedKernelSnapshot {
  return {
    snapshot,
    integrity:
      createSnapshotIntegrityRecord(
        snapshot
      ),
  };
}

/**
 * Returns the kernel snapshot file path.
 *
 * @returns Snapshot file path.
 *
 * SIDE EFFECT: Reads process environment.
 */
export function getKernelSnapshotFile(): string {
  return (
    process.env.ARTURO_SNAPSHOT_FILE ??
    path.join(
      resolveRuntimeDataDirectory(),
      "kernel.snapshot.json"
    )
  );
}

/**
 * Returns the kernel snapshot directory path.
 *
 * @param snapshotFile Snapshot file path.
 * @returns Snapshot directory path.
 *
 * PURE: No side effects.
 */
export function getKernelSnapshotDir(
  snapshotFile: string
): string {
  return path.dirname(
    snapshotFile
  );
}

/**
 * Serializes persisted kernel snapshot envelope.
 *
 * @param persisted Persisted kernel snapshot envelope.
 * @returns Serialized persisted kernel snapshot.
 *
 * PURE: No side effects.
 */
export function serializePersistedKernelSnapshot(
  persisted: PersistedKernelSnapshot
): string {
  return JSON.stringify(
    persisted,
    null,
    2
  );
}

/**
 * Parses persisted kernel snapshot envelope.
 *
 * @param value Serialized persisted kernel snapshot.
 * @returns Parsed persisted kernel snapshot envelope.
 *
 * PURE: No side effects.
 */
export function parsePersistedKernelSnapshot(
  value: string
): PersistedKernelSnapshot {
  return JSON.parse(
    value
  ) as PersistedKernelSnapshot;
}

/**
 * Saves kernel snapshot to disk with integrity metadata.
 *
 * @param snapshot Serializable kernel snapshot.
 * @returns void
 *
 * SIDE EFFECT: Writes snapshot file to disk.
 */
export function saveKernelSnapshot(
  snapshot: KernelSnapshot
): void {
  const snapshotFile =
    getKernelSnapshotFile();

  writePrivateFileAtomic(
    snapshotFile,
    serializePersistedKernelSnapshot(
      createPersistedKernelSnapshot(
        snapshot
      )
    )
  );
}

/**
 * Loads kernel snapshot from disk and verifies integrity.
 *
 * @returns Loaded snapshot or null.
 *
 * SIDE EFFECT:
 * - Reads snapshot file from disk.
 * - Throws when snapshot integrity verification fails.
 */
export function loadKernelSnapshot():
  | KernelSnapshot
  | null {
  const snapshotFile =
    getKernelSnapshotFile();

  if (
    !fs.existsSync(
      snapshotFile
    )
  ) {
    return null;
  }

  const persisted =
    parsePersistedKernelSnapshot(
      fs.readFileSync(
        snapshotFile,
        "utf8"
      )
    );

  const verification =
    verifySnapshotIntegrity(
      persisted.snapshot,
      persisted.integrity
    );

  if (!verification.valid) {
    throw new Error(
      verification.error
    );
  }

  return persisted.snapshot;
}

/**
 * Clears persisted kernel snapshot.
 *
 * @returns void
 *
 * SIDE EFFECT: Deletes snapshot file.
 */
export function clearKernelSnapshot():
  void {
  const snapshotFile =
    getKernelSnapshotFile();

  if (
    fs.existsSync(
      snapshotFile
    )
  ) {
    fs.unlinkSync(
      snapshotFile
    );
  }
}
