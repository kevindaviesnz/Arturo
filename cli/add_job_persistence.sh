#!/usr/bin/env bash
set -euo pipefail

mkdir -p worker-cli/src/storage

cat > worker-cli/src/storage/runtimeDatabase.ts <<'TS'
import {
  createRuntimeDatabase,
} from "./database";

export const runtimeDb =
  createRuntimeDatabase(
    "./worker-runtime.db"
  );
TS

cat > worker-cli/src/storage/jobRepository.ts <<'TS'
import type {
  Job,
} from "../runtime/jobQueue";

import {
  runtimeDb,
} from "./runtimeDatabase";

/**
 * Inserts or replaces a persisted job.
 *
 * @param job Job to persist.
 * @returns void
 *
 * SIDE EFFECT: Writes job state into SQLite.
 */
export function saveJob(
  job: Job
): void {
  runtimeDb
    .prepare(`
      INSERT OR REPLACE INTO jobs (
        id,
        task,
        worker,
        status,
        output,
        error,
        created_at,
        started_at,
        completed_at,
        failed_at
      )
      VALUES (
        @id,
        @task,
        @worker,
        @status,
        @output,
        @error,
        @createdAt,
        @startedAt,
        @completedAt,
        @failedAt
      )
    `)
    .run(job);
}

/**
 * Loads all persisted jobs.
 *
 * @returns Persisted jobs.
 *
 * SIDE EFFECT: Reads jobs from SQLite.
 */
export function loadJobs(): Job[] {
  return runtimeDb
    .prepare(`
      SELECT
        id,
        task,
        worker,
        status,
        output,
        error,
        created_at as createdAt,
        started_at as startedAt,
        completed_at as completedAt,
        failed_at as failedAt
      FROM jobs
      ORDER BY created_at ASC
    `)
    .all() as Job[];
}
TS

python3 <<'PY'
from pathlib import Path

path = Path("worker-cli/src/runtime/jobQueue.ts")
text = path.read_text()

if 'from "../storage/jobRepository"' not in text:
    text = text.replace(
        'type JobStatus =',
        '''import {
  loadJobs,
  saveJob,
} from "../storage/jobRepository";

type JobStatus ='''
    )

text = text.replace(
    'let jobs: Job[] = [];',
    'let jobs: Job[] = loadJobs();'
)

text = text.replace(
    '''  jobs = [
    ...jobs,
    job,
  ];

  return job;''',
    '''  jobs = [
    ...jobs,
    job,
  ];

  saveJob(job);

  return job;'''
)

text = text.replace(
    '''  jobs = jobs.map((job) =>
    job.id === updated.id
      ? updated
      : job
  );

  return updated;''',
    '''  jobs = jobs.map((job) =>
    job.id === updated.id
      ? updated
      : job
  );

  saveJob(updated);

  return updated;'''
)

path.write_text(text)
PY

echo "Job persistence added."
