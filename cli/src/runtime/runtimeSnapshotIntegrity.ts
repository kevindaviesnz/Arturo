import crypto from "node:crypto";

export type SnapshotIntegrityRecord = {
  algorithm: "sha256";
  hash: string;
};

export type SnapshotIntegrityVerification =
  | {
      valid: true;
    }
  | {
      valid: false;
      error: string;
    };

/**
 * Creates deterministic snapshot serialization.
 *
 * @param snapshot Snapshot object.
 * @returns Deterministically serialized snapshot.
 *
 * PURE: No side effects.
 */
export function serializeSnapshot(
  snapshot: unknown
): string {
  return JSON.stringify(
    snapshot,
    Object.keys(
      snapshot as object
    ).sort()
  );
}

/**
 * Creates SHA256 snapshot hash.
 *
 * @param snapshot Snapshot object.
 * @returns Snapshot hash.
 *
 * PURE: No side effects.
 */
export function hashSnapshot(
  snapshot: unknown
): string {
  return crypto
    .createHash("sha256")
    .update(
      serializeSnapshot(
        snapshot
      )
    )
    .digest("hex");
}

/**
 * Creates immutable snapshot integrity record.
 *
 * @param snapshot Snapshot object.
 * @returns Snapshot integrity record.
 *
 * PURE: No side effects.
 */
export function createSnapshotIntegrityRecord(
  snapshot: unknown
): SnapshotIntegrityRecord {
  return {
    algorithm: "sha256",
    hash:
      hashSnapshot(snapshot),
  };
}

/**
 * Verifies snapshot integrity record.
 *
 * @param snapshot Snapshot object.
 * @param integrity Integrity record.
 * @returns Verification result.
 *
 * PURE: No side effects.
 */
export function verifySnapshotIntegrity(
  snapshot: unknown,
  integrity: SnapshotIntegrityRecord
): SnapshotIntegrityVerification {
  const actual =
    hashSnapshot(snapshot);

  if (
    actual !== integrity.hash
  ) {
    return {
      valid: false,
      error:
        "Snapshot integrity verification failed",
    };
  }

  return {
    valid: true,
  };
}