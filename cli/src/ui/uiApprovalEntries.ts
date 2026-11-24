import {
  listApprovalChains,
} from "../runtime/approvalChainStore";

import {
  designatedApproversForFunction,
} from "../staffing/functionApprovers";

import {
  WorkStreamEntry,
} from "./uiState";
import { isBotOperatorName } from "../bot/botOperator";
import { getJob } from "../runtime/jobQueue";
import { loadPolicyRules } from "../storage/policyRepository";
import { FAIL_CLOSED_CONSEQUENTIAL_RULE_ID } from "../runtime/jobGovernance";
import { describeFailClosedApprovalReason } from "../runtime/approvalFormatter";

type UiApprovalChain =
  ReturnType<typeof listApprovalChains>[number];

/** Capitalises the first letter, so a reason phrase reads as a sentence here. */
function sentenceCase(text: string): string {
  return text.slice(0, 1).toUpperCase() + text.slice(1);
}

/**
 * Purpose: Counts approval decisions in an approval chain.
 *
 * Params:
 * - chain: Approval chain.
 *
 * Returns:
 * - Number of decisions already recorded.
 *
 * PURE: No side effects.
 */
export function countApprovalDecisions(
  chain: UiApprovalChain
): number {
  return chain.decisions.length;
}

/**
 * Purpose: Converts an approval chain into a UI work stream entry.
 *
 * Params:
 * - chain: Approval chain.
 *
 * Returns:
 * - Work stream entry representing the approval chain.
 *
 * PURE: No side effects.
 */
export function createApprovalWorkStreamEntry(
  chain: UiApprovalChain
): WorkStreamEntry {
  const job = getJob(chain.jobId);
  const designatedApprovers =
    designatedApproversForFunction(
      job?.businessFunctionId
    );
  const governancePolicy = chain.governancePolicyId
    ? loadPolicyRules().find((rule) => rule.id === chain.governancePolicyId)
    : undefined;
  const decisionsSoFar = countApprovalDecisions(chain);
  return {
    actor: "Approval",
    label: `${chain.jobId} · ${chain.status}`,
    body: [
      `What: ${job?.task ?? "Not found"}`,
      // Why a person is needed matters more to a newcomer than the mechanical
      // status enum, so lead with the reason in plain words.
      // Saying "a governance rule requires this" when none matched is a false
      // claim about a deterministic control. The requirement then came from the
      // Task declaring human-review, or from governance failing closed on a
      // Task that can act outside Arturo — say which, rather than reporting a
      // stored rule that never existed.
      `Why it needs you: ${
        governancePolicy?.description ??
        (chain.governancePolicyId === FAIL_CLOSED_CONSEQUENTIAL_RULE_ID
          ? `${sentenceCase(describeFailClosedApprovalReason(chain.jobId))}.`
          : chain.governancePolicyId
            ? `A Governance rule that is no longer stored (${chain.governancePolicyId}).`
            : "This Task asks for human review.")
      }`,
      `Signed off so far: ${decisionsSoFar} of ${chain.requiredApprovals}`,
      ...chain.decisions.map(
        (decision) =>
          `${decision.decision === "approved" ? "Approved" : "Turned down"} by ${decision.worker}${
            isBotOperatorName(decision.worker) ? " — signed by a bot, not a person" : ""
          }${decision.reason ? ` — ${decision.reason}` : ""}`
      ),
      // Who may decide was recorded by the staffing plan but never shown here,
      // so the operator could not tell whom to ask — or that it mattered.
      designatedApprovers.length > 0
        ? `Who can give a go-ahead: ${designatedApprovers.join(", ")}`
        : "Who can give a go-ahead: anyone on your team who can sign off work and give go-aheads (that can be you)",
      ...(chain.status === "pending"
        ? [
            "",
            `To approve:   /approve ${chain.jobId}${
              designatedApprovers.length > 0
                ? ` --as "${designatedApprovers[0]}"`
                : ""
            }`,
            `To turn down: /reject ${chain.jobId} "<reason>"`,
          ]
        : []),
    ].join("\n"),
  };
}

/**
 * Purpose: Converts approval chains into UI work stream entries.
 *
 * Params:
 * - chains: Approval chains.
 *
 * Returns:
 * - Work stream entries for approval chains, or an empty-state message.
 *
 * PURE: No side effects.
 */
export function createApprovalEntries(
  chains: readonly UiApprovalChain[]
): readonly WorkStreamEntry[] {
  if (chains.length === 0) {
    return [
      {
        actor: "Arturo",
        label: "Approvals",
        body: "No approval chains found.",
      },
    ];
  }

  return chains.map(
    createApprovalWorkStreamEntry
  );
}

/**
 * Purpose: Reads current approval chains for the terminal UI.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entries for current approval chains.
 *
 * SIDE EFFECT:
 * - Reads approval chain store.
 */
export function readApprovalEntries(): readonly WorkStreamEntry[] {
  return createApprovalEntries(
    listApprovalChains()
  );
}
