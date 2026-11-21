import { builtInCapabilityRegistry } from "../kernel/builtInCapabilities";
import type { CapabilityDefinition, CapabilityRiskLevel } from "../kernel/capabilityDefinition";

/** Routing authority and unmatched-policy approval are separate decisions. */
type WorkerCapabilityDefinition = {
  routingAuthorityOrder?: number;
  kernelCapabilityId?: string;
  requiresDefaultJobApproval: boolean;
};
const cognitive = (): WorkerCapabilityDefinition => ({ requiresDefaultJobApproval: false });
const restricted = (routingAuthorityOrder: number, requiresDefaultJobApproval = false, kernelCapabilityId?: string): WorkerCapabilityDefinition => ({
  routingAuthorityOrder, requiresDefaultJobApproval, kernelCapabilityId,
});

/** Authoritative Worker vocabulary. Property order preserves the public list. */
export const workerCapabilityDefinitions = {
  llm: cognitive(),
  writing: cognitive(),
  research: cognitive(),
  review: cognitive(),
  "human-review": restricted(2),
  "human-contact": restricted(3, true),
  analysis: cognitive(),
  conversion: cognitive(),
  advice: cognitive(),
  planning: cognitive(),
  coordination: cognitive(),
  monitoring: cognitive(),
  simulation: cognitive(),
  optimization: cognitive(),
  negotiation: cognitive(),
  safety: restricted(4),
  coaching: cognitive(),
  execution: restricted(5),
  backup: restricted(6),
  "email-draft": cognitive(),
  "email-send": restricted(7, true, "email.send"),
  "file-read": restricted(8),
  "file-write": restricted(9, true),
  "shell-read": restricted(10),
  "shell-execute": restricted(11, true, "shell.exec"),
  web: restricted(12),
  "web-research": restricted(13),
  summarisation: cognitive(),
  "office-read": restricted(0),
  "office-write": restricted(1, true),
} satisfies Record<string, WorkerCapabilityDefinition>;

export type WorkerCapability = keyof typeof workerCapabilityDefinitions;
export const CORE_CAPABILITIES: readonly WorkerCapability[] = Object.keys(workerCapabilityDefinitions) as WorkerCapability[];
export const CONSEQUENTIAL_CAPABILITIES: readonly WorkerCapability[] = CORE_CAPABILITIES
  .filter(id => workerCapabilityDefinitions[id].routingAuthorityOrder !== undefined)
  .sort((a, b) => workerCapabilityDefinitions[a].routingAuthorityOrder! - workerCapabilityDefinitions[b].routingAuthorityOrder!);

export function isWorkerCapability(id: string): id is WorkerCapability {
  return Object.hasOwn(workerCapabilityDefinitions, id);
}

export function requiresExactWorkerAuthority(id: WorkerCapability): boolean {
  return workerCapabilityDefinitions[id]?.routingAuthorityOrder !== undefined;
}

export type ExecutionWorkerCapability = "web" | "email-send" | "file-read" | "file-write" | "shell-read" | "shell-execute";
type ExecutionCapability = { requiredWorkerCapability?: ExecutionWorkerCapability; externalSideEffect: boolean };

// Permission requirements do not imply equivalence: "web" permits several
// operations, and must not inherit one arbitrarily selected operation's schema.
const executionCapabilities: Readonly<Record<string, ExecutionCapability>> = {
  "http.get": { requiredWorkerCapability: "web", externalSideEffect: true },
  "http.post": { requiredWorkerCapability: "web", externalSideEffect: true },
  "webhook.send": { requiredWorkerCapability: "web", externalSideEffect: true },
  "email.send": { requiredWorkerCapability: "email-send", externalSideEffect: true },
  "shell.exec": { externalSideEffect: true },
  "file.delete": { externalSideEffect: true },
};

export function getRequiredWorkerCapabilityForExecution(id: string): ExecutionWorkerCapability | undefined {
  return Object.hasOwn(executionCapabilities, id) ? executionCapabilities[id].requiredWorkerCapability : undefined;
}

/** Built-in definitions own operation schemas, risk, kernel approval and timeouts. */
export function resolveCapabilityDefinition(id: string): CapabilityDefinition | undefined {
  const kernelId = isWorkerCapability(id)
    ? workerCapabilityDefinitions[id].kernelCapabilityId ?? id
    : id;
  return Object.hasOwn(builtInCapabilityRegistry, kernelId) ? builtInCapabilityRegistry[kernelId] : undefined;
}

export function getCapabilityRiskLevel(id: string): CapabilityRiskLevel {
  return resolveCapabilityDefinition(id)?.riskLevel ?? "low";
}

export function getCapabilityTimeoutMs(id: string): number {
  return resolveCapabilityDefinition(id)?.timeoutMs ?? 0;
}

/** Preserve Job policy defaults independently of kernel requiresApproval. */
export function requiresDefaultJobApproval(id: string): boolean {
  if (isWorkerCapability(id) && workerCapabilityDefinitions[id].requiresDefaultJobApproval) return true;
  if (Object.hasOwn(executionCapabilities, id) && executionCapabilities[id].externalSideEffect) return true;
  const risk = getCapabilityRiskLevel(id);
  return risk === "high" || risk === "critical";
}
