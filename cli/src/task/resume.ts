import { loadTaskEvents } from "./eventStore";
import { WorkerGraph, WorkerId, Task } from "./types";
import { runTask } from "./engine";

/**
 * Rebuild task state from event history
 */
export function reconstructTask(taskId: string): Task {
  const events = loadTaskEvents(taskId);

  let task: Task | undefined;

  for (const e of events) {
    switch (e.type) {
      case "task.node_entered":
        task = e.input;
        break;

      case "task.waiting":
        if (task) {
          task = {
            ...task,
            state: {
              ...task.state,
              status: "waiting"
            }
          };
        }
        break;

      case "task.completed":
        task = e.output;
        break;
    }
  }

  if (!task) {
    throw new Error(`Cannot reconstruct task ${taskId}`);
  }

  return task;
}

/**
 * Find last executed node
 */
export function getLastNode(taskId: string): WorkerId | null {
  const events = loadTaskEvents(taskId);

  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];

    if (e.type === "task.node_entered") {
      return e.nodeId;
    }
  }

  return null;
}

/**
 * Resume execution from event log
 */
export function resumeTask(taskId: string, graph: WorkerGraph) {
  const task = reconstructTask(taskId);
  const lastNode = getLastNode(taskId);

  return runTask(task, graph, lastNode ?? graph.start);
}