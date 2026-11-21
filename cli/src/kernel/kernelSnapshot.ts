import type {
  KernelState,
} from "./state";

export type SerializableProcess = {
  pid: number;
  name: string;
  state: string;
  context: any;
  resumeValue?: any;
  mailbox: any[];
};

export type KernelSnapshot = {
  version: "1.0.0";
  createdAt: number;
  nextPid: number;
  processes: Record<number, SerializableProcess>;
  readyQueue: number[];
  blockedQueue: number[];
  timers: KernelState["timers"];
  pendingCalls: KernelState["pendingCalls"];
  results: KernelState["results"];
};

/**
 * Creates a serializable kernel snapshot.
 *
 * Note: generator fibers and process functions are intentionally excluded
 * because they cannot be safely serialized.
 *
 * @param state Kernel state.
 * @returns Serializable kernel snapshot.
 *
 * PURE: No side effects.
 */
export function createKernelSnapshot(
  state: KernelState
): KernelSnapshot {
  return {
    version: "1.0.0",
    createdAt: Date.now(),
    nextPid: state.nextPid,

    processes:
      Object.fromEntries(
        Object.entries(
          state.processes
        ).map(([pid, process]) => [
          pid,
          {
            pid: process.pid,
            name: process.name,
            state: process.state,
            context: process.context,
            resumeValue:
              process.resumeValue,
            mailbox:
              [...process.mailbox],
          },
        ])
      ),

    readyQueue:
      [...state.readyQueue],

    blockedQueue:
      [...state.blockedQueue],

    timers:
      [...state.timers],

    pendingCalls: {
      ...state.pendingCalls,
    },

    results: {
      ...state.results,
    },
  };
}