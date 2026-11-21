import { workerBelongsToEnterprise } from "../identity/organisationIdentity";
import { validateWorkflowDefinition, type WorkflowWorkerDefinition } from "./workflowWorker";
// src/control/workers.ts

import {
  isWorkerCapability,
} from "../capabilities/capabilityCatalog";
import type { WorkerCapability } from "../capabilities/capabilityCatalog";
export {
  CORE_CAPABILITIES,
  CONSEQUENTIAL_CAPABILITIES,
  isWorkerCapability,
  requiresExactWorkerAuthority as isConsequentialCapability,
} from "../capabilities/capabilityCatalog";
export type { WorkerCapability } from "../capabilities/capabilityCatalog";


import type {
  RuntimeWorker,
} from "../types/runtime";

import type {
  AgentArchetype,
} from "../agents/agentArchetype";

import {
  resolveDefaultHumanWorkerMode,
} from "./humanWorkerMode";

import type {
  HumanWorkerMode,
} from "./humanWorkerMode";

export {
  resolveDefaultHumanWorkerMode,
} from "./humanWorkerMode";

export type {
  HumanWorkerMode,
} from "./humanWorkerMode";

import {
  clearPersistedWorkers,
  deletePersistedWorker,
  loadWorkers,
  saveWorker,
} from "../storage/workerRepository";

import {
  getArchetypeCapabilities,
} from "../agents/archetypeCapabilities";

export type WorkerKind =
  | "ai"
  | "human"
  | "workflow";

export type WorkerAvailability =
  | "available"
  | "busy"
  | "offline";

export function isSystemWorker(
  worker: Worker<any, any>
): boolean {
  return worker.system === true;
}

/**
 * Resolves the default human participation mode for an archetype.
 *
 * @param archetype Worker archetype.
 * @returns Default human worker mode.
 *
 * PURE: No side effects.
 */
/**
 * Converts a string into a worker capability.
 *
 * @param value Candidate capability value.
 * @returns Worker capability.
 *
 * PURE: Throws if the value is not a known worker capability.
 */
export function parseWorkerCapability(
  value: string
): WorkerCapability {
  if (
    isWorkerCapability(value)
  ) {
    return value;
  }

  throw new Error(
    `Unknown worker capability: ${value}`
  );
}

/**
 * Converts strings into worker capabilities.
 *
 * @param values Candidate capability values.
 * @returns Worker capabilities.
 *
 * PURE: Throws if any value is not a known worker capability.
 */
export function parseWorkerCapabilities(
  values: readonly string[]
): WorkerCapability[] {
  return values.map(
    parseWorkerCapability
  );
}

export type Worker<I, O> = {
  name: string;

  displayName?: string;

  email?: string;

  kind?: WorkerKind;

  role?: string;

  archetype?: AgentArchetype;

  model?: string;

  trust?: boolean;
  
  system?: boolean;

  refinement?: string;

  capabilities?: WorkerCapability[];

  availability?: WorkerAvailability;

  readonly humanMode?: HumanWorkerMode;

  readonly workflowDefinition?: WorkflowWorkerDefinition;

  run: (
    input: I
  ) => Generator<any, O, any>;
};

export type UserDetails = {
  displayName: string;

  email?: string;
};

const workers: Record<
  string,
  Worker<any, any>
> = Object.fromEntries(
  loadWorkers().map(
    (worker) => {
      const normalized =
        normalizeWorkerCapabilities(
          worker
        );

      return [
        normalized.name,
        normalized,
      ];
    }
  )
);

/**
 * Replaces capabilities on archetyped Workers with their archetype defaults.
 * Human review remains intrinsic to Human participation, not a user-supplied
 * capability grant.
 *
 * @param worker Worker to normalize.
 * @returns Worker with archetype-derived capabilities.
 *
 * PURE: No side effects.
 */
