import { resolveApprovalCommandIdentity } from "../repl/approvalCommands";
import { getJob, type Job } from "../runtime/jobQueue";
import {
  describeResultSetAside,
  readResultSetAsideStanding,
  recordResultSetAside,
  refuseSetAsideReason,
} from "../runtime/resultSetAside";
import { readResultSignOffStanding, refuseResultSignOff } from "../runtime/resultSignOff";
import { broadcastEvent } from "../runtime/runtimeEventPublisher";
import { designatedApproversForFunction, mayDecideForFunction } from "../staffing/functionApprovers";

export type TaskSetAsideOutcome = {
  readonly setAside: boolean;
  readonly message: string;
};

const USAGE = 'Usage: /task setaside <task-id> "<why>" [--as "<human-worker>"]';

/**
 * Who is deciding on a finished result, and whether they may, by the rules a
 * sign-off uses: a registered, approval-capable person, and where a staffing
 * plan named someone accountable for the Function, only them. Writes nothing.
 *
 * SIDE EFFECT: Reads Task, Worker and staffing state; may broadcast a refusal.
 */
export function resolveResultDecider(
  args: readonly string[],
  usage: string,
  verb: string
): { readonly job: Job; readonly worker: string; readonly rest: readonly string[] } | { readonly refused: string } {
  let identity;
  try {
    identity = resolveApprovalCommandIdentity(args);
  } catch (error: unknown) {
    return { refused: error instanceof Error ? error.message : String(error) };
  }
  const [taskId, ...rest] = identity.remainingArgs;
  if (!taskId || taskId.startsWith("--")) return { refused: usage };
  const job = getJob(taskId);
  const refusal = refuseResultSignOff(job, taskId);
  if (!job || refusal) return { refused: refusal ?? usage };

  const designated = designatedApproversForFunction(job.businessFunctionId);
  if (!mayDecideForFunction(designated, identity.workerName)) {
    broadcastEvent(
      `job.result_${verb.replace(/\s+/g, "_")}_refused`,
      "warn",
      `${verb[0].toUpperCase()}${verb.slice(1)} of Task ${taskId} refused: ${identity.workerName} is not the accountable approver`
    );
    return {
      refused: [
        `${identity.workerName} is not accountable for this Function, so nothing was recorded.`,
        `The staffing plan you applied made ${designated.join(" or ")} accountable for it.`,
      ].join("\n"),
    };
  }
  return { job, worker: identity.workerName, rest };
}

/**
 * Records that a named person read a finished result and did not accept it,
 * with their reason. The terminal's /task setaside and the page's "Set aside"
 * both call this and nothing else. Every refusal comes before anything is
 * written.
 *
 * SIDE EFFECT: May write a signed set-aside and broadcast a runtime event.
 */
export function setAsideTaskResult(args: readonly string[]): TaskSetAsideOutcome {
  const refused = (message: string): TaskSetAsideOutcome => ({ setAside: false, message });
  const decider = resolveResultDecider(args, USAGE, "set aside");
  if ("refused" in decider) return refused(decider.refused);
  const { job, worker } = decider;
  const reason = decider.rest.join(" ").trim();
  const badReason = refuseSetAsideReason(reason);
  if (badReason) return refused(`${badReason}\n${USAGE}`);

  const signed = readResultSignOffStanding(job);
  if (signed.state === "signed") {
    return refused(`${job.id} was signed off by ${signed.signOff.worker}, so it cannot be set aside. Nothing was recorded.`);
  }
  const already = readResultSetAsideStanding(job);
  if (already.state === "set_aside") {
    return refused(`${job.id} was already set aside by ${already.setAside.worker}. Nothing was recorded.`);
  }

  recordResultSetAside(job, worker, reason);
  broadcastEvent("job.result_set_aside", "info", `Result of Task ${job.id} set aside by ${worker}: ${reason.replace(/\s+/g, " ").trim()}`);
  return {
    setAside: true,
    message: [
      `Set aside: ${job.id}`,
      `Set aside by: ${worker}`,
      describeResultSetAside(readResultSetAsideStanding(job)) ?? "",
      "It stays on the file, marked as not accepted, and is no longer waiting for anyone.",
    ].join("\n"),
  };
}
