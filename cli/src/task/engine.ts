import {
  Task,
  TaskStatus,
  WorkerGraph,
  WorkerId,
  WorkerResult,
  ExecutionEvent
} from "./types";

import { appendEvent } from "./eventStore";

/**
 * Task Engine (Graph Runtime + Event Sourcing)
 */
export function runTask(
  task: Task,
  graph: WorkerGraph,
  start: WorkerId
): Task {
  let currentId: WorkerId | undefined = start;

  let currentTask: Task = {
    ...task,
    state: {
      ...task.state,
      status: "running"
    }
  };

  const emit = (event: ExecutionEvent) => {
    appendEvent(event);
  };

  while (currentId) {
    const worker = graph.workers[currentId];

    if (!worker) {
      throw new Error(`Worker not found: ${currentId}`);
    }

    emit({
      type: "task.node_entered",
      taskId: currentTask.id,
      nodeId: currentId,
      timestamp: Date.now(),
      input: currentTask
    });

    const result: WorkerResult = worker.run(currentTask, {
      graph,
      tools: {
        log: (msg: string) => console.log(`[log] ${msg}`)
      }
    });

    currentTask = {
      ...result.task,
      metadata: {
        ...result.task.metadata,
        updatedAt: Date.now()
      }
    };

    if (result.effects) {
      for (const e of result.effects) handleEffect(e);
    }

    // WAIT STATE
    if (result.waitFor) {
      const waiting = {
        ...currentTask,
        state: {
          ...currentTask.state,
          status: "waiting" as TaskStatus
        }
      };

      emit({
        type: "task.waiting",
        taskId: currentTask.id,
        nodeId: currentId,
        timestamp: Date.now(),
        reason: result.waitFor
      });

      return waiting;
    }

    // ROUTING
    if (result.routes?.length) {
      const match = result.routes.find(r =>
        r.condition(currentTask)
      );

      if (match) {
        currentId = match.next;
        continue;
      }
    }

    if (result.next) {
      currentId = result.next;
      continue;
    }

    const completed = complete(currentTask);

    emit({
      type: "task.completed",
      taskId: currentTask.id,
      timestamp: Date.now(),
      output: completed
    });

    return completed;
  }

  return complete(currentTask);
}

/**
 * Mark task complete
 */
function complete(task: Task): Task {
  return {
    ...task,
    state: {
      ...task.state,
      status: "completed"
    }
  };
}

/**
 * Side effects boundary
 */
function handleEffect(effect: { type: string; message?: string }) {
  switch (effect.type) {
    case "log":
      console.log(`[log] ${effect.message}`);
      break;
    case "error":
      console.error(`[error] ${effect.message}`);
      break;
    default:
      console.warn(`[unknown effect]`, effect);
  }
}