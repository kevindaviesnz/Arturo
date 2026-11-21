import { loadEvents } from "./eventStore";
import { ExecutionEvent } from "./types";

export type ReplayState = {
  taskId: string;
  steps: ExecutionEvent[];
  currentStep: number;
  snapshot: any;
};

export function replay(taskId: string): ReplayState {
  const events = loadEvents().filter(e => e.taskId === taskId);

  return {
    taskId,
    steps: events,
    currentStep: events.length - 1,
    snapshot: buildSnapshot(events, events.length - 1)
  };
}

export function step(taskId: string, stepIndex: number): ReplayState {
  const events = loadEvents().filter(e => e.taskId === taskId);

  const safeIndex = Math.max(0, Math.min(stepIndex, events.length - 1));

  return {
    taskId,
    steps: events,
    currentStep: safeIndex,
    snapshot: buildSnapshot(events, safeIndex)
  };
}

function buildSnapshot(events: ExecutionEvent[], index: number) {
  let state: any = {
    lastNode: null,
    status: "unknown",
    history: []
  };

  for (let i = 0; i <= index; i++) {
    const e = events[i];

    state.history.push({
      type: e.type,
      taskId: e.taskId,
      timestamp: e.timestamp
    });

    switch (e.type) {
      case "task.node_entered":
        state.lastNode = e.nodeId;
        state.status = "running";
        break;

      case "task.waiting":
        state.status = "waiting";
        break;

      case "task.completed":
        state.status = "completed";
        state.final = e.output;
        break;
    }
  }

  return state;
}