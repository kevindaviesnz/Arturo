import {
  parseProcedureReference,
  validateProcedureDocument,
  type ProcedureDocument,
} from "./procedure";

import {
  verifyProcedureSignature,
} from "./procedureSigning";

import {
  getProcedure,
} from "./procedureStore";

export type ProcedureResolution =
  | {
      readonly ok: true;
      readonly document: ProcedureDocument;
    }
  | {
      readonly ok: false;
      readonly reason: string;
    };

/**
 * Resolves a Task's Procedure reference to an executable document, enforcing the
 * zero-trust contract before any instruction is used:
 *   1. the reference parses to an exact version,
 *   2. the Procedure exists in the registry,
 *   3. its integrity signature verifies (fail closed on tamper),
 *   4. the document is well-formed,
 *   5. every capability it declares is one the Worker holds.
 *
 * Any failure returns `ok: false` — the caller must not execute. Instructions
 * therefore only ever come from a resolved, verified, authorized Procedure,
 * never from the mutable task payload.
 *
 * SIDE EFFECT: Reads the Procedure registry.
 */
export function resolveProcedureForExecution(
  procedureRef: string,
  workerCapabilities: readonly string[],
  secret: string
): ProcedureResolution {
  let reference;

  try {
    reference =
      parseProcedureReference(
        procedureRef
      );
  } catch (error: unknown) {
    return {
      ok: false,
      reason:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }

  const signed =
    getProcedure(
      reference
    );

  if (!signed) {
    return {
      ok: false,
      reason: `Procedure not found: ${procedureRef}`,
    };
  }

  if (
    !verifyProcedureSignature(
      signed,
      secret
    )
  ) {
    return {
      ok: false,
      reason: `Procedure ${procedureRef} failed its integrity check and was refused.`,
    };
  }

  const validationError =
    validateProcedureDocument(
      signed.document
    );

  if (validationError) {
    return {
      ok: false,
      reason: `Procedure ${procedureRef} is invalid: ${validationError}`,
    };
  }

  const missingCapabilities =
    signed.document.requiredCapabilities.filter(
      (capability) =>
        !workerCapabilities.includes(
          capability
        )
    );

  if (missingCapabilities.length > 0) {
    return {
      ok: false,
      reason: `Worker is not authorized for capabilities required by ${procedureRef}: ${missingCapabilities.join(", ")}.`,
    };
  }

  return {
    ok: true,
    document: signed.document,
  };
}

/**
 * Formats a resolved generative Procedure as an authoritative instruction block
 * to fold into the Worker prompt.
 *
 * PURE: No side effects.
 */
export function formatGenerativeProcedureBlock(
  document: ProcedureDocument,
  procedureRef: string
): string {
  return [
    `Authoritative Procedure (${procedureRef}) — follow these instructions to perform the Task:`,
    document.prompt?.trim() ?? "",
  ].join("\n");
}
