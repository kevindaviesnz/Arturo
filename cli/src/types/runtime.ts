export type WorkerCapability = string;

// Runtime views expose the same vocabulary as Worker registration. The wire
// type above stays open for historical/custom values in persisted records.
export { CORE_CAPABILITIES } from "../capabilities/capabilityCatalog";

export type RuntimeLevel =
  | "info"
  | "warn"
  | "error"
  | "success";

export type RuntimeEvent = {
  id: number;
  type: string;
  level: RuntimeLevel;
  message: string;
  timestamp: string;
};

export type RuntimeMetrics = {
  workers: number;
  jobs: number;
  pipelines: number;
};

export type RuntimeJob = {
  id: string;
  worker?: string;
  status:
    | "queued"
    | "running"
    | "awaiting_approval"
    | "completed"
    | "failed";
  task: string;
};

export type RuntimeWorker = {
  id: string;
  name: string;
  displayName?: string;
  email?: string;
  type: "ai" | "human" | "workflow";
  status:
    | "idle"
    | "running"
    | "paused"
    | "error";
  model: string;
  jobs: number;
  tokens: number;
  tools: number;
  trust: boolean;
  capabilities: WorkerCapability[];
};
