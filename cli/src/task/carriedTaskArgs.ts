import type { Job } from "../runtime/jobQueue";

/**
 * The /task create arguments every Task rebuilt from an earlier one carries:
 * who asked, the client and the named piece of work. One helper, so a path
 * that rebuilds a Task (pass-on, a route's step, retry) cannot drop the work
 * a draft belongs to.
 *
 * PURE: No side effects.
 */
export function carriedTaskArgs(job: Pick<Job, "requestedBy" | "clientId" | "workId">): string[] {
  return [
    ...(job.requestedBy ? ["--asked-by", job.requestedBy] : []),
    ...(job.clientId ? ["--client", job.clientId] : []),
    ...(job.workId ? ["--work", job.workId] : []),
  ];
}
