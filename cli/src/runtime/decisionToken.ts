import crypto from "crypto";

/**
 * Creates a secure random decision token.
 *
 * @returns Random URL-safe token.
 *
 * SIDE EFFECT: Uses cryptographic randomness.
 */
export function createDecisionToken():
  string {
  return crypto
    .randomBytes(32)
    .toString("base64url");
}

/**
 * Hashes a decision token for safe storage.
 *
 * @param token Raw decision token.
 * @returns SHA-256 token hash.
 *
 * PURE: No side effects.
 */
export function hashDecisionToken(
  token: string
): string {
  return crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
}

/**
 * Verifies a raw decision token against a stored hash.
 *
 * @param token Raw decision token from request.
 * @param tokenHash Stored token hash.
 * @returns True when token matches hash.
 *
 * PURE: No side effects.
 */
export function verifyDecisionToken(
  token: string,
  tokenHash: string
): boolean {
  const expected =
    Buffer.from(
      hashDecisionToken(token)
    );

  const actual =
    Buffer.from(
      tokenHash
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