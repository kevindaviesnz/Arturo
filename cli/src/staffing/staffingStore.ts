import { runtimeDb } from "../storage/runtimeDatabase";

export type StaffingAssignment = {
  readonly businessFunctionId: string;
  readonly workerName: string;
  readonly role: "ai" | "human-approver";
  readonly rationale: string;
};

export function saveStaffingAssignment(assignment: StaffingAssignment): void {
  runtimeDb.prepare(`
    INSERT OR REPLACE INTO business_function_staffing
      (business_function_id, worker_name, role, human_approval_required, rationale)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    assignment.businessFunctionId,
    assignment.workerName,
    assignment.role,
    assignment.role === "human-approver" ? 1 : 0,
    assignment.rationale
  );
}

export function listStaffingAssignments(
  businessFunctionId?: string
): readonly StaffingAssignment[] {
  const rows = businessFunctionId
    ? runtimeDb.prepare(`
        SELECT business_function_id, worker_name, role, rationale
        FROM business_function_staffing WHERE business_function_id = ?
      `).all(businessFunctionId)
    : runtimeDb.prepare(`
        SELECT business_function_id, worker_name, role, rationale
        FROM business_function_staffing
      `).all();

  return (rows as any[]).map((row) => ({
    businessFunctionId: row.business_function_id,
    workerName: row.worker_name,
    role: row.role,
    rationale: row.rationale,
  }));
}

/** Removes current Business Function coverage assigned to one Worker. */
export function removeStaffingAssignmentsForWorker(
  workerName: string
): number {
  const result =
    runtimeDb
      .prepare(`
        DELETE FROM business_function_staffing
        WHERE worker_name = ?
      `)
      .run(
        workerName
      );

  return result.changes;
}

export function removeStaffingAssignmentsForFunction(
  businessFunctionId: string
): void {
  runtimeDb.prepare(`
    DELETE FROM business_function_staffing WHERE business_function_id = ?
  `).run(businessFunctionId);
}

export function clearStaffingAssignments(): void {
  runtimeDb.prepare("DELETE FROM business_function_staffing").run();
}
