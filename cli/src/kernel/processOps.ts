import { KernelState } from "./state";

import {
  Effect,
  Process,
} from "./process";

/**
 * Spawns a new process into the kernel state.
 *
 * @param state Current kernel state.
 * @param name Process name.
 * @param context Initial process context.
 * @param run Process generator factory.
 * @returns Updated kernel state with the new process queued.
 *
 * PURE: No side effects.
 */
export function spawnProcess(
  state: KernelState,
  name: string,
  context: any,
  run: (
    ctx: any
  ) => Generator<Effect, any, any>
): KernelState {
  const pid =
    state.nextPid;

  const process: Process = {
    pid,
    name,
    state: "ready",
    context,
    run,
    fiber: undefined,
    result: undefined,
    mailbox: [],
  };

  return {
    ...state,
    nextPid:
      pid + 1,
    processes: {
      ...state.processes,
      [pid]:
        process,
    },
    readyQueue: [
      ...state.readyQueue,
      pid,
    ],
  };
}