function normalizeWorkerCapabilities<I, O>(
  worker: Worker<I, O>
): Worker<I, O> {
  if (worker.kind === "workflow") {
    if (worker.archetype || worker.model) throw new Error("Workflow Workers cannot have an AI archetype or model.");
    return { ...worker, capabilities: ["conversion"], workflowDefinition: validateWorkflowDefinition(worker.workflowDefinition) };
  }
  if (!worker.archetype) {
    return worker;
  }

  const capabilities =
    getArchetypeCapabilities(
      worker.archetype
    );

  if (
    worker.kind === "human" &&
    !capabilities.includes("human-review")
  ) {
    capabilities.unshift(
      "human-review"
    );
  }

  return {
    ...worker,
    capabilities,
  };
}

/**
 * Registers a workflow worker in the in-memory worker registry.
 *
 * @param worker Worker definition to register.
 * @returns void
 *
 * SIDE EFFECT: Mutates the internal worker registry.
 */
export function addWorker<I, O>(
  worker: Worker<I, O>
): void {
  const normalized =
    normalizeWorkerCapabilities(
      worker
    );

  workers[normalized.name] =
    normalized;

  saveWorker(normalized);
}

/**
 * Resolves default capabilities for a registered AI worker.
 *
 * @param archetype Worker archetype.
 * @returns Default worker capabilities.
 *
 * PURE: No side effects.
 */
export function resolveRegisteredWorkerCapabilities(
  archetype: AgentArchetype
): WorkerCapability[] {
  return getArchetypeCapabilities(
    archetype
  );
}

/**
 * Registers a general AI worker as an execution resource.
 *
 * @param name Worker name.
 * @param archetype Worker archetype.
 * @param model Optional model name.
 * @param refinement Optional Worker specialization.
 * @returns Registered worker definition.
 *
 * SIDE EFFECT:
 * - Mutates the worker registry.
 * - Persists the worker.
 */
export function registerAiWorker(
  name: string,
  archetype: AgentArchetype = "assistant",
  model = process.env.ARTURO_LLM_MODEL ??
    "llama3.2:latest",
  refinement?: string
): Worker<any, any> {
  const worker: Worker<any, any> = {
    name,

    displayName: name,

    kind: "ai",

    archetype,

    availability: "available",

    model,

    trust: false,

    refinement:
      refinement?.trim() ||
      undefined,

    capabilities:
      resolveRegisteredWorkerCapabilities(
        archetype
      ),

    run: function* (
      input: any
    ) {
      return input;
    },
  };

  addWorker(
    worker
  );

  return worker;
}


/**
 * Looks up a registered worker by name.
 *
 * @param name Worker name.
 * @returns Matching worker or undefined.
 *
 * SIDE EFFECT: Reads from internal worker registry.
 */
export function getWorker(
  name: string
): Worker<any, any> | undefined {
  return workers[name];
}

/**
 * Removes one non-system Worker from the live and persisted registry.
 *
 * Dependency and active-work checks belong to the Worker removal service and
 * must run before this low-level mutation.
 *
 * @param name Exact Worker registry name.
 * @returns Removed Worker, or undefined when it did not exist.
 *
 * SIDE EFFECT: Deletes one Worker from memory and SQLite.
 */
export function removeWorker(
  name: string
): Worker<any, any> | undefined {
  const worker =
    getWorker(
      name
    );

  if (!worker) {
    return undefined;
  }

  deletePersistedWorker(
    name
  );
  delete workers[name];

  return worker;
}

/**
 * Updates a worker refinement instruction.
 *
 * @param name Worker name.
 * @param refinement Additional worker-specific instruction text.
 * @returns Updated worker or undefined when no worker exists.
 *
 * SIDE EFFECT:
 * - Mutates the internal worker registry.
 * - Persists the updated worker.
 */
export function refineWorker(
  name: string,
  refinement: string
): Worker<any, any> | undefined {
  const worker =
    getWorker(
      name
    );

  if (!worker) {
    return undefined;
  }

  const updated = {
    ...worker,
    refinement:
      refinement.trim(),
  };

  workers[name] =
    updated;

  saveWorker(
    updated
  );

  return updated;
}

