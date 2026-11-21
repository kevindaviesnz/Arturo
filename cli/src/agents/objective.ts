import type {
  IntentResolution,
} from "../intent/intentResolution";

export const OBJECTIVE_TYPES = [
  "create",
  "operate",
  "improve",
  "analyze",
  "research",
  "monitor",
  "manage",
  "support",
  "automate",
  "learn",
  "unknown",
] as const;

export const OBJECTIVE_LIFETIMES = [
  "finite",
  "persistent",
] as const;

export type ObjectiveType =
  typeof OBJECTIVE_TYPES[number];

export type ObjectiveLifetime =
  typeof OBJECTIVE_LIFETIMES[number];

export type ObjectiveClassification = {
  readonly description: string;
  readonly type: ObjectiveType;
  readonly lifetime: ObjectiveLifetime;
  readonly businessPattern: string;
  readonly supported: boolean;
  readonly reason: string;
  readonly intent?: IntentResolution;
};