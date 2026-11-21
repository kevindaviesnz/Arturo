import { handleArtefactWatchCommand } from "./artefactWatchCommands";
import {
  ARTEFACT_KINDS,
  describeArtefactReviewStatus,
  formatArtefactReference,
  isArtefactKind,
  parseArtefactReference,
  parseArtefactReferences,
  type Artefact,
  type ArtefactReference,
  type ArtefactVersion,
} from "../artefacts/artefact";

import {
  addArtefactVersion,
  createArtefact,
  getArtefact,
  getArtefactVersion,
  listArtefacts,
  reviewArtefactVersion,
  submitArtefactVersionForReview,
  verifyArtefactReviewSignature,
  verifyArtefactVersionIntegrity,
} from "../artefacts/artefactStore";

import {
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";

import {
  getWorker,
} from "../control/workers";

import {
  completeHumanTask,
  createHumanTask,
  getHumanTask,
} from "../runtime/humanTaskStore";

import {
  getJob,
} from "../runtime/jobQueue";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  releaseJobsWithApprovedArtefacts,
} from "../artefacts/artefactWorkflow";

import {
  wakeWorkerRuntime,
} from "../runtime/workerRuntime";

/** Returns one flag value in either `--flag value` or `--flag=value` form. */
export function getArtefactFlagValue(
  args: readonly string[],
  flag: string
): string | undefined {
  const index =
    args.indexOf(
      flag
    );

  if (index >= 0) {
    return args[
      index + 1
    ];
  }

  const prefix =
    `${flag}=`;
  return args
    .find(
      (arg) =>
        arg.startsWith(
          prefix
        )
    )
    ?.slice(
      prefix.length
    );
}

/** Formats immutable identity and review metadata for a version. */
export function formatArtefactVersion(
  version: ArtefactVersion
): string {
  const integrity =
    verifyArtefactVersionIntegrity(
      version
    );
  const signatureStatus =
    version.reviewSignature
      ? verifyArtefactReviewSignature(
          version
        )
        ? "valid"
        : "INVALID"
      : "none";

  return [
    `Version: ${formatArtefactReference(version)}`,
    `URI: ${version.uri}`,
    `Media type: ${version.mediaType}`,
    `Size: ${version.sizeBytes ?? "unknown"}`,
    `SHA-256: ${version.sha256 ?? "not supplied"}`,
    `Integrity: ${integrity.status} — ${integrity.message}`,
    `Created by: ${version.createdBy}`,
    `Source Task: ${version.sourceJobId ?? "none"}`,
    `Source Human Task: ${version.sourceHumanTaskId ?? "none"}`,
    `Created: ${new Date(version.createdAt).toISOString()}`,
    `Review: ${describeArtefactReviewStatus(version.reviewStatus)}`,
    `Review task: ${version.reviewTaskId ?? "none"}`,
    `Reviewer: ${version.reviewer ?? "none"}`,
    `Review signature: ${signatureStatus}`,
    version.reviewNotes
      ? `Review notes: ${version.reviewNotes}`
      : undefined,
    version.notes
      ? `Notes: ${version.notes}`
      : undefined,
  ]
    .filter(
      (
        line
      ): line is string =>
        Boolean(
          line
        )
    )
    .join(
      "\n"
    );
}

/** Formats one Artefact and every recorded version. */
export function formatArtefact(
  artefact: Artefact,
  selectedVersion?: number
): string {
  const versions =
    selectedVersion ===
    undefined
      ? artefact.versions
      : artefact.versions.filter(
          (version) =>
            version.version ===
            selectedVersion
        );

  if (!versions.length) {
    throw new Error(
      `Artefact version not found: ${artefact.id}@${selectedVersion}`
    );
  }

  return [
    `Artefact: ${artefact.name}`,
    `ID: ${artefact.id}`,
    `Enterprise: ${artefact.enterpriseId}`,
    `Kind: ${artefact.kind}`,
    `Versions: ${artefact.versions.length}`,
    "",
    versions
      .map(
        formatArtefactVersion
      )
      .join(
        "\n\n"
      ),
  ].join(
    "\n"
  );
}

