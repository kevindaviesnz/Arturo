import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import type { Job } from "../runtime/jobQueue";

// Separate processes ensure the read cannot be satisfied by the Job queue's
// in-memory cache or an open SQLite connection from the write.
describe("Job restart continuity", () => {
  it("restores governance and review state into a fresh runtime", () => {
    const directory = mkdtempSync(path.join(os.tmpdir(), "arturo-job-restart-"));
    const job: Job = {
      id: "restart-review", task: "Review contract", status: "awaiting_revision", createdAt: 1,
      procedureRef: "proc-contract@3", reviewToken: "test-review-token", requiredApprovals: 2,
      approvalPolicy: { type: "threshold", requiredApprovals: 2 },
      reviewLoop: { loopId: "loop", draftWorkerName: "Drafter", criticWorkerName: "Critic", decisionWorkerName: "Partner", attempt: 2, maxAttempts: 4 },
      kernelCallId: "call-1", rawOutput: "original", assignedAt: 2,
      revisionRequestedAt: 3, revisionInstructions: "Check clause",
      humanTaskRevision: { sourceHumanTaskId: "human-1", sourceHumanJobId: "job-human-1", revisionInstructions: "Verify original" },
    };
    const run = (code: string) => spawnSync(process.execPath, ["-r", "ts-node/register/transpile-only", "-e", code], {
      cwd: path.resolve(__dirname, "../.."), encoding: "utf8",
      env: { ...process.env, ARTURO_DATA_DIRECTORY: directory, ARTURO_RUNTIME_DATABASE_PATH: path.join(directory, "runtime.db") },
    });
    try {
      const saved = run(`require('./src/storage/jobRepository').saveJob(${JSON.stringify(job)}); require('./src/storage/runtimeDatabase').runtimeDb.close();`);
      expect(saved.status, saved.stderr).toBe(0);
      const loaded = run(`console.log(JSON.stringify(require('./src/runtime/jobQueue').getJob('restart-review'))); require('./src/storage/runtimeDatabase').runtimeDb.close();`);
      expect(loaded.status, loaded.stderr).toBe(0);
      expect(JSON.parse(loaded.stdout)).toEqual(job);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
