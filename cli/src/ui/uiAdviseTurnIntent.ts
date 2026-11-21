/**
 * Classifies what an operator's reply in guided setup is actually doing.
 *
 * A first-run walkthrough produced two moments where the adviser plainly
 * ignored the operator: "Can we get on with it?" and "Isn't that what this is
 * meant to be doing?" Both got a paragraph of warmth and another interview
 * question. Adding a prose rule to the prompt did not fix it — a small local
 * model reliably deflects anyway.
 *
 * So the decision is made here instead, and the model is told what kind of turn
 * to produce rather than being trusted to notice. Recognising "I want to stop"
 * is exactly the sort of thing that should not depend on model judgement.
 */

export type OperatorTurnIntent =
  | "answer"
  | "question"
  | "pushback"
  | "complete";

/**
 * Phrases that mean "I have finished answering, please proceed".
 *
 * The pushback list below was built from a persona who got annoyed, so it only
 * recognises frustration. A polite operator signals the same thing warmly —
 * "That's everything", "I'm done", "Yes, let's go" — and every one of those was
 * classified as an ordinary answer, so the adviser asked yet another question.
 * A short reply like that also gets absorbed as the answer to whatever was just
 * asked, which is how "Manaaki Kai Trust" became the name of a person
 * responsible for daily operations.
 */
const COMPLETE_PATTERNS: readonly RegExp[] = [
  /\bthat'?s (about )?(it|all|everything)\b/i,
  /\bthat'?s all i'?ve got\b/i,
  /\b(i'?m|we'?re) (done|finished)\b/i,
  /\b(nothing|nothing much) else\b/i,
  /\b(can|shall|should) we (get started|start|begin|crack on)\b/i,
  /\b(let'?s|lets) (go|start|begin|do it|get started)\b/i,
  /\bgo (ahead|for it)\b/i,
  /\bready when you are\b/i,
  /\b(you|that) (have|has|'?ve) (enough|all of it)\b/i,
];

/** Phrases that mean "stop interviewing me and get on with it". */
const PUSHBACK_PATTERNS: readonly RegExp[] = [
  /\b(get on with it|hurry up|move on|crack on)\b/i,
  /\b(just|please)\s+(set it up|do it|start|build it|get started)\b/i,
  /\b(i'?ve|i have)\s+(told|given)\s+you\s+(everything|enough|all)\b/i,
  /\bthat'?s enough\b/i,
  /\b(how many more|how long does this|are we nearly)\b/i,
  /\b(stop asking|no more questions|enough questions)\b/i,
  /\b(this is taking|we'?re going round)\b/i,
];

/** Replies that read as a direct question to the adviser, not an answer. */
const QUESTION_PATTERNS: readonly RegExp[] = [
  /^(?:isn'?t|is|are|does|do|can|could|should|would|will|why|what|how|who|when|where)\b[^?]*\?/i,
  /\b(what does that mean|i don'?t understand|why do you need|why are you asking)\b/i,
];

/**
 * Returns what the operator's reply is doing.
 *
 * Pushback wins over a question mark: "can we get on with it?" is a request to
 * stop, not a question to answer. Completion is checked the same way and for
 * the same reason: "Shall we begin?" is not a question awaiting an answer.
 *
 * PURE: No side effects.
 */
export function classifyOperatorTurn(
  reply: string
): OperatorTurnIntent {
  const trimmed = reply.trim();

  if (
    PUSHBACK_PATTERNS.some(
      (pattern) => pattern.test(trimmed)
    )
  ) {
    return "pushback";
  }

  if (
    COMPLETE_PATTERNS.some(
      (pattern) => pattern.test(trimmed)
    )
  ) {
    return "complete";
  }

  return QUESTION_PATTERNS.some(
    (pattern) => pattern.test(trimmed)
  )
    ? "question"
    : "answer";
}

/**
 * Returns the per-turn instruction for a classified reply, or undefined when
 * the reply is an ordinary answer and the normal instruction applies.
 *
 * `canEnd` is false while the conversation is still below its minimum number of
 * answers, where a READY marker is discarded by the caller. Telling the model to
 * end anyway produced a turn that thanked the operator and asked nothing, then
 * sat waiting for a reply — so when the conversation cannot end yet, say why and
 * ask for the one thing still missing instead of pretending to stop.
 *
 * PURE: No side effects.
 */
export function instructionForOperatorTurn(
  intent: OperatorTurnIntent,
  canEnd: boolean = true
): string | undefined {
  if (intent === "pushback" || intent === "complete") {
    const acknowledgement =
      intent === "pushback"
        ? "The operator has told you to stop asking questions."
        : "The operator has told you they have finished answering.";

    return canEnd
      ? [
          acknowledgement,
          "Do not ask another question.",
          intent === "pushback"
            ? "Acknowledge it in one short sentence, without defending yourself and without a summary of what you have learned,"
            : "Thank them in one short sentence, without a summary of what you have learned,",
          "then end your reply on its own final line with exactly: READY",
        ].join(" ")
      : [
          acknowledgement,
          "You still need a little more before you can set the business up.",
          "Acknowledge that in one short sentence, say plainly that you need one more thing,",
          "then ask the single most important question you have left. Ask nothing else.",
        ].join(" ");
  }

  if (intent === "question") {
    return [
      "The operator has asked you a direct question. Answer it plainly in one or two sentences before anything else.",
      "If they are asking whether Arturo will do the work: yes — Arturo will organise this business into ongoing Functions and give them Workers, which is what you are setting up now.",
      "After answering, either ask one more genuinely useful question, or end your reply on its own final line with exactly: READY if you already understand enough.",
    ].join(" ");
  }

  return undefined;
}
