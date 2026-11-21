import { withoutSuppliedArtefactContext } from "../artefacts/artefactStore";
import type { Job } from "../runtime/jobQueue";
import { withoutClientRecord } from "../clients/clientRecords";
import { carriedTaskArgs } from "./carriedTaskArgs";

/**
 * Turns a failed Task back into the `/task create` arguments that made it.
 *
 * A first-time user approved a Task with the local model switched off. It
 * failed, and the only way forward was to find the original instruction and
 * type the whole command again. A retry is a new Task: it is routed and
 * governed afresh, and an approval given to the failed one does not carry over.
 *
 * Only what can be rebuilt exactly is retried. A Task that searched the web,
 * followed another Task, waited on an Artefact approval, ran a Procedure or was
 * a Workflow step carries context this cannot reconstruct with certainty, and
 * a retry that silently dropped it would be a different Task under the same
 * name.
 */

export type TaskRetry =
  | { readonly retry: true; readonly createArgs: readonly string[] }
  | { readonly retry: false; readonly reason: string };

/**
 * PURE: No side effects.
 */
export function buildTaskRetry(
  job: Job | undefined,
  taskId: string,
  owner: { readonly functionLabel?: string; readonly enterpriseName?: string }
): TaskRetry {
  if (!job) {
    return { retry: false, reason: `No Task found with id ${taskId}. Check /tasks for the exact id.` };
  }

  if (job.status !== "failed") {
    return {
      retry: false,
      reason: `${taskId} did not fail, so there is nothing to retry. Its status is ${job.status}.`,
    };
  }

  const carried = [
    job.workflowRunId ? "it is a step of a Workflow run" : undefined,
    job.webSearchQuery ? "it used a Web Search" : undefined,
    job.sourceTaskId || job.sourceHumanTaskId ? "it followed earlier work" : undefined,
    job.artefactApprovalDependencies?.length ? "it waited on an Artefact approval" : undefined,
    job.procedureRef ? "it ran a Procedure" : undefined,
  ].filter((reason): reason is string => reason !== undefined);

  if (carried.length > 0) {
    return {
      retry: false,
      reason: `${taskId} cannot be retried automatically because ${carried.join(" and ")}. Create it again with /task create so nothing it depended on is left out.`,
    };
  }

  return {
    retry: true,
    createArgs: [
      withoutClientRecord(withoutSuppliedArtefactContext(job.task)),
      ...(owner.functionLabel ? ["--function", owner.functionLabel] : []),
      ...(owner.enterpriseName ? ["--enterprise", owner.enterpriseName] : []),
      ...(job.inputArtefactRefs?.length ? ["--input-artefact", job.inputArtefactRefs.join(",")] : []),
      ...carriedTaskArgs(job),
      // It was created, so it already passed the check on what no AI Worker
      // can do, or was asked for as writing only: either way, writing only.
      "--write-only",
    ],
  };
}
