import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

import { buildClauseTask, findDocumentPreamble, findNumberedClauses } from "../agents/clauseCoverage";
import { generateWithConfiguredLlm } from "../llm/llmClient";
import { getModelRoutingStatus } from "../llm/modelRouting";
import { getSelectedModel } from "../llm/modelSelection";
import { generateWithOllama } from "../llm/ollamaClient";
import { resolveRuntimeDataDirectory } from "../storage/runtimeStoragePaths";
import { BENCHMARK_INSTRUCTION, CLAUSE_BENCHMARK, MIXED_AGREEMENT } from "./clauseAnswerKey";
import { formatBenchmarkReport, scoreDocument, summarise, type DocumentScore } from "./clauseBenchmark";

/**
 * Puts every clause of the three demonstration agreements to a model, exactly as
 * Arturo's clause-by-clause step words it, and scores the verdicts against a
 * lawyer's answers.
 *
 *   npm run eval:clauses                         # the model Arturo is set to use
 *   npm run eval:clauses -- --model qwen2.5:14b  # a named local (Ollama) model
 *   npm run eval:clauses -- --runs 3             # repeat, to see how steady it is
 *
 * It sends only the synthetic demonstration agreements, never client data.
 * `--only held-out` runs only the third agreement, which nothing was tuned on.
 * With no --model it uses whatever Arturo is set to use, including an outside
 * model if someone chose one with /model; the report names it.
 *
 * SIDE EFFECT: Calls a model once per clause per run; writes a report under
 * the data directory.
 */

const flag = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
};

const asset = (fileName: string) => path.join(__dirname, "..", "..", "scenario_harness", "assets", fileName);

async function main(): Promise<void> {
  const named = flag("--model")?.trim();
  const runs = Math.max(1, Math.min(10, Number(flag("--runs") ?? "1") || 1));
  const selected = getSelectedModel();
  const localModel = getModelRoutingStatus().localModel;
  const label = named
    ? `${named} (local)`
    : selected && selected.provider !== "ollama"
      ? `${selected.model} (${selected.provider}, outside service)`
      : `${localModel} (local)`;

  const ask = async (prompt: string): Promise<string> =>
    (named
      ? await generateWithOllama({ model: named, prompt })
      : await generateWithConfiguredLlm({ model: localModel, prompt })
    ).response;

  console.log(`Clause verdict benchmark: ${label}, ${runs} run${runs === 1 ? "" : "s"}.`);
  console.log("Only the three synthetic demonstration agreements are sent.\n");

  const scores: DocumentScore[] = [];
  for (let run = 1; run <= runs; run += 1) {
    for (const key of CLAUSE_BENCHMARK.filter((candidate) => flag("--only") !== "held-out" || candidate === MIXED_AGREEMENT)) {
      const document = fs.readFileSync(asset(key.asset), "utf8");
      const clauses = findNumberedClauses(document);
      const preamble = findDocumentPreamble(document);
      const answers = new Map<number, string>();
      for (const clause of clauses) {
        if (process.stdout.isTTY) process.stdout.write(`  ${key.title}, run ${run}: clause ${clause.number} of ${clauses.length}…\r`);
        try {
          answers.set(clause.number, await ask(buildClauseTask(BENCHMARK_INSTRUCTION, clause, preamble)));
        } catch (error) {
          console.error(`\nThe model could not be reached: ${error instanceof Error ? error.message : String(error)}`);
          process.exitCode = 1;
          return;
        }
      }
      const score = scoreDocument(key, run, answers);
      scores.push(score);
      const right = score.clauses.filter((clause) => clause.outcome === "right").length;
      console.log(`  ${key.title}, run ${run}: ${right} of ${score.clauses.length} right.          `);
    }
  }

  const runAt = new Date().toISOString();
  const report = formatBenchmarkReport({ model: label, runAt, scores });
  const folder = path.join(resolveRuntimeDataDirectory(), "evaluations");
  fs.mkdirSync(folder, { recursive: true });
  const file = path.join(folder, `clause-benchmark-${runAt.replace(/[:.]/g, "-")}.md`);
  fs.writeFileSync(file, report);

  const total = summarise(scores);
  console.log(`\n${total.right} of ${total.clauses} right. Backwards: ${total.counts.backwards}. Missed problems: ${total.counts["missed problem"]}. False alarms: ${total.counts["false alarm"]}. No verdict: ${total.counts["no verdict"]}.`);
  console.log(`Full report: ${file}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