/**
 * Lists registered workflow workers.
 *
 * @returns Array of registered worker definitions.
 *
 * SIDE EFFECT: Reads from internal worker registry.
 */
export function listWorkers():
  Worker<any, any>[] {
  return Object.values(
    workers
  ).filter(
    (worker) =>
      !isSystemWorker(worker)
  );
}

export function listAllWorkers():
  Worker<any, any>[] {
  return Object.values(
    workers
  );
}

/**
 * Creates the default first-user worker.
 *
 * @returns Worker definition for the human operator.
 *
 * PURE: No side effects.
 */
export function createInitialUserWorker():
  Worker<any, any> {
  return {
    name: "operator",

    displayName: "Operator",

    kind: "human",

    archetype: "operator",

    system: true,

    availability: "available",

    humanMode: "task",

    model: "human-operator",

    trust: true,

    // This is the built-in Human operator, so human-review is intrinsic (the
    // archetype itself no longer grants it — that would leak the human-only
    // capability onto AI operators). Stated explicitly here so the trusted
    // first user holds it regardless of add-time normalization.
    capabilities: [
      "human-review",
      ...getArchetypeCapabilities(
        "operator"
      ),
    ],

    run: function* (
      input: any
    ) {
      return input;
    },
  };
}

/**
 * Creates a human worker.
 *
 * @param displayName Human worker display name.
 * @param archetype Worker archetype.
 * @param email Optional email.
 * @returns Human worker definition.
 *
 * PURE: No side effects.
 */
export function createHumanWorker(
  displayName: string,
  archetype?: AgentArchetype,
  email?: string,
  availability: WorkerAvailability = "available",
  refinement?: string
): Worker<any, any> {
  return {
    name: displayName,

    displayName,

    email,

    kind: "human",

    archetype,

    model: "human-worker",

    trust: true,

    availability,

    refinement:
      refinement?.trim() ||
      undefined,

    capabilities: [
      "human-review",
      ...(
        archetype
          ? getArchetypeCapabilities(
              archetype
            )
          : []
      ),
    ],

    humanMode:
    resolveDefaultHumanWorkerMode(
      archetype
    ),
    run: function* (
      input: any
    ) {
      return input;
    },
  };
}

/**
 * Ensures the default first-user worker exists.
 *
 * @returns void
 *
 * SIDE EFFECT: Mutates the internal worker registry if the operator does not already exist.
 */
export function initializeDefaultWorkers():
  void {
  if (!getWorker("operator")) {
    addWorker(
      createInitialUserWorker()
    );
  }

  initializeDefaultCoordinatorWorker();
}

/**
 * Returns a copy of a worker with updated first-user details.
 *
 * @param worker Existing worker definition.
 * @param details User display details.
 * @returns Updated worker definition.
 *
 * PURE: No side effects.
 */
export function withUserDetails<I, O>(
  worker: Worker<I, O>,
  details: UserDetails
): Worker<I, O> {
  return {
    ...worker,

    displayName:
      details.displayName,

    email:
      details.email,
  };
}

/**
 * Updates the default operator worker with first-user details.
 *
 * @param details User display details.
 * @returns Updated operator worker.
 *
 * SIDE EFFECT: Mutates the internal worker registry.
 */
export function updateInitialUserDetails(
  details: UserDetails
): Worker<any, any> {
  initializeDefaultWorkers();

  const operator =
    getWorker("operator");

  if (!operator) {
    throw new Error(
      "Initial user worker not found"
    );
  }

  const updated =
    withUserDetails(
      operator,
      details
    );

  addWorker(updated);

  return updated;
}

/**
 * Checks whether a worker supports all required capabilities.
 *
 * @param worker Worker to check.
 * @param requiredCapabilities Capabilities required by a task.
 * @returns True when the worker supports every required capability.
 *
 * PURE: No side effects.
 */
