import type { Job } from "./jobQueue";
import { getBusinessFunctionDefinition, getBusinessFunctionDefinitionByRuntimeId } from "../business/businessFunctionDefinitionStore";
import { listBusinessFunctions } from "../business/businessFunctionRuntimeStore";
import { loadEnterprises } from "../storage/enterpriseRepository";

export class JobOrganisationConflictError extends Error {
  constructor() {
    super("Job Enterprise conflicts with its Business Function ownership");
    this.name = "JobOrganisationConflictError";
  }
}

/**
 * Explicit Job and Function ownership must agree. Legacy unscoped work may
 * inherit the sole active Enterprise; ambiguous installations remain unscoped.
 * This resolver assigns scope, not identity or permission.
 */
export function resolveJobEnterpriseId(job: Job): string | undefined {
  const scopes = new Set<string>();
  if (job.enterpriseId) scopes.add(job.enterpriseId);
  for (const id of [job.businessFunctionId, job.owningJobId]) {
    if (!id) continue;
    const definition = getBusinessFunctionDefinition(id) ?? getBusinessFunctionDefinitionByRuntimeId(id);
    if (definition) scopes.add(definition.enterpriseId);
  }
  for (const runtime of listBusinessFunctions().filter((candidate) => candidate.jobIds.includes(job.id))) {
    const enterpriseId = getBusinessFunctionDefinitionByRuntimeId(runtime.id)?.enterpriseId;
    if (enterpriseId) scopes.add(enterpriseId);
  }
  if (scopes.size > 1) throw new JobOrganisationConflictError();
  if (scopes.size === 1) return [...scopes][0];
  const active = loadEnterprises().filter((enterprise) => enterprise.status === "active" || enterprise.status === "running");
  return active.length === 1 ? active[0].id : undefined;
}
