import type {
  DelegationRequest,
} from "../delegation/delegation";

import {
  runtimeDb,
} from "./runtimeDatabase";

export function savePersistedDelegation(
  request: DelegationRequest
): void {
  runtimeDb.prepare(`
    INSERT OR REPLACE INTO delegations (
      id, from_business_function, to_business_function, work, status,
      job_id, worker_name, required_capabilities, result, error,
      created_at, completed_at
    ) VALUES (
      @id, @fromBusinessFunction, @toBusinessFunction, @work, @status,
      @jobId, @workerName, @requiredCapabilities, @result, @error,
      @createdAt, @completedAt
    )
  `).run({
    ...request,
    jobId: request.jobId ?? null,
    workerName: request.workerName ?? null,
    requiredCapabilities: JSON.stringify(request.requiredCapabilities ?? []),
    result: request.result ?? null,
    error: request.error ?? null,
    completedAt: request.completedAt ?? null,
  });
}

export function loadPersistedDelegations(): DelegationRequest[] {
  return (runtimeDb.prepare(`
    SELECT id, from_business_function as fromBusinessFunction,
      to_business_function as toBusinessFunction, work, status,
      job_id as jobId, worker_name as workerName,
      required_capabilities as requiredCapabilities, result, error,
      created_at as createdAt, completed_at as completedAt
    FROM delegations ORDER BY created_at ASC
  `).all() as any[]).map((row) => ({
    ...row,
    jobId: row.jobId ?? undefined,
    workerName: row.workerName ?? undefined,
    requiredCapabilities: JSON.parse(row.requiredCapabilities ?? "[]"),
    result: row.result ?? undefined,
    error: row.error ?? undefined,
    completedAt: row.completedAt ?? undefined,
  }));
}

export function clearPersistedDelegations(): void {
  runtimeDb.prepare("DELETE FROM delegations").run();
}
