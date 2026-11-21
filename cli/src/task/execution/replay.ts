import { executionStore } from "./store";

type ExecutionEvent = {
  index: number;
  nodeId: string;
  status: string;
};

type Run = {
  events: ExecutionEvent[];
};

export function replay(runId: string) {
  const run = executionStore.get(runId) as Run | undefined;

  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  console.log(`\n🔁 Replaying run: ${runId}\n`);

  for (const event of run.events ?? []) {
    console.log(`#${event.index} ${event.nodeId} → ${event.status}`);
  }

  return run.events;
}

export function stepReplay(runId: string, step: number) {
  const run = executionStore.get(runId) as Run | undefined;

  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  if (step < 0) {
    throw new Error(`Invalid step: ${step}`);
  }

  return (run.events ?? []).slice(0, step + 1);
}