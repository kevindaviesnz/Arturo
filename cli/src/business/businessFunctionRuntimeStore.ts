import {
  addBusinessFunctionJobId,
  addBusinessFunctionRefinement,
  setBusinessFunctionState,
  type BusinessFunctionRuntime,
  type BusinessFunctionRuntimeState,
} from "./businessFunctionRuntime";

import {
  startBusinessFunction,
  pauseBusinessFunction,
  resumeBusinessFunction,
  stopBusinessFunction,
  failBusinessFunction,
} from "./businessFunctionRuntime";

import {
  clearPersistedBusinessFunctionRuntimes,
  loadBusinessFunctionRuntimes,
  savePersistedBusinessFunctionRuntime,
} from "../storage/businessFunctionRuntimeRepository";

const businessFunctions: Record<string, BusinessFunctionRuntime> =
  Object.fromEntries(
    loadBusinessFunctionRuntimes().map(
      (businessFunction) => [
        businessFunction.id,
        businessFunction,
      ]
    )
  );

/**
 * Purpose: Clears all runtime business functions.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Mutates the in-memory business function store.
 */
export function clearBusinessFunctions(): void {
  Object.keys(
    businessFunctions
  ).forEach(
    (id) => {
      delete businessFunctions[id];
    }
  );

  clearPersistedBusinessFunctionRuntimes();
}

/**
 * Purpose: Saves a runtime business function.
 *
 * Params:
 * - businessFunction: Business function to save.
 *
 * Returns:
 * - Saved business function.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory business function store.
 */
export function saveBusinessFunction(
  businessFunction: BusinessFunctionRuntime
): BusinessFunctionRuntime {
  businessFunctions[businessFunction.id] =
    businessFunction;

  savePersistedBusinessFunctionRuntime(
    businessFunction
  );

  return businessFunction;
}

/**
 * Purpose: Lists runtime business functions.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Runtime business functions in insertion order.
 *
 * SIDE EFFECT:
 * - Reads the in-memory business function store.
 */
export function listBusinessFunctions(): readonly BusinessFunctionRuntime[] {
  return Object.values(
    businessFunctions
  );
}

/**
 * Purpose: Finds a runtime business function by id.
 *
 * Params:
 * - id: Business function id.
 *
 * Returns:
 * - Matching business function or undefined.
 *
 * SIDE EFFECT:
 * - Reads the in-memory business function store.
 */
export function getBusinessFunction(
  id: string
): BusinessFunctionRuntime | undefined {
  return businessFunctions[id];
}

/**
 * Purpose: Adds a refinement to a stored business function.
 *
 * Params:
 * - id: Business function id.
 * - refinement: Refinement text.
 *
 * Returns:
 * - Updated business function or undefined.
 *
 * SIDE EFFECT:
 * - Reads and mutates the in-memory business function store.
 */
export function refineBusinessFunction(
  id: string,
  refinement: string
): BusinessFunctionRuntime | undefined {
  const businessFunction =
    getBusinessFunction(
      id
    );

  if (!businessFunction) {
    return undefined;
  }

  return saveBusinessFunction(
    addBusinessFunctionRefinement(
      businessFunction,
      refinement
    )
  );
}

/**
 * Purpose: Updates the state of a stored business function.
 *
 * Params:
 * - id: Business function id.
 * - state: New state.
 *
 * Returns:
 * - Updated business function or undefined.
 *
 * SIDE EFFECT:
 * - Reads and mutates the in-memory business function store.
 */
export function updateBusinessFunctionState(
  id: string,
  state: BusinessFunctionRuntimeState
): BusinessFunctionRuntime | undefined {
  const businessFunction =
    getBusinessFunction(
      id
    );

  if (!businessFunction) {
    return undefined;
  }

  return saveBusinessFunction(
    setBusinessFunctionState(
      businessFunction,
      state
    )
  );
}

/**
 * Purpose: Attaches a job id to a stored business function.
 *
 * Params:
 * - id: Business function id.
 * - jobId: Job id.
 *
 * Returns:
 * - Updated business function or undefined.
 *
 * SIDE EFFECT:
 * - Reads and mutates the in-memory business function store.
 */
export function attachBusinessFunctionJob(
  id: string,
  jobId: string
): BusinessFunctionRuntime | undefined {
  const businessFunction =
    getBusinessFunction(
      id
    );

  if (!businessFunction) {
    return undefined;
  }

  return saveBusinessFunction(
    addBusinessFunctionJobId(
      businessFunction,
      jobId
    )
  );
}

/**
 * Purpose: Starts a runtime business function.
 *
 * Params:
 * - id: Business function id.
 *
 * Returns:
 * - Updated business function or undefined.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory runtime store.
 */
export function startBusinessFunctionRuntime(
  id: string
): BusinessFunctionRuntime | undefined {
  const businessFunction =
    getBusinessFunction(id);

  if (!businessFunction) {
    return undefined;
  }

  const updated =
    startBusinessFunction(
      businessFunction
    );

  saveBusinessFunction(
    updated
  );

  return updated;
}

/**
 * Purpose: Pauses a runtime business function.
 *
 * Params:
 * - id: Business function id.
 *
 * Returns:
 * - Updated business function or undefined.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory runtime store.
 */
export function pauseBusinessFunctionRuntime(
  id: string
): BusinessFunctionRuntime | undefined {
  const businessFunction =
    getBusinessFunction(id);

  if (!businessFunction) {
    return undefined;
  }

  const updated =
    pauseBusinessFunction(
      businessFunction
    );

  saveBusinessFunction(
    updated
  );

  return updated;
}

/**
 * Purpose: Resumes a paused runtime business function.
 *
 * Params:
 * - id: Business function id.
 *
 * Returns:
 * - Updated business function or undefined.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory runtime store.
 */
export function resumeBusinessFunctionRuntime(
  id: string
): BusinessFunctionRuntime | undefined {
  const businessFunction =
    getBusinessFunction(id);

  if (!businessFunction) {
    return undefined;
  }

  const updated =
    resumeBusinessFunction(
      businessFunction
    );

  saveBusinessFunction(
    updated
  );

  return updated;
}

/**
 * Purpose: Stops a runtime business function.
 *
 * Params:
 * - id: Business function id.
 *
 * Returns:
 * - Updated business function or undefined.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory runtime store.
 */
export function stopBusinessFunctionRuntime(
  id: string
): BusinessFunctionRuntime | undefined {
  const businessFunction =
    getBusinessFunction(id);

  if (!businessFunction) {
    return undefined;
  }

  const updated =
    stopBusinessFunction(
      businessFunction
    );

  saveBusinessFunction(
    updated
  );

  return updated;
}

/**
 * Purpose: Marks a runtime business function as failed.
 *
 * Params:
 * - id: Business function id.
 *
 * Returns:
 * - Updated business function or undefined.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory runtime store.
 */
export function failBusinessFunctionRuntime(
  id: string
): BusinessFunctionRuntime | undefined {
  const businessFunction =
    getBusinessFunction(id);

  if (!businessFunction) {
    return undefined;
  }

  const updated =
    failBusinessFunction(
      businessFunction
    );

  saveBusinessFunction(
    updated
  );

  return updated;
}