/** Resolves and validates a registered Worker used for provenance. */
export function resolveArtefactWorker(
  reference: string,
  humanOnly = false
) {
  const worker =
    getWorker(
      reference
    );

  if (!worker) {
    throw new Error(
      `Worker not found: ${reference}`
    );
  }

  if (
    humanOnly &&
    worker.kind !==
    "human"
  ) {
    throw new Error(
      `Worker is not Human: ${reference}`
    );
  }

  if (
    worker.availability ===
    "offline"
  ) {
    throw new Error(
      `Worker is offline: ${reference}`
    );
  }

  return worker;
}

/** Validates optional source links before they are stored. */
export function validateArtefactSourceLinks(
  sourceJobId: string | undefined,
  sourceHumanTaskId: string | undefined
): void {
  if (
    sourceJobId &&
    !getJob(
      sourceJobId
    )
  ) {
    throw new Error(
      `Task not found: ${sourceJobId}`
    );
  }

  if (
    sourceHumanTaskId &&
    !getHumanTask(
      sourceHumanTaskId
    )
  ) {
    throw new Error(
      `Human Task not found: ${sourceHumanTaskId}`
    );
  }
}

/**
 * Resolves the preferred Task and Human Task flags while retaining the older
 * execution-Job and Human-Task forms for existing scripts.
 */
export function resolveArtefactSourceLinks(
  args: readonly string[]
): {
  readonly sourceJobId?: string;
  readonly sourceHumanTaskId?: string;
} {
  const taskReference =
    getArtefactFlagValue(
      args,
      "--task"
    );
  const legacyJobReference =
    getArtefactFlagValue(
      args,
      "--job"
    );
  const explicitHumanTaskReference =
    getArtefactFlagValue(
      args,
      "--human-task"
    );

  if (
    taskReference &&
    legacyJobReference &&
    taskReference !==
      legacyJobReference
  ) {
    throw new Error(
      "Use either --task or the legacy --job flag, not both."
    );
  }

  if (
    taskReference &&
    explicitHumanTaskReference &&
    getHumanTask(
      taskReference
    )
  ) {
    throw new Error(
      "Use --human-task once for a Human Task reference."
    );
  }

  const legacyHumanTaskReference =
    taskReference &&
    !getJob(
      taskReference
    ) &&
    getHumanTask(
      taskReference
    )
      ? taskReference
      : undefined;

  return {
    sourceJobId:
      legacyJobReference ??
      (
        legacyHumanTaskReference
          ? undefined
          : taskReference
      ),
    sourceHumanTaskId:
      explicitHumanTaskReference ??
      legacyHumanTaskReference,
  };
}

/**
 * Handles `/artefact add`, `/artefact version`, `/artefact inspect`,
 * `/artefact submit`, `/artefact review`, and `/artefact verify`.
 */
