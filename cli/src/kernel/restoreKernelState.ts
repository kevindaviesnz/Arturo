import type {
  KernelState,
} from "./state";

import type {
  KernelSnapshot,
} from "./kernelSnapshot";

/**
 * Restores kernel state from snapshot.
 *
 * NOTE:
 * Fibers and process run functions are intentionally not restored.
 * Processes restored from snapshots are therefore non-runnable until
 * deterministic replay/process-definition reconstruction exists.
 *
 * This milestone restores:
 * - pending calls
 * - queues
 * - timers
 * - results
 * - process metadata
 *
 * @param snapshot Persisted kernel snapshot.
 * @returns Restored kernel state.
 *
 * PURE: No side effects.
 */
export function restoreKernelState(
  snapshot: KernelSnapshot
): KernelState {
  return {
    nextPid:
      snapshot.nextPid,

    readyQueue: [
      ...snapshot.readyQueue,
    ],

    blockedQueue: [
      ...snapshot.blockedQueue,
    ],

    timers: [
      ...snapshot.timers,
    ],

    pendingCalls: {
      ...snapshot.pendingCalls,
    },

    results: {
      ...snapshot.results,
    },

    processes:
      Object.fromEntries(
        Object.entries(
          snapshot.processes
        ).map(
          ([pid, process]) => [
            Number(pid),
            {
              pid:
                process.pid,

              name:
                process.name,

              state:
                process.state as any,

              context:
                process.context,

              mailbox: [
                ...process.mailbox,
              ],

              resumeValue:
                process.resumeValue,

              fiber:
                undefined,

              run: function* () {
                throw new Error(
                  "Process execution unavailable after snapshot restore. Deterministic replay not yet implemented."
                );
              },
            },
          ]
        )
      ),
  };
}