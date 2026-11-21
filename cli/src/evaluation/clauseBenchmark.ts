/**
 * Scores a model's clause-by-clause verdicts against a lawyer's answers.
 *
 * A demonstration showed what a lawyer actually asks of a review: does it miss
 * real problems, does it raise problems that are not there, and does it ever
 * get a clause backwards. One headline accuracy hides the difference between
 * a model that is cautious and one that cries wolf, so each is counted
 * separately and in words a lawyer uses.
 *
 * PURE: No side effects.
 */

import { parseClauseVerdict, type ClauseVerdict } from "../agents/clauseCoverage";
import type { AnswerKey, ExpectedVerdict } from "./clauseAnswerKey";

export type ClauseOutcome =
  | "right"
  /** Called a fair or unclear clause one-sided. */
  | "false alarm"
  /** Called a one-sided clause fair or unclear: a real problem missed. */
  | "missed problem"
  /** Called it one-sided in favour of the wrong party. */
  | "backwards"
  /** Called it balanced where the wording leaves it unclear, or the reverse. */
  | "wrong call"
  /** Gave no verdict at all. */
  | "no verdict";

export type ScoredClause = {
  readonly clause: number;
  readonly heading: string;
  readonly given: string;
  readonly expected: string;
  readonly outcome: ClauseOutcome;
};

const partyMatches = (given: string | undefined, expected: string | undefined): boolean =>
  Boolean(given && expected) && given!.toLowerCase().includes(expected!.toLowerCase());

/** PURE: No side effects. */
export function describeGiven(verdict: ClauseVerdict): string {
  if (verdict.verdict !== "one-sided") return verdict.verdict;
  return verdict.favours ? `one-sided, favours ${verdict.favours}` : "one-sided, party not named";
}

/** PURE: No side effects. */
export function describeExpected(expected: ExpectedVerdict): string {
  return expected.accept
    .map((verdict) => (verdict === "one-sided" ? `one-sided, favours ${expected.favours}` : verdict))
    .join(" or ");
}

/** PURE: No side effects. */
export function scoreClause(expected: ExpectedVerdict, answer: string): ScoredClause {
  const verdict = parseClauseVerdict(answer);
  const base = { clause: expected.clause, heading: expected.heading, given: describeGiven(verdict), expected: describeExpected(expected) };
  const outcome = ((): ClauseOutcome => {
    if (verdict.verdict === "not stated") return "no verdict";
    const oneSidedExpected = expected.accept.includes("one-sided");
    if (verdict.verdict === "one-sided") {
      if (!oneSidedExpected) return "false alarm";
      return partyMatches(verdict.favours, expected.favours) ? "right" : "backwards";
    }
    if (expected.accept.includes(verdict.verdict)) return "right";
    return oneSidedExpected && !expected.accept.some((accepted) => accepted !== "one-sided")
      ? "missed problem"
      : "wrong call";
  })();
  return { ...base, outcome };
}

export type DocumentScore = {
  readonly title: string;
  readonly run: number;
  readonly clauses: readonly ScoredClause[];
};

/** PURE: No side effects. */
export function scoreDocument(key: AnswerKey, run: number, answers: ReadonlyMap<number, string>): DocumentScore {
  return {
    title: key.title,
    run,
    clauses: key.answers.map((expected) => scoreClause(expected, answers.get(expected.clause) ?? "")),
  };
}

export type BenchmarkSummary = {
  readonly clauses: number;
  readonly right: number;
  readonly counts: Readonly<Record<ClauseOutcome, number>>;
};

/** PURE: No side effects. */
export function summarise(scores: readonly DocumentScore[]): BenchmarkSummary {
  const counts: Record<ClauseOutcome, number> = {
    right: 0,
    "false alarm": 0,
    "missed problem": 0,
    backwards: 0,
    "wrong call": 0,
    "no verdict": 0,
  };
  for (const score of scores) for (const clause of score.clauses) counts[clause.outcome] += 1;
  const clauses = scores.reduce((total, score) => total + score.clauses.length, 0);
  return { clauses, right: counts.right, counts };
}

/**
 * The report a person reads: the headline in a lawyer's words, then every
 * clause that went wrong.
 *
 * PURE: No side effects.
 */
export function formatBenchmarkReport(input: {
  readonly model: string;
  readonly runAt: string;
  readonly scores: readonly DocumentScore[];
}): string {
  const total = summarise(input.scores);
  const percent = total.clauses > 0 ? Math.round((total.right / total.clauses) * 100) : 0;
  const runs = new Set(input.scores.map((score) => score.run)).size;
  const lines = [
    `# Clause verdict benchmark: ${input.model}`,
    "",
    `Run ${input.runAt}. ${runs} run${runs === 1 ? "" : "s"} over the demonstration agreements, ${total.clauses} clause verdicts in all.`,
    "",
    `**${total.right} of ${total.clauses} right (${percent}%).**`,
    "",
    `- Backwards (one-sided, but for the wrong party): ${total.counts.backwards}`,
    `- Missed problems (a one-sided clause called fair or unclear): ${total.counts["missed problem"]}`,
    `- False alarms (a fair or unclear clause called one-sided): ${total.counts["false alarm"]}`,
    `- Other wrong calls (balanced and unclear confused): ${total.counts["wrong call"]}`,
    `- No verdict given: ${total.counts["no verdict"]}`,
    "",
    "The answers it is scored against were written by the Arturo team as a lawyer would read these clauses. They have not been signed off by a lawyer; confirm them with one before quoting this score.",
    "",
  ];
  for (const score of input.scores) {
    const wrong = score.clauses.filter((clause) => clause.outcome !== "right");
    lines.push(`## ${score.title}, run ${score.run}: ${score.clauses.length - wrong.length} of ${score.clauses.length} right`, "");
    if (wrong.length === 0) {
      lines.push("Every clause right.", "");
      continue;
    }
    lines.push("| Clause | Outcome | It said | A lawyer would say |", "|---|---|---|---|");
    for (const clause of wrong) {
      lines.push(`| ${clause.clause} (${clause.heading}) | ${clause.outcome} | ${clause.given} | ${clause.expected} |`);
    }
    lines.push("");
  }
  return lines.join("\n");
}
