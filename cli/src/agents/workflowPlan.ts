import type {
  AgentArchetype,
} from "./agentArchetype";

export type WorkflowStep = {
  archetype: AgentArchetype;
  instruction: string;
};

export type WorkflowPlan = {
  objective: string;
  explanation?: string;
  steps: WorkflowStep[];
};