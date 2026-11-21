import {
  appendRunEvent,
  completeWorkflowRun,
  createWorkflowRun,
  getWorkflowRun,
} from "../runtime/workflowRunStore";

import type {
  RuntimeEvent,
  RuntimeLevel,
} from "../types/runtime";

import {
  executorWorker,
  plannerWorker,
  reviewerWorker,
  WorkflowContext,
} from "./deterministicWorkers";

import { broadcastEvent } from "../runtime/runtimeEventPublisher";

const workers = [
  plannerWorker,
  executorWorker,
  reviewerWorker,
];

function createRuntimeEvent(
  sequence: number,
  type: string,
  payload: unknown,
  level: RuntimeLevel = "info"
): RuntimeEvent {
  return {
    id: sequence,
    type,
    level,
    message: JSON.stringify(payload, null, 2),
    timestamp: new Date().toISOString(),
  };
}

function emit(runId: string, event: RuntimeEvent) {
  appendRunEvent(runId, event);
  broadcastEvent(event.type, event.level, event.message);
  console.log(`[workflow-event] ${event.type}`);
}

export function runDeterministicWorkflow(goal: string) {
  const run = createWorkflowRun("deterministic-summary");

  let sequence = 1;

  let context: WorkflowContext = { goal };

  emit(
    run.id,
    createRuntimeEvent(sequence++, "workflow.started", {
      workflow: "deterministic-summary",
      goal,
    })
  );

  for (const worker of workers) {
    emit(
      run.id,
      createRuntimeEvent(sequence++, "worker.entered", {
        worker: worker.name,
        context,
      })
    );

    context = worker.run(context);

    emit(
      run.id,
      createRuntimeEvent(sequence++, "worker.completed", {
        worker: worker.name,
        context,
      }, "success")
    );
  }

  emit(
    run.id,
    createRuntimeEvent(sequence++, "workflow.completed", {
      result: context.result,
      approved: context.approved,
    }, "success")
  );

  completeWorkflowRun(run.id);

  return getSerializableRun(run.id);
}

function getSerializableRun(runId: string) {
  const run = getWorkflowRun(runId);

  if (!run) {
    throw new Error(`Run not found: ${runId}`);
  }

  return {
    id: run.id,
    workflow: run.workflow,
    status: run.status,
    events: run.events,
  };
}