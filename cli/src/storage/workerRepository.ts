import { validateWorkflowDefinition, type WorkflowWorkerDefinition } from "../control/workflowWorker";
import type {
  Worker,
  WorkerAvailability,
  WorkerCapability,
  WorkerKind,
  HumanWorkerMode,
} from "../control/workers";

import {
  resolveDefaultHumanWorkerMode,
} from "../control/humanWorkerMode";

import type {
  AgentArchetype,
} from "../agents/agentArchetype";

import {
  runtimeDb,
} from "./runtimeDatabase";

export type PersistedWorker = {
  name: string;

  displayName?: string;

  email?: string;

  kind?: WorkerKind;

  archetype?: AgentArchetype;

  model?: string;

  refinement?: string;

  trust?: boolean;

  system?: boolean;

  availability?: WorkerAvailability;

  capabilities?: WorkerCapability[];

  humanMode?: HumanWorkerMode;

  workflowDefinition?: WorkflowWorkerDefinition;
};

/**
 * Creates a safe no-op worker run function for restored workers.
 *
 * @param input Worker input.
 * @returns Original input.
 *
 * PURE: No side effects.
 */
function* restoredWorkerRun(
  input: any
): Generator<any, any, any> {
  return input;
}

/**
 * Parses persisted worker capabilities.
 *
 * @param value Persisted JSON capability list.
 * @returns Worker capabilities.
 *
 * PURE: No side effects.
 */
export function parseWorkerCapabilities(
  value: unknown
): WorkerCapability[] {
  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed =
      JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed
      : [];
  } catch {
    return [];
  }
}

/**
 * Parses persisted worker availability.
 *
 * @param value Persisted availability value.
 * @returns Worker availability or undefined.
 *
 * PURE: No side effects.
 */
export function parseWorkerAvailability(
  value: unknown
): WorkerAvailability | undefined {
  if (
    value === "available" ||
    value === "busy" ||
    value === "offline"
  ) {
    return value;
  }

  return undefined;
}

/**
 * Converts a worker into a SQLite-safe row.
 *
 * @param worker Worker metadata.
 * @returns SQLite row.
 *
 * PURE: No side effects.
 */
export function toWorkerRow(
  worker: PersistedWorker
) {
  return {
    name:
      worker.name,
    displayName:
      worker.displayName ?? null,
    email:
      worker.email ?? null,
    kind:
      worker.kind ?? null,
    archetype:
      worker.archetype ?? null,
    model:
      worker.model ?? null,
    refinement:
      worker.refinement ?? null,
    trust:
      worker.trust ? 1 : 0,
    capabilities:
      JSON.stringify(
        worker.capabilities ?? []
      ),
    system:
      worker.system ? 1 : 0,
    availability:
      worker.availability ?? null,
    humanMode:
      worker.humanMode ?? null,
    workflowDefinition: worker.workflowDefinition ? JSON.stringify(validateWorkflowDefinition(worker.workflowDefinition)) : null,
  };
}

/**
 * Converts a SQLite row into a worker.
 *
 * @param row SQLite worker row.
 * @returns Restored worker with safe default run function.
 *
 * PURE: No side effects.
 */
export function fromWorkerRow(
  row: any
): Worker<any, any> {
  return {
    name:
      row.name,
    displayName:
      row.displayName ?? undefined,
    email:
      row.email ?? undefined,
    kind:
      row.kind ?? undefined,
    archetype:
      row.archetype ?? undefined,
    model:
      row.model ?? undefined,
    refinement:
      row.refinement ?? undefined,
    trust:
      Boolean(row.trust),
    system:
      Boolean(row.system),
    availability:
      parseWorkerAvailability(
        row.availability
      ),
    capabilities:
      parseWorkerCapabilities(
        row.capabilities
      ),
    humanMode:
      row.kind === "human"
        ? (row.humanMode ?? resolveDefaultHumanWorkerMode(row.archetype ?? undefined))
        : undefined,
    workflowDefinition: row.kind === "workflow" ? validateWorkflowDefinition(JSON.parse(row.workflowDefinition ?? "null")) : undefined,
    run:
      restoredWorkerRun,
  };
}

/**
 * Inserts or replaces a persisted worker.
 *
 * @param worker Worker to persist.
 * @returns void
 *
 * SIDE EFFECT: Writes worker metadata into SQLite.
 */
export function saveWorker(
  worker: PersistedWorker
): void {
  runtimeDb
    .prepare(`
      INSERT OR REPLACE INTO workers (
        name,
        display_name,
        email,
        kind,
        archetype,
        model,
        refinement,
        trust,
        capabilities,
        system,
        availability,
        human_mode,
        workflow_definition
      )
      VALUES (
        @name,
        @displayName,
        @email,
        @kind,
        @archetype,
        @model,
        @refinement,
        @trust,
        @capabilities,
        @system,
        @availability,
        @humanMode,
        @workflowDefinition
      )
    `)
    .run(
      toWorkerRow(
        worker
      )
    );
}

/**
 * Loads all persisted workers.
 *
 * @returns Persisted workers.
 *
 * SIDE EFFECT: Reads workers from SQLite.
 */
export function loadWorkers():
  Worker<any, any>[] {
  const rows =
    runtimeDb
      .prepare(`
        SELECT
          name,
          display_name as displayName,
          email,
          kind,
          archetype,
          model,
          refinement,
          trust,
          capabilities,
          system,
          availability,
          human_mode as humanMode,
          workflow_definition as workflowDefinition
        FROM workers
        ORDER BY name ASC
      `)
      .all();

  return rows.map(
    fromWorkerRow
  );
}

/**
 * Deletes one persisted Worker while leaving historical work records intact.
 *
 * @param name Exact Worker registry name.
 * @returns True when a persisted row was removed.
 *
 * SIDE EFFECT: Deletes one Worker row from SQLite.
 */
export function deletePersistedWorker(
  name: string
): boolean {
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships WHERE worker_name=?").run(name);
  const result =
    runtimeDb
      .prepare(
        "DELETE FROM workers WHERE name = ?"
      )
      .run(
        name
      );

  return result.changes >
    0;
}

/**
 * Clears all persisted workers.
 *
 * @returns void
 *
 * SIDE EFFECT: Deletes worker rows from SQLite.
 */
export function clearPersistedWorkers():
  void {
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
  runtimeDb
    .prepare(
      "DELETE FROM workers"
    )
    .run();
}
