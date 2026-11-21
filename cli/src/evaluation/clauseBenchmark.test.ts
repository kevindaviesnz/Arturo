import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { findNumberedClauses } from "../agents/clauseCoverage";
import { CLAUSE_BENCHMARK, LOPSIDED_AGREEMENT, BALANCED_AGREEMENT, MIXED_AGREEMENT } from "./clauseAnswerKey";
import { formatBenchmarkReport, scoreClause, scoreDocument, summarise } from "./clauseBenchmark";

const verdict = (line: string, favours?: string) => `Verdict: ${line}\n${favours ? `Favours: ${favours}\n` : ""}Because.`;

describe("the clause verdict benchmark", () => {
  it("has an answer for every clause of each agreement, with the documents' own headings", () => {
    for (const key of CLAUSE_BENCHMARK) {
      const document = fs.readFileSync(path.join(__dirname, "..", "..", "scenario_harness", "assets", key.asset), "utf8");
      const clauses = findNumberedClauses(document);
      expect(clauses.map((clause) => clause.number)).toEqual(key.answers.map((answer) => answer.clause));
      expect(clauses.map((clause) => clause.heading)).toEqual(key.answers.map((answer) => answer.heading));
    }
  });

  it("holds out an agreement whose one-sided clauses favour the customer, so always answering \"Supplier\" scores badly", () => {
    expect(CLAUSE_BENCHMARK).toHaveLength(3);
    const favoured = MIXED_AGREEMENT.answers.filter((answer) => answer.favours).map((answer) => answer.favours);
    expect(favoured).toEqual(["Customer", "Customer", "Customer"]);
    const alwaysSupplier = scoreDocument(MIXED_AGREEMENT, 1, new Map(MIXED_AGREEMENT.answers.map((answer) => [answer.clause, verdict("ONE-SIDED", "Contractor")])));
    expect(alwaysSupplier.clauses.filter((clause) => clause.outcome === "backwards")).toHaveLength(3);
  });

  it("names each kind of mistake as a lawyer would", () => {
    const liability = LOPSIDED_AGREEMENT.answers[3];
    expect(scoreClause(liability, verdict("ONE-SIDED", "Supplier")).outcome).toBe("right");
    expect(scoreClause(liability, verdict("ONE-SIDED", "Tidewater Design Limited (\"Supplier\")")).outcome).toBe("right");
    // What the demonstration produced: one-sided, but for the Client.
    expect(scoreClause(liability, verdict("ONE-SIDED", "Client")).outcome).toBe("backwards");
    expect(scoreClause(liability, verdict("ONE-SIDED")).outcome).toBe("backwards");
    expect(scoreClause(liability, verdict("BALANCED")).outcome).toBe("missed problem");
    expect(scoreClause(liability, "It limits liability.").outcome).toBe("no verdict");

    const fairLiability = BALANCED_AGREEMENT.answers[3];
    expect(scoreClause(fairLiability, verdict("ONE-SIDED", "Client")).outcome).toBe("false alarm");
    expect(scoreClause(fairLiability, verdict("UNCLEAR")).outcome).toBe("wrong call");

    // Either reading of the fair payment-default clause is accepted.
    const fairDefault = BALANCED_AGREEMENT.answers[7];
    expect(scoreClause(fairDefault, verdict("BALANCED")).outcome).toBe("right");
    expect(scoreClause(fairDefault, verdict("ONE-SIDED", "Supplier")).outcome).toBe("right");
    expect(scoreClause(fairDefault, verdict("ONE-SIDED", "Client")).outcome).toBe("backwards");
    expect(scoreClause(fairDefault, verdict("UNCLEAR")).outcome).toBe("wrong call");

    const governingLaw = LOPSIDED_AGREEMENT.answers[10];
    expect(scoreClause(governingLaw, verdict("ONE-SIDED", "Supplier")).outcome).toBe("false alarm");
    expect(scoreClause(governingLaw, verdict("UNCLEAR")).outcome).toBe("right");
  });

  it("reports the demonstration's own answers as the lawyer judged them", () => {
    // The verdicts the local model gave in the demonstration, on the fair agreement.
    const given: Record<number, string> = {
      1: verdict("ONE-SIDED", "Supplier"), 2: verdict("BALANCED"), 3: verdict("ONE-SIDED", "Supplier"),
      4: verdict("ONE-SIDED", "Client"), 5: verdict("ONE-SIDED", "Supplier"), 6: verdict("BALANCED"),
      7: verdict("BALANCED"), 8: verdict("ONE-SIDED", "Supplier"), 9: verdict("BALANCED"),
      10: verdict("BALANCED"), 11: verdict("BALANCED"),
    };
    const score = scoreDocument(BALANCED_AGREEMENT, 1, new Map(Object.entries(given).map(([clause, answer]) => [Number(clause), answer])));
    const summary = summarise([score]);
    expect(summary.right).toBe(7);
    expect(summary.counts["false alarm"]).toBe(4);

    const report = formatBenchmarkReport({ model: "qwen2.5 (local)", runAt: "2026-10-14T00:00:00Z", scores: [score] });
    expect(report).toContain("**7 of 11 right (64%).**");
    expect(report).toContain("- False alarms (a fair or unclear clause called one-sided): 4");
    expect(report).toContain("| 4 (Liability) | false alarm | one-sided, favours Client | balanced |");
    expect(report).toContain("have not been signed off by a lawyer");
  });
});
