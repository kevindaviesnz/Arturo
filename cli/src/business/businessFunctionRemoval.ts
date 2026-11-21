/**
 * Safe removal of an ongoing Function.
 *
 * A Function owns outcomes, so removing one is not the same as deleting a row:
 * it must not orphan work that is still running, and it must not erase the
 * record of what already happened. Removal therefore refuses while the Function
 * has unfinished Tasks or a running Runtime, and it never deletes historical
 * Tasks, Events, approvals, or Timeline records — those remain inspectable and
 * keep pointing at the Function's ID.
 */

import { removePassOnRule } from "../runtime/passOnRules";
import {
  getBusinessFunctionDefinition,
  listBusinessFunctionDefinitions,
  removeBusinessFunctionDefinition,
} from "./businessFunctionDefinitionStore";
import { listStaffingAssignments, removeStaffingAssignmentsForFunction } from "../staffing/staffingStore";
import { listJobs } from "../runtime/jobQueue";
import type { BusinessFunctionDefinition } from "./businessFunctionDefinition";
import { removeFunctionChecks } from "./functionChecks";
import { removeFunctionOrigin } from "./functionOrigin";

/** Task states that still depend on the Function existing. */
const UNFINISHED_STATUSES: ReadonlySet<string> = new Set([
  "queued",
  "running",
  "awaiting-approval",
  "awaiting_approval",
  "blocked",
]);

export type BusinessFunctionRemovalResult =
  | {
      readonly ok: true;
      readonly removed: BusinessFunctionDefinition;
      readonly releasedAssignments: number;
      /**
       * Workers left with no Function at all. Removing a Function silently
       * stranded its Workers, and nothing on screen showed which ones — the
       * Worker list has no Function column, so an operator could not find them.
       */
      readonly orphanedWorkers: readonly string[];
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

/**
 * Resolves a Function by ID or exact label, optionally within one Enterprise.
 *
 * SIDE EFFECT: Reads the Function definition store.
 */
export function resolveRemovableFunction(
  reference: string,
  enterpriseId?: string
): BusinessFunctionDefinition | undefined {
  const candidates =
    listBusinessFunctionDefinitions()
      .filter(
        (definition) =>
          !enterpriseId ||
          definition.enterpriseId === enterpriseId
      );

  return (
    candidates.find(
      (definition) => definition.id === reference
    ) ??
    candidates.find(
      (definition) =>
        definition.label.toLowerCase() === reference.trim().toLowerCase()
    )
  );
}

/**
 * Returns the IDs of Tasks that still depend on a Function.
 *
 * SIDE EFFECT: Reads the Task queue.
 */
export function unfinishedTaskIdsForFunction(
  businessFunctionId: string
): readonly string[] {
  return listJobs()
    .filter(
      (job) =>
        job.owningJobId === businessFunctionId &&
        UNFINISHED_STATUSES.has(
          String(
            (job as { status?: unknown }).status ?? ""
          ).toLowerCase()
        )
    )
    .map((job) => job.id);
}

/**
 * Removes a Function, refusing while anything still depends on it.
 *
 * SIDE EFFECT:
 * - Deletes the Function definition and its staffing assignments.
 * - Leaves historical Tasks, Events, and approvals untouched.
 */
export function removeBusinessFunction(
  reference: string,
  enterpriseId?: string
): BusinessFunctionRemovalResult {
  const definition =
    resolveRemovableFunction(
      reference,
      enterpriseId
    );

  if (!definition) {
    return {
      ok: false,
      message: `No Function matches "${reference}". Run /functions to list them.`,
    };
  }

  if (definition.runtimeId) {
    return {
      ok: false,
      message: [
        `"${definition.label}" is still running.`,
        "A running Function can create new work at any moment, so stop it before removing it.",
      ].join("\n"),
    };
  }

  const unfinished =
    unfinishedTaskIdsForFunction(
      definition.id
    );

  if (unfinished.length > 0) {
    return {
      ok: false,
      message: [
        `"${definition.label}" still owns ${unfinished.length} unfinished Task(s).`,
        "Removing it would orphan work that is still in progress. Let them finish,",
        "or reject them, then remove the Function.",
        "",
        ...unfinished
          .slice(0, 5)
          .map((id) => `  /task inspect "${id}"`),
      ].join("\n"),
    };
  }

  const released =
    listStaffingAssignments(
      definition.id
    );

  removeStaffingAssignmentsForFunction(
    definition.id
  );
  removeBusinessFunctionDefinition(
    definition.id
  );
  removeFunctionChecks(definition.id);
  removeFunctionOrigin(definition.id);
  removePassOnRule(definition.id);

  const stillStaffed =
    new Set(
      listStaffingAssignments().map(
        (assignment) => assignment.workerName
      )
    );

  return {
    ok: true,
    removed: definition,
    releasedAssignments: released.length,
    orphanedWorkers: [
      ...new Set(
        released
          .map((assignment) => assignment.workerName)
          .filter(
            (workerName) => !stillStaffed.has(workerName)
          )
      ),
    ].sort(),
  };
}
