import {
  parseArtefactReference,
} from "./artefact";

import {
  getArtefactVersion,
  refreshSuppliedArtefactContext,
} from "./artefactStore";

import {
  listJobs,
  replaceJob,
  type Job,
} from "../runtime/jobQueue";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

/** Returns true only when every exact dependency has Human approval. */
export function areArtefactDependenciesApproved(
  references: readonly string[]
): boolean {
  return references.every(
    (value) =>
      getArtefactVersion(
        parseArtefactReference(
          value
        )
      )?.reviewStatus ===
      "approved"
  );
}

/** Holds a queued Job until every exact Artefact version is approved. */
export function waitForArtefactApprovals(
  job: Job
): Job {
  const dependencies =
    job.artefactApprovalDependencies ??
    [];

  if (
    !dependencies.length ||
    areArtefactDependenciesApproved(
      dependencies
    )
  ) {
    return job;
  }

  return replaceJob({
    ...job,
    status:
      "awaiting_artefact_approval",
  });
}

/**
 * The Task's own text, with its Supplied Artefacts block brought up to date.
 *
 * The block was written when the Task was created, while the evidence it is
 * waiting on was still undecided — so at the moment of release it says the
 * opposite of why the release happened. Refreshing it here keeps the stored
 * Task a record of what the Worker is actually sent.
 *
 * A version that has since gone missing from the store makes the rebuild
 * throw. That must not strand an otherwise releasable Task, so the old text
 * stands and the Task is released regardless.
 */
function refreshedTaskText(
  job: Job
): string {
  const references =
    job.inputArtefactRefs ?? [];
  if (!references.length) return job.task;
  try {
    return refreshSuppliedArtefactContext(
      job.task,
      references.map(
        parseArtefactReference
      )
    );
  } catch {
    return job.task;
  }
}

/**
 * Releases every Job whose exact Artefact dependencies are now approved.
 *
 * Rejected and revision-requested versions remain blocked. A revised file is
 * a new version and therefore requires a new exact dependency reference.
 */
export function releaseJobsWithApprovedArtefacts():
  readonly Job[] {
  const released =
    listJobs()
      .filter(
        (job) =>
          job.status ===
            "awaiting_artefact_approval" &&
          areArtefactDependenciesApproved(
            job.artefactApprovalDependencies ??
            []
          )
      )
      .map(
        (job) =>
          replaceJob({
            ...job,
            status:
              "queued",
            task:
              refreshedTaskText(
                job
              ),
          })
      );

  released.forEach(
    (job) =>
      broadcastEvent(
        "job.artefact_gate.released",
        "success",
        `Task released after exact Artefact approval: ${job.id}`
      )
  );

  return released;
}
