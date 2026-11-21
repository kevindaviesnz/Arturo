export type BusinessFunctionRuntimeState =
  | "draft"
  | "ready"
  | "starting"
  | "running"
  | "paused"
  | "waiting"
  | "stopping"
  | "stopped"
  | "failed";

export type BusinessFunctionRuntime = {
  readonly id: string;
  readonly label: string;
  readonly objective: string;
  readonly ownerWorker: string;
  readonly refinements: readonly string[];
  readonly state: BusinessFunctionRuntimeState;
  readonly jobIds: readonly string[];
};

/**
 * Purpose: Creates a runtime business function.
 *
 * Params:
 * - input: Business function runtime fields except refinements, state, and job ids.
 *
 * Returns:
 * - Draft runtime business function.
 *
 * PURE: No side effects.
 */
export function createBusinessFunctionRuntime(
  input: {
    readonly id: string;
    readonly label: string;
    readonly objective: string;
    readonly ownerWorker: string;
  }
): BusinessFunctionRuntime {
  return {
    id: input.id,
    label: input.label,
    objective: input.objective,
    ownerWorker: input.ownerWorker,
    refinements: [],
    state: "draft",
    jobIds: [],
  };
}

/**
 * Purpose: Adds a refinement to a runtime business function.
 *
 * Params:
 * - businessFunction: Runtime business function.
 * - refinement: Refinement text to append.
 *
 * Returns:
 * - Updated runtime business function.
 *
 * PURE: No side effects.
 */
export function addBusinessFunctionRefinement(
  businessFunction: BusinessFunctionRuntime,
  refinement: string
): BusinessFunctionRuntime {
  const trimmed =
    refinement.trim();

  return trimmed.length === 0
    ? businessFunction
    : {
        ...businessFunction,
        refinements: [
          ...businessFunction.refinements,
          trimmed,
        ],
      };
}

/**
 * Purpose: Changes a runtime business function state.
 *
 * Params:
 * - businessFunction: Runtime business function.
 * - state: New runtime state.
 *
 * Returns:
 * - Updated runtime business function.
 *
 * PURE: No side effects.
 */
export function setBusinessFunctionState(
  businessFunction: BusinessFunctionRuntime,
  state: BusinessFunctionRuntimeState
): BusinessFunctionRuntime {
  return {
    ...businessFunction,
    state,
  };
}

/**
 * Purpose: Adds a job id to a runtime business function.
 *
 * Params:
 * - businessFunction: Runtime business function.
 * - jobId: Job id to attach.
 *
 * Returns:
 * - Updated runtime business function.
 *
 * PURE: No side effects.
 */
export function addBusinessFunctionJobId(
  businessFunction: BusinessFunctionRuntime,
  jobId: string
): BusinessFunctionRuntime {
  return {
    ...businessFunction,
    jobIds: [
      ...businessFunction.jobIds,
      jobId,
    ],
  };
}

/**
 * Purpose: Starts a runtime business function.
 *
 * Params:
 * - businessFunction: Runtime business function.
 *
 * Returns:
 * - Business function with running state.
 *
 * PURE: No side effects.
 */
export function startBusinessFunction(
  businessFunction: BusinessFunctionRuntime
): BusinessFunctionRuntime {
  return setBusinessFunctionState(
    businessFunction,
    "running"
  );
}

/**
 * Purpose: Pauses a runtime business function.
 *
 * Params:
 * - businessFunction: Runtime business function.
 *
 * Returns:
 * - Business function with paused state.
 *
 * PURE: No side effects.
 */
export function pauseBusinessFunction(
  businessFunction: BusinessFunctionRuntime
): BusinessFunctionRuntime {
  return setBusinessFunctionState(
    businessFunction,
    "paused"
  );
}

/**
 * Purpose: Resumes a paused runtime business function.
 *
 * Params:
 * - businessFunction: Runtime business function.
 *
 * Returns:
 * - Business function with running state.
 *
 * PURE: No side effects.
 */
export function resumeBusinessFunction(
  businessFunction: BusinessFunctionRuntime
): BusinessFunctionRuntime {
  return setBusinessFunctionState(
    businessFunction,
    "running"
  );
}

/**
 * Purpose: Stops a runtime business function.
 *
 * Params:
 * - businessFunction: Runtime business function.
 *
 * Returns:
 * - Business function with stopped state.
 *
 * PURE: No side effects.
 */
export function stopBusinessFunction(
  businessFunction: BusinessFunctionRuntime
): BusinessFunctionRuntime {
  return setBusinessFunctionState(
    businessFunction,
    "stopped"
  );
}

/**
 * Purpose: Marks a runtime business function as failed.
 *
 * Params:
 * - businessFunction: Runtime business function.
 *
 * Returns:
 * - Business function with failed state.
 *
 * PURE: No side effects.
 */
export function failBusinessFunction(
  businessFunction: BusinessFunctionRuntime
): BusinessFunctionRuntime {
  return setBusinessFunctionState(
    businessFunction,
    "failed"
  );
}