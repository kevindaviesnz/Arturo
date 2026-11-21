import {
  listStaffingAssignments,
} from "./staffingStore";

/**
 * Who the applied staffing plan made accountable for a Function's work.
 *
 * The plan tells the operator, in as many words, "Approver: Sam Okonjo". A
 * walkthrough registered a second Human and approved a safeguarding Task as the
 * other person; nothing objected, because the designation was recorded and then
 * never consulted again. Any registered Human could approve anything.
 *
 * This is not an authentication boundary — the host is single-tenant and
 * operator-trusted, and Worker registration proves nothing about a real
 * person's identity or authority. It is about the plan being true: a named
 * accountable approver that anyone can bypass is worse than no name at all,
 * because it reads as a control that is not there.
 */

/**
 * The Human Workers designated to approve a Function's work.
 *
 * Empty when the plan named nobody, which leaves approval open to any eligible
 * Human — the behaviour before a plan is applied.
 *
 * SIDE EFFECT: Reads the staffing assignment store.
 */
export function designatedApproversForFunction(
  businessFunctionId: string | undefined
): readonly string[] {
  if (!businessFunctionId) return [];

  return listStaffingAssignments(businessFunctionId)
    .filter(
      (assignment) =>
        assignment.role === "human-approver" &&
        assignment.workerName.trim().length > 0
    )
    .map((assignment) => assignment.workerName);
}

/**
 * Whether this person may decide this Function's work.
 *
 * PURE: No side effects.
 */
export function mayDecideForFunction(
  designated: readonly string[],
  workerName: string
): boolean {
  return (
    designated.length === 0 ||
    designated.some(
      (name) => name.toLowerCase() === workerName.trim().toLowerCase()
    )
  );
}

/**
 * Explains a refusal, naming who the plan made accountable.
 *
 * PURE: No side effects.
 */
export function formatApproverRefusal(
  designated: readonly string[],
  workerName: string,
  decision: "approve" | "reject"
): string {
  const names =
    designated.length === 1
      ? designated[0]
      : `${designated.slice(0, -1).join(", ")} or ${designated[designated.length - 1]}`;

  return [
    `${workerName} is not an approver for this Function, so this ${decision} was not recorded.`,
    `The staffing plan you applied made ${names} accountable for it.`,
    `  /${decision} <task-id> --as "${designated[0]}"`,
    "",
    "To change who is accountable, re-run /staff.",
  ].join("\n");
}
