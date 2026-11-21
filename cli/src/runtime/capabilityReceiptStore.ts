import crypto from "crypto";

import type {
  Job,
} from "./jobQueue";

export type CapabilityReceiptStatus =
  | "completed"
  | "failed";

export type CapabilityReceipt = {
  id: string;

  jobId: string;

  capability: string;

  worker: string;

  status: CapabilityReceiptStatus;

  inputHash: string;

  outputHash?: string;

  startedAt: number;

  completedAt: number;

  durationMs: number;

  error?: string;
};

let receipts:
  CapabilityReceipt[] = [];

/**
 * Creates a deterministic SHA-256 hash.
 *
 * @param value Value to hash.
 * @returns Hex digest.
 *
 * PURE: No side effects.
 */
export function createHash(
  value: unknown
): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify(value)
    )
    .digest("hex");
}

/**
 * Creates a capability execution receipt.
 *
 * @param job Executed job.
 * @returns Capability receipt or undefined.
 *
 * PURE: No side effects.
 */
export function createCapabilityReceipt(
  job: Job
):
  | CapabilityReceipt
  | undefined {
  const capability =
    job.requiredCapabilities?.[0];

  if (
    !capability ||
    !job.worker ||
    job.startedAt === undefined
  ) {
    return undefined;
  }

  const completedAt =
    job.completedAt ??
    job.failedAt;

  if (
    completedAt === undefined
  ) {
    return undefined;
  }

  return {
    id:
      crypto.randomUUID(),

    jobId:
      job.id,

    capability,

    worker:
      job.worker,

    status:
      job.status ===
      "completed"
        ? "completed"
        : "failed",

    inputHash:
      createHash(
        job.task
      ),

    outputHash:
      job.rawOutput !==
      undefined
        ? createHash(
            job.rawOutput
          )
        : undefined,

    startedAt:
      job.startedAt,

    completedAt,

    durationMs:
      completedAt -
      job.startedAt,

    error:
      job.error,
  };
}

/**
 * Stores a capability receipt.
 *
 * @param receipt Receipt to store.
 * @returns Stored receipt.
 *
 * SIDE EFFECT: Mutates in-memory receipt store.
 */
export function addCapabilityReceipt(
  receipt: CapabilityReceipt
): CapabilityReceipt {
  receipts = [
    ...receipts,
    receipt,
  ];

  return receipt;
}

/**
 * Lists capability receipts.
 *
 * @returns Immutable receipt list.
 *
 * SIDE EFFECT: Reads in-memory receipt store.
 */
export function listCapabilityReceipts():
  CapabilityReceipt[] {
  return [...receipts];
}

/**
 * Clears all capability receipts.
 *
 * @returns void
 *
 * SIDE EFFECT: Mutates in-memory receipt store.
 */
export function clearCapabilityReceipts():
  void {
  receipts = [];
}