export function handleArtefactCommand(
  args: readonly string[]
): void {
  const [
    operation,
    referenceOrName,
  ] = args;

  if (operation === "watch") {
    handleArtefactWatchCommand(args.slice(1));
    return;
  }

  try {
    if (
      operation ===
      "add"
    ) {
      const enterpriseReference =
        getArtefactFlagValue(
          args,
          "--enterprise"
        );
      const createdByReference =
        getArtefactFlagValue(
          args,
          "--created-by"
        );
      const kindRaw =
        getArtefactFlagValue(
          args,
          "--kind"
        ) ??
        "other";
      const file =
        getArtefactFlagValue(
          args,
          "--file"
        );
      const uri =
        getArtefactFlagValue(
          args,
          "--uri"
        );
      const {
        sourceJobId,
        sourceHumanTaskId,
      } =
        resolveArtefactSourceLinks(
          args
        );

      if (
        !referenceOrName ||
        !enterpriseReference ||
        !createdByReference ||
        (
          !file &&
          !uri
        )
      ) {
        console.log(
          'Usage: /artefact add "<name>" --enterprise "<enterprise>" --kind <kind> (--file "<path>"|--uri "<https-url>") --created-by "<worker>" [--task <task-id>] [--human-task <human-task-id>] [--media-type "<type>"] [--sha256 <hash>] [--notes "<notes>"]'
        );
        return;
      }

      if (
        !isArtefactKind(
          kindRaw
        )
      ) {
        throw new Error(
          `Unknown Artefact kind: ${kindRaw}. Allowed kinds: ${ARTEFACT_KINDS.join(", ")}`
        );
      }

      const enterprise =
        getEnterpriseByIdOrName(
          enterpriseReference
        );
      if (!enterprise) {
        throw new Error(
          `Enterprise not found: ${enterpriseReference}`
        );
      }

      const createdBy =
        resolveArtefactWorker(
          createdByReference
        );
      validateArtefactSourceLinks(
        sourceJobId,
        sourceHumanTaskId
      );

      const artefact =
        createArtefact({
          enterpriseId:
            enterprise.id,
          name:
            referenceOrName,
          kind:
            kindRaw,
          file,
          uri,
          mediaType:
            getArtefactFlagValue(
              args,
              "--media-type"
            ),
          sha256:
            getArtefactFlagValue(
              args,
              "--sha256"
            ),
          createdBy:
            createdBy.displayName ??
            createdBy.name,
          sourceJobId,
          sourceHumanTaskId,
          notes:
            getArtefactFlagValue(
              args,
              "--notes"
            ),
        });
      const version =
        artefact.versions[0];

      console.log(
        "Artefact added."
      );
      console.log(
        `ID: ${artefact.id}`
      );
      console.log(
        `Version: ${formatArtefactReference(version)}`
      );
      console.log(
        `SHA-256: ${version.sha256 ?? "not supplied"}`
      );
      console.log(
        "Review: draft"
      );

      broadcastEvent(
        "artefact.created",
        "success",
        `Artefact created: ${formatArtefactReference(version)} by ${version.createdBy}`
      );
      return;
    }

    if (
      operation ===
      "version"
    ) {
      const createdByReference =
        getArtefactFlagValue(
          args,
          "--created-by"
        );
      const file =
        getArtefactFlagValue(
          args,
          "--file"
        );
      const uri =
        getArtefactFlagValue(
          args,
          "--uri"
        );
      const {
        sourceJobId,
        sourceHumanTaskId,
      } =
        resolveArtefactSourceLinks(
          args
        );

      if (
        !referenceOrName ||
        !createdByReference ||
        (
          !file &&
          !uri
        )
      ) {
        console.log(
          'Usage: /artefact version <artefact-id> (--file "<path>"|--uri "<https-url>") --created-by "<worker>" [--task <task-id>] [--human-task <human-task-id>] [--media-type "<type>"] [--sha256 <hash>] [--notes "<notes>"]'
        );
        return;
      }

      const createdBy =
        resolveArtefactWorker(
          createdByReference
        );
      validateArtefactSourceLinks(
        sourceJobId,
        sourceHumanTaskId
      );

      const version =
        addArtefactVersion(
          referenceOrName,
          {
            file,
            uri,
            mediaType:
              getArtefactFlagValue(
                args,
                "--media-type"
              ),
            sha256:
              getArtefactFlagValue(
                args,
                "--sha256"
              ),
            createdBy:
              createdBy.displayName ??
              createdBy.name,
            sourceJobId,
            sourceHumanTaskId,
            notes:
              getArtefactFlagValue(
                args,
                "--notes"
              ),
          }
        );

      console.log(
        "Artefact version added."
      );
      console.log(
        `Version: ${formatArtefactReference(version)}`
      );
      console.log(
        `SHA-256: ${version.sha256 ?? "not supplied"}`
      );

      broadcastEvent(
        "artefact.version.created",
        "success",
        `Artefact version created: ${formatArtefactReference(version)}`
      );
      return;
    }

    if (
      operation ===
      "inspect"
    ) {
      if (!referenceOrName) {
        console.log(
          "Usage: /artefact inspect <artefact-id> [--version <number>]"
        );
        return;
      }

      const artefact =
        getArtefact(
          referenceOrName
        );
      if (!artefact) {
        throw new Error(
          `Artefact not found: ${referenceOrName}`
        );
      }
      const versionRaw =
        getArtefactFlagValue(
          args,
          "--version"
        );

      console.log(
        formatArtefact(
          artefact,
          versionRaw
            ? Number(
                versionRaw
              )
            : undefined
        )
      );
      return;
    }

    if (
      operation ===
      "verify"
    ) {
      if (!referenceOrName) {
        console.log(
          "Usage: /artefact verify <artefact-id>@<version>"
        );
        return;
      }
      const reference =
        parseArtefactReference(
          referenceOrName
        );
      const version =
        getArtefactVersion(
          reference
        );
      if (!version) {
        throw new Error(
          `Artefact version not found: ${referenceOrName}`
        );
      }
      const integrity =
        verifyArtefactVersionIntegrity(
          version
        );

      console.log(
        `Version: ${referenceOrName}`
      );
      console.log(
        `Integrity: ${integrity.status}`
      );
      console.log(
        integrity.message
      );
      return;
    }

    if (
      operation ===
      "submit"
    ) {
      const reviewerReference =
        getArtefactFlagValue(
          args,
          "--reviewer"
        );

      if (
        !referenceOrName ||
        !reviewerReference
      ) {
        console.log(
          'Usage: /artefact submit <artefact-id>@<version>[,...] --reviewer "<human-worker>" [--notes "<review-instructions>"]'
        );
        return;
      }

      const reviewer =
        resolveArtefactWorker(
          reviewerReference,
          true
        );
      const references =
        parseArtefactReferences(
          referenceOrName
        );
      const versions =
        references.map(
          (reference) => {
            const version =
              getArtefactVersion(
                reference
              );
            if (!version) {
              throw new Error(
                `Artefact version not found: ${formatArtefactReference(reference)}`
              );
            }
            if (
              version.reviewStatus !==
                "draft" &&
              version.reviewStatus !==
                "revision_requested"
            ) {
              throw new Error(
                `Artefact version is already ${describeArtefactReviewStatus(version.reviewStatus)}: ${formatArtefactReference(reference)}`
              );
            }
            return version;
          }
        );
      const reviewerName =
        reviewer.displayName ??
        reviewer.name;
      const reviewNotes =
        getArtefactFlagValue(
          args,
          "--notes"
        ) ??
        "Inspect the exact file versions and record approve, reject, or revise with reasons.";
      const task =
        createHumanTask({
          title:
            `Review Artefacts: ${references.map(formatArtefactReference).join(", ")}`,
          owner:
            reviewerName,
          purpose:
            "Make a post-output Human decision about exact, hashed Artefact versions.",
          instructions:
            reviewNotes,
          requestedAction:
            "Inspect every exact version and record one review decision.",
          inputArtefactRefs:
            references.map(
              formatArtefactReference
            ),
          inputArtifact:
            versions
              .map(
                (version) =>
                  `${formatArtefactReference(version)} | ${version.uri} | SHA-256 ${version.sha256 ?? "not supplied"}`
              )
              .join(
                "\n"
              ),
          acceptanceCriteria: [
            "Open and inspect every exact version listed.",
            "Confirm the version identity and SHA-256 before deciding.",
            "Record approve, reject, or revise with a reason.",
          ],
          completionEvidence:
            "A signed Artefact review decision bound to each exact version and recorded reviewer.",
        });

      references.forEach(
        (reference) =>
          submitArtefactVersionForReview(
            reference,
            reviewerName,
            task.id
          )
      );

      console.log(
        "Artefacts submitted for review."
      );
      console.log(
        `Human task: ${task.id}`
      );
      console.log(
        `Reviewer: ${reviewerName}`
      );
      console.log(
        `Versions: ${references.map(formatArtefactReference).join(", ")}`
      );

      broadcastEvent(
        "artefact.review.requested",
        "warn",
        `Artefact review requested: ${references.map(formatArtefactReference).join(", ")} from ${reviewerName}`
      );
      return;
    }

    if (
      operation ===
      "review"
    ) {
      const reviewerReference =
        getArtefactFlagValue(
          args,
          "--as"
        );
      const decisionRaw =
        getArtefactFlagValue(
          args,
          "--decision"
        );
      const notes =
        getArtefactFlagValue(
          args,
          "--notes"
        );

      if (
        !referenceOrName ||
        !reviewerReference ||
        !decisionRaw ||
        !notes
      ) {
        console.log(
          'Usage: /artefact review <artefact-id>@<version>[,...] --decision <approve|reject|revise> --as "<human-worker>" --notes "<reason>"'
        );
        return;
      }

      const decisionMap = {
        approve:
          "approved",
        reject:
          "rejected",
        revise:
          "revision_requested",
      } as const;
      const decision =
        decisionMap[
          decisionRaw as keyof typeof decisionMap
        ];
      if (!decision) {
        throw new Error(
          "Unknown review decision. Use approve, reject, or revise."
        );
      }

      const reviewer =
        resolveArtefactWorker(
          reviewerReference,
          true
        );
      const reviewerName =
        reviewer.displayName ??
        reviewer.name;
      const references =
        parseArtefactReferences(
          referenceOrName
        );
      const versions =
        references.map(
          (reference) => {
            const version =
              getArtefactVersion(
                reference
              );
            if (!version) {
              throw new Error(
                `Artefact version not found: ${formatArtefactReference(reference)}`
              );
            }
            if (
              version.reviewStatus !==
              "awaiting_review"
            ) {
              throw new Error(
                `Artefact version is not awaiting review: ${formatArtefactReference(reference)}`
              );
            }
            if (
              version.reviewer?.toLowerCase() !==
              reviewerName.toLowerCase()
            ) {
              throw new Error(
                `Artefact review is assigned to ${version.reviewer}, not ${reviewerName}.`
              );
            }
            return version;
          }
        );
      const taskIds =
        new Set(
          versions.map(
            (version) =>
              version.reviewTaskId
          )
        );
      if (
        taskIds.size !==
        1
      ) {
        throw new Error(
          "All reviewed versions must belong to the same Human review task."
        );
      }

      references.forEach(
        (reference) =>
          reviewArtefactVersion(
            reference,
            {
              decision,
              reviewer:
                reviewerName,
              notes,
            }
          )
      );

      const taskId =
        versions[0]
          .reviewTaskId;
      if (taskId) {
        completeHumanTask(
          taskId,
          `${decision}: ${notes}`,
          reviewerName
        );
      }

      console.log(
        "Artefact review recorded."
      );
      console.log(
        `Decision: ${describeArtefactReviewStatus(decision)}`
      );
      console.log(
        `Reviewer: ${reviewerName}`
      );
      console.log(
        `Versions: ${references.map(formatArtefactReference).join(", ")}`
      );
      console.log(
        "Review signatures: valid"
      );

      broadcastEvent(
        `artefact.review.${decision}`,
        decision ===
          "approved"
          ? "success"
          : "warn",
        `Artefact review ${decision}: ${references.map(formatArtefactReference).join(", ")} by ${reviewerName}`
      );
      if (
        decision ===
        "approved"
      ) {
        const released =
          releaseJobsWithApprovedArtefacts();
        if (released.length) {
          console.log(
            `Jobs released: ${released.map((job) => job.id).join(", ")}`
          );
          wakeWorkerRuntime();
        }
      }
      return;
    }

    console.log(
      "Usage: /artefact <add|version|inspect|verify|submit|review> ..."
    );
  } catch (error) {
    console.log(
      error instanceof Error
        ? error.message
        : String(
            error
          )
    );
  }
}

