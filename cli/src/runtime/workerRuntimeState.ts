export type WorkerRuntimeState = {
  readonly started: boolean;
  readonly busy: boolean;
};

/**
 * Creates the initial worker runtime state.
 *
 * @returns Initial runtime state.
 *
 * PURE: No side effects.
 */
export function createWorkerRuntimeState(): WorkerRuntimeState {
  return {
    started: false,
    busy: false,
  };
}

/**
 * Marks the worker runtime as started.
 *
 * @param state Current runtime state.
 * @returns Updated runtime state.
 *
 * PURE: No side effects.
 */
export function markWorkerRuntimeStarted(
  state: WorkerRuntimeState
): WorkerRuntimeState {
  return {
    ...state,
    started: true,
  };
}

/**
 * Marks the worker runtime as busy.
 *
 * @param state Current runtime state.
 * @returns Updated runtime state.
 *
 * PURE: No side effects.
 */
export function markWorkerRuntimeBusy(
  state: WorkerRuntimeState
): WorkerRuntimeState {
  return {
    ...state,
    busy: true,
  };
}

/**
 * Marks the worker runtime as idle.
 *
 * @param state Current runtime state.
 * @returns Updated runtime state.
 *
 * PURE: No side effects.
 */
export function markWorkerRuntimeIdle(
  state: WorkerRuntimeState
): WorkerRuntimeState {
  return {
    ...state,
    busy: false,
  };
}