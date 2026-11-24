/**
 * Later staff changes: every add, role change or removal is an Event on
 * the Timeline, and a Function's last AI worker cannot be removed unless
 * the Function is people-only or locked (setup-and-staff final v3, 4h).
 * Removing a worker that unfinished work still needs stays refused in
 * safelyRemoveWorker (control/workerRemoval.ts).
 *
 * SIDE EFFECT: Reads staffing and Function marks; may append a runtime event.
 */

import { effectiveFunctionMark, isBlockingFunctionMark } from "../business/functionMark";
import { listBusinessFunctionDefinitions } from "../business/businessFunctionDefinitionStore";
import { broadcastEvent } from "../runtime/runtimeEventPublisher";
import { listStaffingAssignments, removeStaffingAssignmentsForWorker } from "./staffingStore";

/** Why a Function's last AI worker may not be removed. PURE. */
export function refuseRemoveLastAiWorker(
  functionId: string,
  workerName: string
): string | undefined {
  const assignments = listStaffingAssignments(functionId).filter((row) => row.role === "ai");
  const stillNeeded = assignments.filter(
    (row) => row.workerName.trim().toLowerCase() !== workerName.trim().toLowerCase()
  );
  if (assignments.length === 0) return undefined;
  if (stillNeeded.length > 0) return undefined;
  if (isBlockingFunctionMark(effectiveFunctionMark(functionId))) return undefined;
  const label =
    listBusinessFunctionDefinitions().find((definition) => definition.id === functionId)?.label ??
    "this Function";
  return (
    `Removing ${workerName} would leave ${label} with no AI worker, ` +
    "and that Function is not people-only or locked. Nothing was changed."
  );
}

/**
 * Refuses removing a worker who is the last AI on any Function that still
 * needs one. SIDE EFFECT: Reads staffing and Function marks.
 */
export function refuseRemoveLastAiAnywhere(workerName: string): string | undefined {
  const functionIds = [
    ...new Set(
      listStaffingAssignments()
        .filter((row) => row.role === "ai" && row.workerName.trim().toLowerCase() === workerName.trim().toLowerCase())
        .map((row) => row.businessFunctionId)
    ),
  ];
  for (const functionId of functionIds) {
    const refused = refuseRemoveLastAiWorker(functionId, workerName);
    if (refused) return refused;
  }
  return undefined;
}

/** Records a staff change as an Event on the Timeline. SIDE EFFECT: Appends a runtime event. */
export function recordStaffChangeEvent(input: {
  readonly what: string;
  readonly by: string;
}): void {
  broadcastEvent("staff.changed", "info", `${input.by} ${input.what}`);
}

/**
 * Drops one worker's Function assignments only when that would not leave
 * an AI-allowed Function without an AI worker.
 * SIDE EFFECT: May delete staffing rows.
 */
export function unassignWorkerIfAllowed(workerName: string): { readonly removed: number } | { readonly refused: string } {
  const refused = refuseRemoveLastAiAnywhere(workerName);
  if (refused) return { refused };
  return { removed: removeStaffingAssignmentsForWorker(workerName) };
}