export function workerSupportsCapabilities(
  worker: Worker<any, any>,
  requiredCapabilities: WorkerCapability[]
): boolean {
  const available =
    new Set(
      worker.capabilities ?? []
    );

  return requiredCapabilities.every(
    (capability) =>
      available.has(capability)
  );
}


/**
 * Finds registered workers that support all required capabilities.
 *
 * @param requiredCapabilities Capabilities required by a task.
 * @returns Matching workers.
 *
 * SIDE EFFECT: Reads from internal worker registry.
 */
export function findWorkersByCapabilities(
  requiredCapabilities: WorkerCapability[]
): Worker<any, any>[] {
  return listWorkers().filter(
    (worker) =>
      workerSupportsCapabilities(
        worker,
        requiredCapabilities
      )
  );
}

/**
 * Checks whether a worker supports one required capability.
 *
 * @param worker Worker to check.
 * @param requiredCapability Capability required by an action.
 * @returns True when the worker supports the required capability.
 *
 * PURE: No side effects.
 */
export function workerSupportsCapability(
  worker: Worker<any, any>,
  requiredCapability: WorkerCapability
): boolean {
  return workerSupportsCapabilities(
    worker,
    [
      requiredCapability,
    ]
  );
}

/**
 * Asserts that a worker has a required capability.
 *
 * @param worker Worker to check.
 * @param requiredCapability Capability required by an action.
 * @returns void
 *
 * PURE: Throws if the capability is missing.
 */
export function assertWorkerCapability(
  worker: Worker<any, any>,
  requiredCapability: WorkerCapability
): void {
  if (
    workerSupportsCapability(
      worker,
      requiredCapability
    )
  ) {
    return;
  }

  throw new Error(
    `Worker ${worker.displayName ?? worker.name} lacks required capability: ${requiredCapability}`
  );
}

/**
 * Selects the first deterministic worker for required capabilities.
 *
 * @param requiredCapabilities Capabilities required by a task.
 * @returns Selected worker or undefined.
 *
 * SIDE EFFECT: Reads from internal worker registry.
 */
export function selectWorkerForCapabilities(
  requiredCapabilities: WorkerCapability[],
  enterpriseId?: string
): Worker<any, any> | undefined {
  return findWorkersByCapabilities(
    requiredCapabilities
  ).find(worker => isWorkerAvailableForNewTask(worker) && workerBelongsToEnterprise(worker.name, enterpriseId));
}

/**
 * Selects the first deterministic AI worker for required capabilities.
 * Human workers are participants in reviews, approvals, decisions, and human
 * tasks; they are never implicit executors for `/task-cap`.
 *
 * SIDE EFFECT: Reads from the worker registry.
 */
export function selectAiWorkerForCapabilities(
  requiredCapabilities: WorkerCapability[],
  enterpriseId?: string
): Worker<any, any> | undefined {
  return findWorkersByCapabilities(
    requiredCapabilities
  ).find(
    (worker) => worker.kind === "ai" && isWorkerAvailableForNewTask(worker) && workerBelongsToEnterprise(worker.name, enterpriseId)
  );
}

/**
 * Converts a registered workflow worker into a serializable runtime worker.
 *
 * @param worker Registered worker definition.
 * @returns Serializable runtime worker for UI transport.
 *
 * PURE: No side effects.
 */
export function toRuntimeWorker(
  worker: Worker<any, any>
): RuntimeWorker {
  return {
    id: worker.name,

    name: worker.name,

    displayName:
      worker.displayName,

    email:
      worker.email,

    type:
      worker.kind ?? "ai",

    status: "idle",

    model:
      worker.model ??
      "registered-worker",

    jobs: 0,

    tokens: 0,

    tools: 0,

    trust:
      worker.trust ?? false,

    capabilities:
      worker.capabilities ?? [],
  };
}

/**
 * Lists serializable runtime workers for WebSocket payloads.
 *
 * @returns Array of serializable runtime workers.
 *
 * SIDE EFFECT: Reads from internal worker registry.
 */