/** Handles `/artefacts [--enterprise "<reference>"]`. */
export function handleArtefactsCommand(
  args: readonly string[]
): void {
  try {
    const enterpriseReference =
      getArtefactFlagValue(
        args,
        "--enterprise"
      );
    const enterprise =
      enterpriseReference
        ? getEnterpriseByIdOrName(
            enterpriseReference
          )
        : undefined;

    if (
      enterpriseReference &&
      !enterprise
    ) {
      throw new Error(
        `Enterprise not found: ${enterpriseReference}`
      );
    }

    const records =
      listArtefacts(
        enterprise?.id
      );

    if (!records.length) {
      console.log(
        "No Artefacts found."
      );
      return;
    }

    console.log(
      "Artefacts"
    );
    console.log("");
    records.forEach(
      (
        artefact,
        index
      ) => {
        const latest =
          artefact.versions[
            artefact.versions.length -
              1
          ];
        console.log(
          `${index + 1}. ${artefact.name}`
        );
        console.log(
          `   ID: ${artefact.id}`
        );
        console.log(
          `   Kind: ${artefact.kind}`
        );
        console.log(
          `   Enterprise: ${artefact.enterpriseId}`
        );
        console.log(
          `   Latest: ${latest ? formatArtefactReference(latest) : "none"}`
        );
        console.log(
          `   Review: ${latest ? describeArtefactReviewStatus(latest.reviewStatus) : "none"}`
        );
      }
    );
  } catch (error) {
    console.log(
      error instanceof Error
        ? error.message
        : String(
            error
          )
    );
  }
}
