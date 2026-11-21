// src/control/runStore.ts

export type RunEvent = {
  type: "log";
  message: string;
};

export type RunRecord = {
  readonly id: number;
  readonly workflow: string;
  readonly events: readonly RunEvent[];
};

export type RunStoreState = {
  readonly runs: readonly RunRecord[];
  readonly nextId: number;
};

/**
 * Creates an empty run store state.
 *
 * @returns Empty run store state.
 *
 * PURE: No side effects.
 */
export function createRunStoreState(): RunStoreState {
  return {
    runs: [],
    nextId: 1,
  };
}

/**
 * Creates a run record from explicit values.
 *
 * @param id Run id.
 * @param workflow Workflow name.
 * @returns New run record.
 *
 * PURE: No side effects.
 */
export function createRunRecord(
  id: number,
  workflow: string
): RunRecord {
  return {
    id,
    workflow,
    events: [],
  };
}

/**
 * Adds a run to state.
 *
 * @param state Current run store state.
 * @param workflow Workflow name.
 * @returns Updated state and created run.
 *
 * PURE: No side effects.
 */
export function addRunToState(
  state: RunStoreState,
  workflow: string
): {
  readonly state: RunStoreState;
  readonly run: RunRecord;
} {
  const run =
    createRunRecord(
      state.nextId,
      workflow
    );

  return {
    run,
    state: {
      runs: [
        ...state.runs,
        run,
      ],
      nextId:
        state.nextId + 1,
    },
  };
}

/**
 * Appends an event to a run.
 *
 * @param run Run record.
 * @param event Run event.
 * @returns Updated run record.
 *
 * PURE: No side effects.
 */
export function appendEventToRun(
  run: RunRecord,
  event: RunEvent
): RunRecord {
  return {
    ...run,
    events: [
      ...run.events,
      event,
    ],
  };
}

/**
 * Replaces a run in state.
 *
 * @param state Current run store state.
 * @param updatedRun Updated run record.
 * @returns Updated run store state.
 *
 * PURE: No side effects.
 */
export function replaceRunInState(
  state: RunStoreState,
  updatedRun: RunRecord
): RunStoreState {
  return {
    ...state,
    runs:
      state.runs.map((run) =>
        run.id === updatedRun.id
          ? updatedRun
          : run
      ),
  };
}

/**
 * Appends an event to a run in state.
 *
 * @param state Current run store state.
 * @param runId Run id.
 * @param event Run event.
 * @returns Updated run store state.
 *
 * PURE: No side effects.
 */
export function appendEventToRunInState(
  state: RunStoreState,
  runId: number,
  event: RunEvent
): RunStoreState {
  const run =
    state.runs.find(
      (candidate) =>
        candidate.id === runId
    );

  if (!run) {
    return state;
  }

  return replaceRunInState(
    state,
    appendEventToRun(
      run,
      event
    )
  );
}

let state =
  createRunStoreState();

/**
 * Creates a workflow run record.
 *
 * @param workflow Workflow name.
 * @returns Newly created run record.
 *
 * SIDE EFFECT: Mutates the module-level run store adapter.
 */
export function createRun(
  workflow: string
): RunRecord {
  const result =
    addRunToState(
      state,
      workflow
    );

  state =
    result.state;

  return result.run;
}

/**
 * Appends an event to a run record.
 *
 * @param run Run record to append to.
 * @param event Run event.
 * @returns void
 *
 * SIDE EFFECT: Mutates the module-level run store adapter.
 */
export function appendEvent(
  run: RunRecord,
  event: RunEvent
): void {
  state =
    appendEventToRunInState(
      state,
      run.id,
      event
    );
}

/**
 * Lists run records.
 *
 * @returns Array of run records.
 *
 * PURE: No side effects.
 */
export function listRuns(): RunRecord[] {
  return [
    ...state.runs,
  ];
}

/**
 * Gets a run by id.
 *
 * @param id Run id.
 * @returns Matching run record or undefined.
 *
 * PURE: No side effects.
 */
export function getRun(
  id: number
): RunRecord | undefined {
  return state.runs.find(
    (run) =>
      run.id === id
  );
}

/**
 * Clears all run records and resets id sequence.
 *
 * @returns void
 *
 * SIDE EFFECT: Mutates the module-level run store adapter.
 */
export function clearRuns(): void {
  state =
    createRunStoreState();
}