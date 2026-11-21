/**
 * Recognises the short replies an operator gives to a yes/no question.
 *
 * Kept apart from any one flow: guided setup reads them to resolve a name
 * confirmation, and the line interface reads them to recognise an answer that
 * arrived with nothing left to confirm.
 */

const AFFIRMATIVE_REPLIES: ReadonlySet<string> = new Set([
  "yes",
  "yeah",
  "yep",
  "yup",
  "ok",
  "okay",
  "sure",
  "sounds good",
  "that works",
  "thats good",
  "that's good",
  "great",
  "perfect",
  "good",
  "fine",
  "correct",
  "yes please",
]);

const NEGATIVE_REPLIES: ReadonlySet<string> = new Set([
  "no",
  "nope",
  "nah",
  "not that",
  "not really",
  "no thanks",
  "i dont like it",
  "i don't like it",
]);

/**
 * Normalises a short reply for comparison: case and trailing punctuation carry
 * no meaning in a yes/no answer.
 *
 * PURE: No side effects.
 */
export function normaliseShortReply(
  text: string
): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "")
    .trim();
}

/**
 * Whether the reply accepts what was offered.
 *
 * PURE: No side effects.
 */
export function isAffirmative(
  text: string
): boolean {
  return AFFIRMATIVE_REPLIES.has(
    normaliseShortReply(text)
  );
}

/**
 * Whether the reply declines what was offered.
 *
 * PURE: No side effects.
 */
export function isNegative(
  text: string
): boolean {
  return NEGATIVE_REPLIES.has(
    normaliseShortReply(text)
  );
}
