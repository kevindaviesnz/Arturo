import type {
  Worker,
  WorkerCapability,
} from "../control/workers";

import type {
  Job,
  JobCapability,
} from "./jobQueue";

export const HOST_EFFECT_WORKER_CAPABILITIES = [
  "file-read",
  "file-write",
  "shell-read",
  "shell-execute",
] as const satisfies readonly WorkerCapability[];

export type WorkerSandboxMode =
  | "required"
  | "trusted-host-dev";

export type WorkerSandboxViolation = {
  readonly capabilities: WorkerCapability[];
  readonly message: string;
};

/**
 * Resolves the worker sandbox mode.
 *
 * `required` is the fail-closed default: AI Workers may not execute host
 * filesystem/process capabilities until a real sandbox runner exists.
 * `trusted-host-dev` is an explicit local-development escape hatch.
 *
 * PURE: Reads only the supplied environment-like object.
 */
export function resolveWorkerSandboxMode(
  env: NodeJS.ProcessEnv = process.env
): WorkerSandboxMode {
  const configured =
    env.ARTURO_WORKER_SANDBOX_MODE
      ?.trim()
      .toLowerCase();

  if (
    !configured ||
    configured === "required"
  ) {
    return "required";
  }

  if (configured === "trusted-host-dev") {
    return "trusted-host-dev";
  }

  throw new Error(
    "ARTURO_WORKER_SANDBOX_MODE must be required or trusted-host-dev"
  );
}

export function isHostEffectWorkerCapability(
  capability: JobCapability
): capability is WorkerCapability {
  return (
    HOST_EFFECT_WORKER_CAPABILITIES as readonly string[]
  ).includes(
    capability
  );
}

export function hostEffectCapabilitiesForJob(
  job: Job
): WorkerCapability[] {
  return (
    job.requiredCapabilities ??
    []
  ).filter(
    isHostEffectWorkerCapability
  );
}

/**
 * Returns a fail-closed sandbox violation for host filesystem/process work.
 *
 * PURE: Reads only supplied values.
 */
export function validateWorkerSandboxForJob(
  job: Job,
  worker: Worker<unknown, unknown>,
  env: NodeJS.ProcessEnv = process.env
): WorkerSandboxViolation | undefined {
  if (worker.kind !== "ai" && worker.kind !== "workflow") {
    return undefined;
  }

  const capabilities =
    hostEffectCapabilitiesForJob(
      job
    );

  if (capabilities.length === 0) {
    return undefined;
  }

  if (
    resolveWorkerSandboxMode(
      env
    ) === "trusted-host-dev"
  ) {
    return undefined;
  }

  return {
    capabilities,
    message:
      `Worker sandbox is required before Task ${job.id} can execute host capability ` +
      `${capabilities.join(", ")}. Set ARTURO_WORKER_SANDBOX_MODE=trusted-host-dev only for trusted local development.`,
  };
}
