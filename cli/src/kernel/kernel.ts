import {
  KernelState,
  createKernelState,
} from "./state";

import {
  spawnProcess,
} from "./processOps";

import {
  tick,
} from "./scheduler";

import {
  recordEvent,
} from "../control/eventStore";

import {
  createKernelSnapshot,
} from "./kernelSnapshot";

import {
  saveKernelSnapshot,
  loadKernelSnapshot,
  clearKernelSnapshot,
} from "./kernelPersistence";

import {
  restoreKernelState,
} from "./restoreKernelState";

type Syscall =
  | {
      type: "spawn";
      name: string;
      context: any;
      run: any;
    }
  | {
      type: "tick";
    }
  | {
      type: "list";
    }
  | {
      type: "resolve-call";
      callId: string;
      result: any;
  }
    | {
      type: "save-snapshot";
    }
  | {
      type: "load-snapshot";
  }
    | {
      type: "read-snapshot";
    }
  | {
      type: "clear-snapshot";
    }
  | {
      type: "get-result";
      pid: number;
    };

type Listener = (
  event: any
) => void;


/**
 * Resolves a pending kernel capability call.
 *
 * @param state Current kernel state.
 * @param callId Pending call id.
 * @param result Result to resume the process with.
 * @returns Updated state and resolution status.
 *
 * PURE: No side effects.
 */
export function resolvePendingKernelCall(
  state: KernelState,
  callId: string,
  result: any
): {
  resolved: boolean;
  state: KernelState;
  pid?: number;
} {
  const pending =
    state.pendingCalls[
      callId
    ];

  if (!pending) {
    return {
      resolved: false,
      state,
    };
  }

  const process =
    state.processes[
      pending.pid
    ];

  if (
    !process ||
    !process.fiber ||
    process.state === "terminated"
  ) {
    return {
      resolved: false,
      state,
    };
  }

  const {
    [callId]: _removed,
    ...remainingCalls
  } = state.pendingCalls;

  return {
    resolved: true,
    pid:
      pending.pid,
    state: {
      ...state,

      pendingCalls:
        remainingCalls,

      blockedQueue:
        state.blockedQueue.filter(
          (pid) =>
            pid !== pending.pid
        ),

      readyQueue: [
        ...state.readyQueue,
        pending.pid,
      ],

      processes: {
        ...state.processes,

        [pending.pid]: {
          ...process,
          state: "ready",
          resumeValue:
            result,
        },
      },
    },
  };
}

export class Kernel {
  private state: KernelState =
    createKernelState();

  private listeners: Listener[] = [];

  private ticking = false;


  /**
   * Handles a kernel syscall.
   *
   * @param call Kernel syscall request.
   * @returns Syscall result, if any.
   *
   * SIDE EFFECT: May mutate kernel state and emit runtime events.
   */
  syscall(
    call: Syscall
  ): any {
    switch (call.type) {
      case "spawn": {
        this.state =
          spawnProcess(
            this.state,
            call.name,
            call.context,
            call.run
          );

        const lastPid =
          this.state.nextPid - 1;

        this.emit({
          type: "process:spawn",
          pid: lastPid,
          name: call.name,
          ts: Date.now(),
        });

        this.persistState();

        return;
      }

      case "tick": {
        if (this.ticking) {
          return;
        }

        this.ticking = true;

        try {
          this.state =
            tick(
              this.state,
              (event) =>
                this.emit(event)
            );
            this.persistState();
        } finally {
          this.ticking = false;
        }

      
        return;
      }

     case "resolve-call": {
  const resolution =
    resolvePendingKernelCall(
      this.state,
      call.callId,
      call.result
    );

  if (!resolution.resolved) {
    return false;
  }

  this.state =
    resolution.state;

  this.emit({
    type:
      "process:call-resolved",
    callId:
      call.callId,
    pid:
      resolution.pid,
    ts:
      Date.now(),
  });

  this.persistState();

  return true;
}

      case "list": {
        return Object.values(
          this.state.processes
        );
      }

      case "get-result": {
        return this.state.results[
          call.pid
        ];
      }
        
      case "save-snapshot": {
        const snapshot =
          createKernelSnapshot(
            this.state
          );

        saveKernelSnapshot(
          snapshot
        );

        return snapshot;
      }

      case "load-snapshot": {
        const snapshot =
          loadKernelSnapshot();

        if (!snapshot) {
          return null;
        }

        this.state =
          restoreKernelState(
            snapshot
          );

        this.persistState();

        return true;
      }
        
              case "read-snapshot": {
        return loadKernelSnapshot();
      }
        
      case "clear-snapshot": {
        clearKernelSnapshot();

        return true;
      }
    }
  }

  /**
   * Returns current kernel state.
   *
   * @returns Kernel state snapshot.
   *
   * SIDE EFFECT: Reads in-memory kernel state.
   */
  getState() {
    return this.state;
  }

  /**
   * Registers a kernel event listener.
   *
   * @param fn Listener callback.
   * @returns void
   *
   * SIDE EFFECT: Mutates listener list.
   */
  onEvent(
    fn: Listener
  ): void {
    this.listeners.push(fn);
  }

  private persistState() {
    const snapshot =
      createKernelSnapshot(
        this.state
      );

    saveKernelSnapshot(
      snapshot
    );
  }

  /**
   * Emits a kernel event to all listeners.
   *
   * @param event Kernel event payload.
   * @returns void
   *
   * SIDE EFFECT:
   * - Records events with pids.
   * - Invokes registered listeners.
   */
  private emit(
    event: any
  ): void {
    if (
      event.pid !== undefined
    ) {
      recordEvent(event);
    }

    for (const listener of this.listeners) {
      listener(event);
    }
  }


}