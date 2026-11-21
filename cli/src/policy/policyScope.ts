export type PolicyScopeType =
  | "global"
  | "organization"
  | "team"
  | "workflow"
  | "capability";

export type PolicyScope = {
  type: PolicyScopeType;
  id: string;
};