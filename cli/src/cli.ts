import "dotenv/config";

import {
  bootRepl,
} from "./repl";

import {
  Kernel,
} from "./kernel/kernel";

import {
  initializeDefaultWorkers,
  parseWorkerCapability,
  selectWorkerForCapabilities,
} from "./control/workers";

import {
  startWorkerRuntime,
} from "./runtime/workerRuntime";

import {
  startEventScheduleRuntime,
} from "./scheduling/eventScheduleRuntime";

import {
  enqueueJob,
  requestJobApproval,
} from "./runtime/jobQueue";

import {
  createAutoDispatchDecision,
} from "./kernel/autoDispatch";

/**
 * Returns whether persisted queued jobs should be recovered on startup.
 *
 * @param value Raw environment variable value.
 * @returns True when startup recovery is explicitly enabled.
 *
 * PURE: No side effects.
 */
export function shouldRecoverJobsOnStartup(
  value: string | undefined
): boolean {
  return value === "true";
}

const kernel = new Kernel();

/**
 * Resolves a kernel continuation call.
 *
 * @param callId Kernel call id to resolve.
 * @param result Result to resume the waiting process with.
 * @returns True when the call was resolved, otherwise false.
 *
 * SIDE EFFECT: Mutates kernel state through syscall.
 */
function resolveKernelCall(
  callId: string,
  result: any
): boolean {
  return kernel.syscall({
    type: "resolve-call",
    callId,
    result,
  });
}

/**
 * Creates an approval job for a human-review kernel call.
 *
 * @param callId Kernel call id awaiting review.
 * @param input Review input/payload.
 * @returns Created approval job id.
 *
 * SIDE EFFECT:
 * - Mutates job queue.
 * - Marks job as awaiting approval.
 */
function createHumanReviewJob(
  callId: string,
  input: any
): string {
  const job =
    enqueueJob(
      String(input),
      "operator",
      {
        requiredCapabilities: [
          "human-review",
        ],
        selectedWorker:
          "operator",
        routingReason:
          `Human review required for kernel call ${callId}`,
        kernelCallId:
          callId,
      }
    );

  requestJobApproval(
    job.id
  );

  return job.id;
}

/**
 * Dispatches a kernel call event to a matching worker or human approval job.
 *
 * @param event Kernel event to inspect and potentially dispatch.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads worker registry.
 * - Mutates job queue when dispatching.
 * - Writes diagnostic output to console.
 */
function autoDispatchKernelCall(
  event: any
): void {
  const decision =
    createAutoDispatchDecision(
      event
    );

  if (decision.type === "ignore") {
    return;
  }

  if (decision.type === "human-review") {
    const jobId =
      createHumanReviewJob(
        decision.callId,
        decision.input
      );

    console.log(
      `human review required: ${decision.callId} -> job ${jobId}`
    );

    return;
  }

  const capability =
    parseWorkerCapability(
      decision.capability
    );

  const worker =
    selectWorkerForCapabilities([
      capability,
    ]);

  if (!worker) {
    console.log(
      `no worker found for kernel capability: ${capability}`
    );
    return;
  }

  if (worker.kind !== "ai") {
    console.log(
      `${worker.name} is not an AI worker`
    );
    return;
  }

  const job =
    enqueueJob(
      String(decision.input),
      worker.name,
      {
        requiredCapabilities: [
          capability,
        ],
        selectedWorker:
          worker.name,
        routingReason:
          `Auto-dispatched kernel call ${decision.callId} to ${worker.name}`,
        kernelCallId:
          decision.callId,
      }
    );

  console.log(
    `kernel call auto-dispatched: ${decision.callId} -> Task ${job.id}`
  );
}

kernel.onEvent((event) => {
  console.log(
    "[kernel-event]",
    JSON.stringify(event)
  );

  autoDispatchKernelCall(
    event
  );
});

async function main(): Promise<void> {
  initializeDefaultWorkers();
  startEventScheduleRuntime();

  const recoverJobs =
    shouldRecoverJobsOnStartup(
      process.env.ARTURO_RECOVER_JOBS
    );

  if (recoverJobs) {
    startWorkerRuntime(
      resolveKernelCall
    );
  }

  const TICK_RATE = 50;

  /**
   * Runs one scheduler tick and schedules the next tick.
   *
   * @returns void
   *
   * SIDE EFFECT: Advances kernel state through syscall and schedules timer.
   */
  function loop(): void {
    const start =
      Date.now();

    kernel.syscall({
      type: "tick",
    });

    const elapsed =
      Date.now() - start;

    setTimeout(
      loop,
      Math.max(
        0,
        TICK_RATE - elapsed
      )
    );
  }

  loop();

  bootRepl(kernel);
}

main().catch((err: unknown) => {
  console.error(
    "Failed to start Arturo",
    err
  );

  process.exit(1);
});
