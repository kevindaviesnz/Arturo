import {
  formatProcedureReference,
  validateProcedureDocument,
  type ProcedureDocument,
  type ProcedureReference,
} from "./procedure";

import {
  createSignedProcedure,
  type SignedProcedure,
} from "./procedureSigning";

/**
 * In-memory registry of signed, versioned Procedures. Immutable by version: a
 * given `proc-id@version` can be registered once and never overwritten — a
 * changed procedure must be published as a new version, so a Task reference
 * always resolves to exactly the instructions it was authored against.
 *
 * NOTE: persistence across restarts and command-driven authoring are follow-ups;
 * the model, integrity, and zero-trust resolution do not depend on them.
 */
let procedures = new Map<string, SignedProcedure>();

/**
 * Registers and signs a new Procedure version.
 *
 * SIDE EFFECT: Mutates the in-memory Procedure registry.
 */
export function registerProcedure(
  document: ProcedureDocument,
  secret: string
): SignedProcedure {
  const validationError =
    validateProcedureDocument(
      document
    );

  if (validationError) {
    throw new Error(
      validationError
    );
  }

  const key =
    formatProcedureReference({
      procedureId: document.procedureId,
      version: document.version,
    });

  if (procedures.has(key)) {
    throw new Error(
      `Procedure ${key} already exists. Publish a new version instead of overwriting an existing one.`
    );
  }

  const signed =
    createSignedProcedure(
      document,
      secret
    );

  procedures.set(
    key,
    signed
  );

  return signed;
}

/**
 * Gets a signed Procedure by exact-version reference.
 *
 * SIDE EFFECT: Reads the in-memory Procedure registry.
 */
export function getProcedure(
  reference: ProcedureReference
): SignedProcedure | undefined {
  return procedures.get(
    formatProcedureReference(
      reference
    )
  );
}

/**
 * Lists all registered Procedures.
 *
 * SIDE EFFECT: Reads the in-memory Procedure registry.
 */
export function listProcedures():
  SignedProcedure[] {
  return [
    ...procedures.values(),
  ];
}

/**
 * Clears the Procedure registry.
 *
 * SIDE EFFECT: Mutates the in-memory Procedure registry.
 */
export function clearProcedures(): void {
  procedures = new Map();
}
