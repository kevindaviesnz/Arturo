import type {
  AgentArchetype,
} from "./agentArchetype";

export type WorkflowExecutionStep = {
  archetype: AgentArchetype;
  workerName: string;
  instruction: string;
};

export type WorkflowExecutionPlan = {
  objective: string;
  explanation?: string;
  steps: WorkflowExecutionStep[];
};