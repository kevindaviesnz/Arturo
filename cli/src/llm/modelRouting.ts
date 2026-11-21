import {
  getSelectedModel,
} from "./modelSelection";

export type PaidEscalationReason =
  | "repeated-structured-output-failure"
  | "local-provider-failure"
  | "human-authorized-quality-review";

export type ModelRoutingStatus = {
  readonly mode: "single" | "local-first";
  readonly localProvider: "ollama";
  readonly localModel: string;
  readonly paidEscalationEnabled: boolean;
  readonly paidProvider: "gemini";
  readonly paidModel?: string;
  readonly maxPaidCallsPerSession: number;
  readonly paidCallsUsed: number;
  readonly paidCallsRemaining: number;
  readonly configured: boolean;
  readonly configurationError?: string;
  readonly lastEscalationReason?: PaidEscalationReason;
};

let paidCallsUsed = 0;
let lastEscalationReason: PaidEscalationReason | undefined;

function nonNegativeInteger(value: string | undefined): number {
  if (!value?.trim()) return 0;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

/** Reads the fail-closed model-routing policy from the process environment. */
export function getModelRoutingStatus(): ModelRoutingStatus {
  const mode = process.env.ARTURO_LLM_ROUTING_MODE === "local-first"
    ? "local-first"
    : "single";
  const paidEscalationEnabled = process.env.ARTURO_PAID_ESCALATION_ENABLED === "true";
  const paidModel = process.env.ARTURO_PAID_ESCALATION_MODEL?.trim() || undefined;
  const maxPaidCallsPerSession = nonNegativeInteger(
    process.env.ARTURO_PAID_ESCALATION_MAX_CALLS_PER_SESSION
  );
  const errors = [
    mode !== "local-first" ? "routing mode is not local-first" : undefined,
    !paidEscalationEnabled ? "paid escalation is disabled" : undefined,
    !paidModel ? "ARTURO_PAID_ESCALATION_MODEL is not set" : undefined,
    !process.env.GEMINI_API_KEY?.trim() ? "GEMINI_API_KEY is not set" : undefined,
    maxPaidCallsPerSession < 1 ? "paid escalation call budget is zero" : undefined,
  ].filter((item): item is string => Boolean(item));
  const paidCallsRemaining = Math.max(0, maxPaidCallsPerSession - paidCallsUsed);

  return {
    mode,
    localProvider: "ollama",
    // The operator's runtime /model choice outranks the install-time
    // environment default. Only a LOCAL selection is honoured here; a paid
    // selection never changes the local route — it is applied per call
    // through the budget-capped escalation path, so it can never become an
    // implicit default.
    localModel:
      (() => {
        const selected = getSelectedModel();
        return selected?.provider === "ollama"
          ? selected.model
          : process.env.ARTURO_LLM_MODEL ?? "llama3.2:latest";
      })(),
    paidEscalationEnabled,
    paidProvider: "gemini",
    paidModel,
    maxPaidCallsPerSession,
    paidCallsUsed,
    paidCallsRemaining,
    configured: errors.length === 0,
    configurationError: errors.join("; ") || undefined,
    lastEscalationReason,
  };
}

/** True only when paid escalation is configured and the session budget remains. */
export function canUsePaidEscalation(): boolean {
  const status = getModelRoutingStatus();
  return status.configured && status.paidCallsRemaining > 0;
}

/** Reserves one paid call before network I/O so failures cannot bypass the cap. */
export function reservePaidEscalation(reason: PaidEscalationReason): ModelRoutingStatus {
  const status = getModelRoutingStatus();
  if (!status.configured) {
    throw new Error(`Paid model escalation is not configured: ${status.configurationError}`);
  }
  if (status.paidCallsRemaining < 1) {
    throw new Error("Paid model escalation session call budget is exhausted");
  }
  paidCallsUsed += 1;
  lastEscalationReason = reason;
  return getModelRoutingStatus();
}

/** Resets process-local routing usage. Intended for tests and application reset. */
export function resetModelRoutingUsage(): void {
  paidCallsUsed = 0;
  lastEscalationReason = undefined;
}
