import {
  Kernel,
} from "../kernel/kernel";

import {
  listKernelCallDispatchDecisions,
} from "../kernel/callDispatcher";

import {
  enqueueJob,
} from "../runtime/jobQueue";

import {
  parseWorkerCapability,
  selectAiWorkerForCapabilities,
} from "../control/workers";

/**
 * Handles the /kernel-resolve command.
 *
 * @param kernel Runtime kernel instance.
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Resolves a pending kernel call through kernel syscall.
 * - Writes CLI output.
 */
export function handleKernelResolveCommand(
  kernel: Kernel,
  args: readonly string[]
): void {
  const [
    callId,
    ...resultParts
  ] = args;

  const result =
    resultParts.join(" ");

  if (
    !callId ||
    !result
  ) {
    console.log(
      'Usage: /kernel-resolve <call-id> "<result>"'
    );

    return;
  }

  const resolved =
    kernel.syscall({
      type: "resolve-call",
      callId,
      result,
    });

  if (!resolved) {
    console.log(
      `call not found: ${callId}`
    );

    return;
  }

  console.log(
    `kernel call resolved: ${callId}`
  );
}

/**
 * Handles the /kernel-pending-calls command.
 *
 * @param kernel Runtime kernel instance.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads kernel state.
 * - Writes CLI output.
 */
export function handleKernelPendingCallsCommand(
  kernel: Kernel
): void {
  const state =
    kernel.getState();

  const pendingCalls =
    Object.values(
      state.pendingCalls
    );

  if (!pendingCalls.length) {
    console.log(
      "(no pending kernel calls)"
    );

    return;
  }

  for (const call of pendingCalls) {
    console.log(
      `${call.callId} pid=${call.pid} capability=${call.capability} input=${JSON.stringify(call.input)}`
    );
  }
}

/**
 * Handles the /kernel-dispatchable-calls command.
 *
 * @param kernel Runtime kernel instance.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads kernel state.
 * - Writes CLI output.
 */
export function handleKernelDispatchableCallsCommand(
  kernel: Kernel
): void {
  const decisions =
    listKernelCallDispatchDecisions(
      kernel.getState().pendingCalls
    );

  const dispatchable =
    decisions.filter(
      (decision) =>
        decision.type === "dispatch"
    );

  if (!dispatchable.length) {
    console.log(
      "(no dispatchable kernel calls)"
    );

    return;
  }

  for (const decision of dispatchable) {
    console.log(
      `${decision.callId} capability=${decision.capability} input=${JSON.stringify(decision.input)}`
    );
  }
}

/**
 * Handles the /kernel-dispatch command.
 *
 * @param kernel Runtime kernel instance.
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads kernel pending call state.
 * - Enqueues a job.
 * - Writes CLI output.
 */
export function handleKernelDispatchCommand(
  kernel: Kernel,
  args: readonly string[]
): void {
  const callId =
    args[0];

  if (!callId) {
    console.log(
      "Usage: /kernel-dispatch <call-id>"
    );

    return;
  }

  const call =
    kernel.getState().pendingCalls[
      callId
    ];

  if (!call) {
    console.log(
      `kernel call not found: ${callId}`
    );

    return;
  }

  const capability =
    parseWorkerCapability(
      call.capability
    );

  const worker =
    selectAiWorkerForCapabilities([
      capability,
    ]);

  if (!worker) {
    console.log(
      `no worker found for capability: ${call.capability}`
    );

    return;
  }

  if (
    worker.kind !== "ai"
  ) {
    console.log(
      `${worker.name} is not an AI worker`
    );

    return;
  }

  const job =
    enqueueJob(
      String(call.input),
      worker.name,
      {
        requiredCapabilities: [
          capability,
        ],
        selectedWorker:
          worker.name,
        routingReason:
          `Kernel call ${call.callId} selected first worker matching: ${call.capability}`,
        kernelCallId:
          call.callId,
      }
    );

  console.log(
    `kernel call dispatched: ${call.callId} -> Task ${job.id}`
  );
}

/**
 * Handles the /process-result command.
 *
 * @param kernel Runtime kernel instance.
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads kernel process result state.
 * - Writes CLI output.
 */
export function handleProcessResultCommand(
  kernel: Kernel,
  args: readonly string[]
): void {
  const pid =
    Number(
      args[0]
    );

  if (!pid) {
    console.log(
      "Usage: /process-result <pid>"
    );

    return;
  }

  const result =
    kernel.getState()
      .results[pid];

  if (!result) {
    console.log(
      `(no process result for pid ${pid})`
    );

    return;
  }

  console.log(
    "\n=== PROCESS RESULT ===\n"
  );

  if (
    typeof result.result ===
    "string"
  ) {
    console.log(
      result.result
    );

    return;
  }

  console.log(
    JSON.stringify(
      result.result,
      null,
      2
    )
  );
}
