import crypto from "crypto";

import {
  canonicalProcedurePayload,
  type ProcedureDocument,
} from "./procedure";

export type SignedProcedure = {
  readonly document: ProcedureDocument;
  readonly signature: string;
};

/**
 * Signs a Procedure document. The signature makes the registry tamper-evident:
 * an attacker who edits a stored Procedure (to inject instructions or broaden its
 * capabilities) cannot re-sign it without the secret, so resolution fails closed.
 *
 * PURE: No side effects.
 */
export function signProcedureDocument(
  document: ProcedureDocument,
  secret: string
): string {
  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(
      canonicalProcedurePayload(
        document
      )
    )
    .digest(
      "hex"
    );
}

/** Attaches an integrity signature to a Procedure document. */
export function createSignedProcedure(
  document: ProcedureDocument,
  secret: string
): SignedProcedure {
  return {
    document,
    signature:
      signProcedureDocument(
        document,
        secret
      ),
  };
}

/**
 * Verifies a stored Procedure's integrity signature.
 *
 * PURE: No side effects.
 */
export function verifyProcedureSignature(
  signed: SignedProcedure,
  secret: string
): boolean {
  const expected =
    Buffer.from(
      signProcedureDocument(
        signed.document,
        secret
      )
    );

  const actual =
    Buffer.from(
      signed.signature
    );

  if (
    expected.length !==
    actual.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    expected,
    actual
  );
}
