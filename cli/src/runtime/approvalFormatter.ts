import type {
  ApprovalChain,
  ApprovalDecision,
} from "./approvalChainStore";

import {
  loadPolicyRules,
} from "../storage/policyRepository";

import {
  isBotOperatorName,
} from "../bot/botOperator";

import {
  getJob,
} from "./jobQueue";

import {
  FAIL_CLOSED_CONSEQUENTIAL_RULE_ID,
  isConsequentialCapability,
} from "./jobGovernance";

import {
  describeConsequentialCapabilities,
} from "./consequentialCapabilityWording";

/**
 * Says why governance failed closed, naming what the Task can actually do.
 *
 * The fail-closed marker is not a stored rule and never was, so looking it up
 * produced "a Governance rule that is no longer stored" — a false statement
 * about a governance control, telling the operator a rule they wrote had been
 * deleted when none was ever involved. Since approval now tracks consequence
 * rather than the whole Function, this is the ordinary case rather than a rare
 * one.
 *
 * SIDE EFFECT: Reads the job queue to recover the Task's capabilities.
 */
export function describeFailClosedApprovalReason(
  jobId: string
): string {
  const consequential = (
    getJob(jobId)?.requiredCapabilities ?? []
  ).filter(isConsequentialCapability);

  return consequential.length > 0
    ? `this Task can ${describeConsequentialCapabilities(consequential)}, and no rule you have written covers it`
    : "this Task can act outside Arturo, and no rule you have written covers it";
}

/**
 * Says, in plain words, what is holding this Task.
 *
 * A chain records the Governance rule that required approval, when one did.
 * When nothing did, the requirement came from the Task declaring human-review,
 * and saying "a governance rule requires this" would be false.
 *
 * SIDE EFFECT: Reads the stored policy rules to resolve the rule's description,
 * and the job queue when governance failed closed.
 */
export function describeApprovalReason(
  chain: ApprovalChain
): string {
  if (!chain.governancePolicyId) {
    return "this Task asks for human review";
  }
  // Checked before the lookup: this id is a marker, not a rule, so searching
  // for it can only ever miss.
  if (chain.governancePolicyId === FAIL_CLOSED_CONSEQUENTIAL_RULE_ID) {
    return describeFailClosedApprovalReason(chain.jobId);
  }
  const rule = loadPolicyRules().find(
    (candidate) => candidate.id === chain.governancePolicyId
  );
  return rule
    ? `${rule.description} (${rule.id})`
    : `a Governance rule that is no longer stored (${chain.governancePolicyId})`;
}

/**
 * Says what a recorded decision decided, in the operator's words.
 *
 * "approved" alone meant two different things: that work may start, and that
 * finished work was accepted. A decision recorded before the two were told
 * apart carries no kind, and nothing is claimed about it beyond the word that
 * was stored.
 *
 * PURE: No side effects.
 */
export function describeDecisionMeaning(
  decision: Pick<ApprovalDecision, "decision" | "kind">
): string | undefined {
  if (decision.kind === "release") {
    return decision.decision === "approved"
      ? "released the work to run; not a sign-off of the result"
      : "refused to let the work run";
  }
  if (decision.kind === "review") {
    return decision.decision === "approved"
      ? "accepted what was put in front of them for review"
      : "rejected what was put in front of them for review";
  }
  return undefined;
}

/**
 * Lists who decided what on a Task, for the Task's own detail view.
 *
 * Only decisions that say what they decided are listed: an older decision
 * cannot be described either way without guessing.
 *
 * PURE: No side effects.
 */
export function describeRecordedDecisions(
  chain: Pick<ApprovalChain, "decisions">
): string[] {
  return chain.decisions.flatMap((decision) => {
    const meaning = describeDecisionMeaning(decision);
    return meaning ? [`${decision.worker} ${meaning}`] : [];
  });
}

/**
 * Formats an approval chain for display.
 *
 * SIDE EFFECT: Reads the stored policy rules to name the rule that is waiting.
 */
export function formatApprovalChain(
  chain: ApprovalChain
): string {
  const decisions =
    chain.decisions.length === 0
      ? "No decisions recorded"
      : chain.decisions
          .map(
            (decision) =>
              `${decision.worker}${
                isBotOperatorName(decision.worker) ? " (a bot, not a person)" : ""
              }: ${decision.decision}${
                describeDecisionMeaning(decision) ? ` — ${describeDecisionMeaning(decision)}` : ""
              }${decision.reason ? ` (${decision.reason})` : ""}`
          )
          .join("\n");

  return [
    `Task: ${chain.jobId}`,
    `Status: ${chain.status}`,
    // Which rule is holding the work is the whole point of asking. Without it,
    // an operator whose own rule never matched sees a Task waiting and
    // reasonably concludes their rule is what stopped it.
    `Waiting because: ${describeApprovalReason(chain)}`,
    `Required approvals: ${chain.requiredApprovals}`,
    `Current approvals: ${
      chain.decisions.filter(
        (decision) =>
          decision.decision === "approved"
      ).length
    }`,
    "",
    decisions,
  ].join("\n");
}
