import { Process } from "./process";
import type {
  CapabilityCall,
} from "./capabilityCall";

/**
 * Timer event queue used for sleep syscall.
 */
export type Timer = {
  pid: number;
  wakeAt: number;
};

/**
 * Pending kernel call waiting for an external result.
 */
export type PendingCall =
  CapabilityCall;

/**
 * Completed process result stored by the kernel.
 */
export type ProcessResult = {
  pid: number;
  name: string;
  result: any;
  completedAt: number;
};

/**
 * Kernel State = deterministic process runtime.
 */
export type KernelState = {
  nextPid: number;
  processes: Record<number, Process>;
  readyQueue: number[];
  blockedQueue: number[];
  timers: Timer[];
  pendingCalls: Record<string, PendingCall>;
  results: Record<number, ProcessResult>;
};

/**
 * Boot kernel into deterministic empty state.
 */
export function createKernelState(): KernelState {
  return {
    nextPid: 1,
    processes: {},
    readyQueue: [],
    blockedQueue: [],
    timers: [],
    pendingCalls: {},
    results: {},
  };
}