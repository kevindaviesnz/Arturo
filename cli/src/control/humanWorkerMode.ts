import type {
  AgentArchetype,
} from "../agents/agentArchetype";

export type HumanWorkerMode =
  | "task"
  | "review"
  | "approval"
  | "decision";

/**
 * Resolves the default human participation mode for an archetype.
 *
 * PURE: No side effects.
 */
export function resolveDefaultHumanWorkerMode(
  archetype?: AgentArchetype
): HumanWorkerMode {
  if (archetype === "reviewer") {
    return "review";
  }

  if (archetype === "guardian") {
    return "approval";
  }

  return "task";
}

/**
 * Whether a participation mode entitles a Human to approve governed work.
 *
 * A Human added with no role — the default `/add-human-worker "<name>"` — lands
 * in `"task"` mode and cannot approve. A walkthrough registered such a Human,
 * had `/staff` name them the accountable approver, and then hit "No available
 * registered human approver" on `/approve`, with the fix ("add a human") being
 * the exact step already done. The approval gate and the staffing planner must
 * share one definition of "can approve" so they cannot disagree, and every
 * message that sends the operator to register an approver must ask for an
 * approval-capable one (`--archetype guardian`).
 *
 * PURE: No side effects.
 */
export function isApprovalCapableMode(
  mode: HumanWorkerMode | undefined
): boolean {
  return (
    mode === "approval" ||
    mode === "decision" ||
    mode === "review"
  );
}
