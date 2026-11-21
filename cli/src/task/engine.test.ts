import { describe, it, expect } from "vitest";
import { runTask } from "./engine";
import { Task, WorkerGraph } from "./types";

function createTask(): Task {
  return {
    id: "1",
    type: "test",
    payload: {},

    state: {
      status: "pending",
      attempts: 0
    },

    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      createdBy: "system"
    }
  };
}

describe("Task Engine", () => {
  it("runs a simple flow", () => {
    const graph: WorkerGraph = {
      start: "start",
      workers: {
        start: {
          id: "start",
          run: (task) => ({ task, next: "end" })
        },
        end: {
          id: "end",
          run: (task) => ({ task })
        }
      }
    };

    const result = runTask(createTask(), graph, "start");

    expect(result.state.status).toBe("completed");
  });

  it("handles missing worker", () => {
    const graph: WorkerGraph = { start: "start", workers: {} };

    expect(() => runTask(createTask(), graph, "start")).toThrow();
  });

  it("handles waiting state", () => {
    const graph: WorkerGraph = {
      start: "start",
      workers: {
        start: {
          id: "start",
          run: (task) => ({
            task,
            waitFor: "human"
          })
        }
      }
    };

    const result = runTask(createTask(), graph, "start");

    expect(result.state.status).toBe("waiting");
  });
});