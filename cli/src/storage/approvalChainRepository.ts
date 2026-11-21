import type { ApprovalChain } from "../runtime/approvalChainStore";
import { runtimeDb } from "./runtimeDatabase";

export function loadApprovalChains(): ApprovalChain[] {
  const rows = runtimeDb.prepare(`
    SELECT job_id AS jobId, required_approvals AS requiredApprovals,
           decisions_json AS decisionsJson, status, policy_json AS policyJson,
           governance_policy_id AS governancePolicyId,
           requirements_signature AS requirementsSignature
    FROM approval_chains
  `).all() as Array<Record<string, unknown>>;
  return rows.map((row) => ({
    jobId: String(row.jobId),
    requiredApprovals: Number(row.requiredApprovals),
    decisions: JSON.parse(String(row.decisionsJson)),
    status: row.status as ApprovalChain["status"],
    ...(row.policyJson ? { policy: JSON.parse(String(row.policyJson)) } : {}),
    ...(row.governancePolicyId
      ? { governancePolicyId: String(row.governancePolicyId) }
      : {}),
    ...(row.requirementsSignature
      ? { requirementsSignature: String(row.requirementsSignature) }
      : {}),
  }));
}

export function saveApprovalChain(chain: ApprovalChain): void {
  runtimeDb.prepare(`
    INSERT OR REPLACE INTO approval_chains (
      job_id, required_approvals, decisions_json, status, policy_json,
      governance_policy_id, requirements_signature
    ) VALUES (@jobId, @requiredApprovals, @decisionsJson, @status, @policyJson,
      @governancePolicyId, @requirementsSignature)
  `).run({
    jobId: chain.jobId,
    requiredApprovals: chain.requiredApprovals,
    decisionsJson: JSON.stringify(chain.decisions),
    status: chain.status,
    policyJson: chain.policy ? JSON.stringify(chain.policy) : null,
    governancePolicyId: chain.governancePolicyId ?? null,
    requirementsSignature: chain.requirementsSignature ?? null,
  });
}

export function clearPersistedApprovalChains(): void {
  runtimeDb.prepare("DELETE FROM approval_chains").run();
}
