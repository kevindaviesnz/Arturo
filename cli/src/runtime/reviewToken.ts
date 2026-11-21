/**
 * Creates a review token.
 *
 * @returns Review token.
 *
 * PURE: No side effects.
 */
export function createReviewToken():
  string {
  return crypto.randomUUID();
}