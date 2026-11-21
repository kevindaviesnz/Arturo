/**
 * A Procedure is the versioned, integrity-anchored, governed answer to "how does
 * a Worker perform this Task?". A Task carries only a lean reference
 * (`proc-<id>@<version>`); the instructions live here, in a registry, never in
 * the mutable task payload. This keeps the event ledger lean and preserves the
 * zero-trust property: a poisoned task queue can at most *reference* a Procedure,
 * and a Procedure that demands capabilities the Worker/governance won't grant
 * fails closed.
 */

export type ProcedureMode =
  | "generative"
  | "deterministic";

/** One deterministic step: a governed capability plus its instruction. */
export type ProcedureStep = {
  readonly capability: string;
  readonly instruction: string;
};

export type ProcedureDocument = {
  readonly procedureId: string;
  readonly version: number;
  readonly mode: ProcedureMode;
  // The authorization contract: every capability this Procedure may use. Checked
  // against the Worker's capabilities (and governance) before execution.
  readonly requiredCapabilities: readonly string[];
  // Generative: a method/prompt folded into the Worker prompt.
  readonly prompt?: string;
  // Deterministic: an ordered sequence of governed capability calls.
  readonly workflow?: readonly ProcedureStep[];
};

export type ProcedureReference = {
  readonly procedureId: string;
  readonly version: number;
};

const PROCEDURE_REFERENCE_PATTERN =
  /^(proc-[A-Za-z0-9-]+)@([1-9]\d*)$/;

/** Formats one immutable Procedure-version reference. */
export function formatProcedureReference(
  reference: ProcedureReference
): string {
  return `${reference.procedureId}@${reference.version}`;
}

/**
 * Parses an exact Procedure-version reference. The version suffix is mandatory —
 * a Task must never resolve to a newer Procedure version silently.
 *
 * PURE: No side effects.
 */
export function parseProcedureReference(
  value: string
): ProcedureReference {
  const match =
    PROCEDURE_REFERENCE_PATTERN.exec(
      value.trim()
    );

  if (!match) {
    throw new Error(
      `Invalid Procedure reference: ${value}. Use <proc-id>@<version>, for example proc-backup@1.`
    );
  }

  return {
    procedureId: match[1],
    version: Number(match[2]),
  };
}

/**
 * Validates a Procedure document. Returns an error message, or undefined when
 * the document is well-formed.
 *
 * PURE: No side effects.
 */
export function validateProcedureDocument(
  document: ProcedureDocument
): string | undefined {
  if (
    !/^proc-[A-Za-z0-9-]+$/.test(
      document.procedureId
    )
  ) {
    return `Invalid procedureId: ${document.procedureId}. Use proc-<name>.`;
  }

  if (
    !Number.isInteger(document.version) ||
    document.version < 1
  ) {
    return "Procedure version must be a positive integer.";
  }

  if (
    !Array.isArray(document.requiredCapabilities)
  ) {
    return "Procedure requiredCapabilities must be an array.";
  }

  if (document.mode === "generative") {
    if (
      !document.prompt ||
      document.prompt.trim().length === 0
    ) {
      return "A generative Procedure requires a non-empty prompt.";
    }
    return undefined;
  }

  if (document.mode === "deterministic") {
    if (
      !document.workflow ||
      document.workflow.length === 0
    ) {
      return "A deterministic Procedure requires at least one workflow step.";
    }

    for (const step of document.workflow) {
      if (
        !step.capability ||
        step.capability.trim().length === 0
      ) {
        return "Every deterministic workflow step requires a capability.";
      }

      // Every step's capability must be inside the declared contract, so the
      // authorization check on requiredCapabilities fully covers execution.
      if (
        !document.requiredCapabilities.includes(
          step.capability
        )
      ) {
        return `Deterministic step capability "${step.capability}" is not listed in requiredCapabilities.`;
      }
    }

    return undefined;
  }

  return `Unknown Procedure mode: ${(document as { mode?: string }).mode}`;
}

/**
 * Produces a canonical, order-stable serialization of a Procedure document for
 * signing, so the integrity signature is independent of key or list ordering.
 *
 * PURE: No side effects.
 */
export function canonicalProcedurePayload(
  document: ProcedureDocument
): string {
  return JSON.stringify({
    procedureId: document.procedureId,
    version: document.version,
    mode: document.mode,
    requiredCapabilities: [
      ...document.requiredCapabilities,
    ].sort(),
    prompt: document.prompt ?? null,
    workflow:
      document.workflow?.map(
        (step) => ({
          capability: step.capability,
          instruction: step.instruction,
        })
      ) ?? null,
  });
}
