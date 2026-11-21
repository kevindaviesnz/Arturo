import crypto from "crypto";

import type {
  Job,
} from "./jobQueue";

export type CapabilityAttestation = {
  id: string;

  jobId: string;

  worker: string;

  capability: string;

  model?: string;

  taskHash: string;

  outputHash?: string;

  status:
    | "completed"
    | "failed";

  createdAt: number;
};

/**
 * Creates SHA-256 hash.
 *
 * @param value Value to hash.
 * @returns Hex digest.
 *
 * PURE: No side effects.
 */
export function hashValue(
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
 * Creates capability attestation.
 *
 * @param job Executed job.
 * @param model Worker model.
 * @returns Capability attestation or undefined.
 *
 * PURE: No side effects.
 */
export function createCapabilityAttestation(
  job: Job,
  model?: string
):
  | CapabilityAttestation
  | undefined {
  const capability =
    job.requiredCapabilities?.[0];

  if (
    !capability ||
    !job.worker
  ) {
    return undefined;
  }

  return {
    id:
      crypto.randomUUID(),

    jobId:
      job.id,

    worker:
      job.worker,

    capability,

    model,

    taskHash:
      hashValue(
        job.task
      ),

    outputHash:
      job.rawOutput !==
      undefined
        ? hashValue(
            job.rawOutput
          )
        : undefined,

    status:
      job.status ===
      "completed"
        ? "completed"
        : "failed",

    createdAt:
      Date.now(),
  };
}