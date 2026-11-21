/**
 * Canonical Worker Runtime Types (ONLY SOURCE OF TRUTH)
 */

export type WorkerId = string;

export type TaskStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed";

export type Task = {
  id: string;
  type: string;
  payload: unknown;

  state: {
    status: TaskStatus;
    attempts: number;
  };

  metadata: {
    createdAt: number;
    updatedAt: number;
    createdBy: string;
  };
};

export type WorkerResult = {
  task: Task;
  next?: WorkerId;

  routes?: Array<{
    condition: (task: Task) => boolean;
    next: WorkerId;
  }>;

  effects?: Array<{
    type: string;
    message?: string;
  }>;

  done?: boolean;
  waitFor?: string;
};

export type WorkerNode = {
  id: WorkerId;
  run: (task: Task, ctx: WorkerContext) => WorkerResult;
};

export type WorkerGraph = {
  start: WorkerId;
  workers: Record<WorkerId, WorkerNode>;
};

export type WorkerContext = {
  graph: WorkerGraph;
  tools: {
    log: (msg: string) => void;
  };
};

/**
 * SINGLE canonical event model
 */
export type ExecutionEvent =
  | {
      type: "task.started";
      taskId: string;
      timestamp: number;
    }
  | {
      type: "task.node_entered";
      taskId: string;
      nodeId: string;
      timestamp: number;
      input: Task;
    }
  | {
      type: "task.waiting";
      taskId: string;
      nodeId: string;
      timestamp: number;
      reason?: string;
    }
  | {
      type: "task.completed";
      taskId: string;
      timestamp: number;
      output: Task;
    };