export function listRuntimeWorkers():
  RuntimeWorker[] {
  return listWorkers().map(
    toRuntimeWorker
  );
}

/**
 * Clears all registered workers.
 *
 * @returns void
 *
 * SIDE EFFECT: Mutates the internal worker registry. Intended for tests/dev reset only.
 */
export function clearWorkers():
  void {
  for (const key of Object.keys(
    workers
  )) {
    delete workers[key];
  }

  clearPersistedWorkers();
}

/**
 * Creates the default coordinator worker.
 *
 * @returns Worker definition for the system coordinator.
 *
 * PURE: No side effects.
 */
export function createDefaultCoordinatorWorker():
  Worker<any, any> {
  return {
    name: "coordinator",

    displayName: "Coordinator",

    kind: "ai",

    archetype: "coordinator",

    system: true,

    model: "llama3.2:latest",

    trust: false,

    availability: "available",

    capabilities: [
      ...getArchetypeCapabilities(
        "coordinator"
      ),
    ],

    run: function* (
      input: any
    ) {
      return input;
    },
  };
}

/**
 * Ensures the default coordinator worker exists.
 *
 * @returns void
 *
 * SIDE EFFECT: Mutates the internal worker registry if no coordinator exists.
 */
export function initializeDefaultCoordinatorWorker():
  void {
  const existing =
    listAllWorkers().find(
      (worker) =>
        worker.kind === "ai" &&
        worker.archetype ===
          "coordinator" &&
        worker.system === true
    );

  if (existing) {
    return;
  }

  addWorker(
    createDefaultCoordinatorWorker()
  );
}

/**
 * Finds the first worker with a matching archetype.
 *
 * @param archetype Target archetype.
 * @returns Matching worker.
 *
 * PURE: No side effects.
 */
export function findWorkerByArchetype(
  archetype: AgentArchetype
): Worker<any, any> | undefined {
  return listWorkers().find(
    (worker) =>
      worker.archetype === archetype
  );
}

/** Missing availability on legacy records means available. Busy/offline accept no new work. */
export function isWorkerAvailableForNewTask(worker: { availability?: WorkerAvailability } | undefined): boolean {
  return !!worker && (worker.availability === undefined || worker.availability === "available");
}

/** Register an executable pure workflow; offline pauses it and available resumes it. */
export function registerWorkflowWorker(name: string, definition: WorkflowWorkerDefinition): Worker<string, string> {
  if (!name.trim()) throw new Error("Workflow Worker name is required.");
  const worker: Worker<string, string> = {
    name, kind: "workflow", availability: "available", capabilities: ["conversion"],
    workflowDefinition: validateWorkflowDefinition(definition),
    run: function* () { throw new Error("Workflow Workers execute through the governed Job runtime."); },
  };
  addWorker(worker);
  return getWorker(name)!;
}

/** Persist lifecycle transitions. Existing running work is not retroactively cancelled. */
/**
 * Gives a person the right to sign off work, or takes it away, by their mode.
 * Who may call this is decided by the caller (identity/companySignIn.ts on
 * the page, the trusted host at the terminal).
 *
 * SIDE EFFECT: Saves one Worker.
 */
export function setHumanWorkerSignOff(name: string, canSignOff: boolean): Worker<any, any> {
  const worker = getWorker(name);
  if (!worker || worker.kind !== "human") throw new Error(`No person called ${name}.`);
  addWorker({ ...worker, humanMode: canSignOff ? "approval" : "task" });
  return getWorker(name)!;
}

export function setWorkerAvailability(name: string, availability: WorkerAvailability): Worker<any, any> {
  if (!["available", "busy", "offline"].includes(availability)) throw new Error("Invalid Worker availability.");
  const worker = getWorker(name);
  if (!worker) throw new Error(`Worker not found: ${name}`);
  addWorker({ ...worker, availability });
  return getWorker(name)!;
}
