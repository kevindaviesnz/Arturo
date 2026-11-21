/**
 * Interprets what an operator types when correcting a suggested Enterprise name.
 *
 * Guided setup asks "reply yes to call it X, or tell me what you'd prefer
 * instead" and previously stored any other reply verbatim. A first-time
 * operator answered "It's already called Marlowe Books" — a normal English
 * sentence — and that whole sentence became their company name, appearing in
 * every generated command from then on. Renaming was not possible, so the only
 * recovery was deleting the installation.
 *
 * A name is worth one extra keystroke to get right. A reply that reads as a
 * sentence is now interpreted and confirmed rather than swallowed.
 */

/** Lead-ins people use when stating a name conversationally. */
const LEAD_INS: readonly RegExp[] = [
  /^it'?s\s+(?:already\s+)?(?:called|named)\s+/i,
  /^(?:we'?re|we\s+are)\s+(?:called|named)\s+/i,
  /^(?:it\s+is|the\s+name\s+is|name\s+is|call\s+it|called)\s+/i,
  /^(?:the\s+business\s+is\s+called|the\s+company\s+is\s+called)\s+/i,
  /^(?:actually,?\s+)?(?:it'?s|its)\s+/i,
];

/** Longest a reply can be and still read as a bare name rather than a sentence. */
const MAX_NAME_WORDS = 6;

export type EnterpriseNameReply =
  | {
      /** The reply is a bare name and can be used directly. */
      readonly kind: "name";
      readonly name: string;
    }
  | {
      /** The reply reads as a sentence; confirm before using the extraction. */
      readonly kind: "needs-confirmation";
      readonly candidate: string;
      readonly original: string;
    };

function looksLikeBareName(
  value: string
): boolean {
  const words =
    value.split(/\s+/).filter(Boolean);

  return (
    words.length > 0 &&
    words.length <= MAX_NAME_WORDS &&
    // A sentence-ending full stop or a question mark means prose, not a name.
    !/[.?!]$/.test(value) &&
    // A leading verb or pronoun is how a sentence starts, not a company name.
    !/^(?:i|we|it|its|it's|the\s+name|call|please|no|yes|thats|that's)\b/i.test(value)
  );
}

/**
 * Strips a conversational lead-in and trailing punctuation from a reply.
 *
 * PURE: No side effects.
 */
export function extractNameCandidate(
  reply: string
): string {
  const withoutLeadIn =
    LEAD_INS.reduce(
      (value, pattern) => value.replace(pattern, ""),
      reply.trim()
    );

  return withoutLeadIn
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

/**
 * Classifies a typed name reply.
 *
 * PURE: No side effects.
 */
export function interpretEnterpriseNameReply(
  reply: string
): EnterpriseNameReply {
  const trimmed = reply.trim();

  if (looksLikeBareName(trimmed)) {
    return {
      kind: "name",
      name: extractNameCandidate(trimmed),
    };
  }

  const candidate =
    extractNameCandidate(trimmed);

  return looksLikeBareName(candidate) && candidate.length > 0
    ? {
        kind: "needs-confirmation",
        candidate,
        original: trimmed,
      }
    : {
        kind: "needs-confirmation",
        candidate: "",
        original: trimmed,
      };
}

/**
 * Formats the question asked before accepting an interpreted name.
 *
 * Every variant restates the full set of ways out. A walkthrough got the bare
 * "type just the name" three turns in a row: the re-prompt named no options,
 * and the earlier model-suggested name had been silently dropped, so "yes" no
 * longer worked and nothing on screen said how to escape. A re-prompt must
 * stand on its own — the operator may be three exchanges past the question it
 * is re-asking.
 *
 * PURE: No side effects.
 */
export function formatNameConfirmationPrompt(
  candidate: string,
  standingSuggestion?: string
): string {
  if (candidate) {
    return [
      `Just to be sure I get this right — should the business be called "${candidate}"?`,
      "",
      'Reply "yes" to use it, or type the name on its own.',
    ].join("\n");
  }

  return standingSuggestion
    ? [
        "Sorry — I want to record the name exactly right, and that read like a sentence rather than a name.",
        "",
        `Reply "yes" to call it "${standingSuggestion}", type just the name you prefer on its own, or "cancel" to stop.`,
      ].join("\n")
    : [
        "Sorry — I want to record the name exactly right, and that read like a sentence rather than a name.",
        "",
        'Please type just the name on its own, or "cancel" to stop.',
      ].join("\n");
}
