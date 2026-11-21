export const ARTEFACT_KINDS = [
  "design",
  "evidence",
  "specification",
  "price-list",
  "costing",
  "other",
] as const;

export type ArtefactKind =
  typeof ARTEFACT_KINDS[number];

export type ArtefactReviewStatus =
  | "draft"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "revision_requested";

export type ArtefactVersion = {
  readonly artefactId: string;
  readonly version: number;
  readonly uri: string;
  readonly localPath?: string;
  readonly mediaType: string;
  readonly sha256?: string;
  readonly sizeBytes?: number;
  readonly createdBy: string;
  readonly sourceJobId?: string;
  readonly sourceHumanTaskId?: string;
  readonly notes?: string;
  readonly createdAt: number;
  readonly reviewStatus: ArtefactReviewStatus;
  readonly reviewTaskId?: string;
  readonly reviewer?: string;
  readonly reviewedAt?: number;
  readonly reviewNotes?: string;
  readonly reviewSignature?: string;
};

export type Artefact = {
  readonly id: string;
  readonly enterpriseId: string;
  readonly name: string;
  readonly kind: ArtefactKind;
  readonly createdAt: number;
  readonly versions: readonly ArtefactVersion[];
};

export type ArtefactReference = {
  readonly artefactId: string;
  readonly version: number;
};

/** Returns whether a value is one of Arturo's accepted Artefact kinds. */
export function isArtefactKind(
  value: string
): value is ArtefactKind {
  return (
    ARTEFACT_KINDS as readonly string[]
  ).includes(
    value
  );
}

/** Formats one immutable Artefact-version reference. */
export function formatArtefactReference(
  reference: ArtefactReference
): string {
  return `${reference.artefactId}@${reference.version}`;
}

/**
 * Parses an exact Artefact-version reference.
 *
 * The version suffix is mandatory because approvals must never float to a
 * newer file version silently.
 */
export function parseArtefactReference(
  value: string
): ArtefactReference {
  const match =
    /^(artefact-[A-Za-z0-9-]+)@([1-9]\d*)$/.exec(
      value.trim()
    );

  if (!match) {
    throw new Error(
      `Invalid Artefact reference: ${value}. Use <artefact-id>@<version>, for example artefact-1@1.`
    );
  }

  return {
    artefactId:
      match[1],
    version:
      Number(
        match[2]
      ),
  };
}

/** Parses a comma-separated list of exact Artefact-version references. */
export function parseArtefactReferences(
  value: string
): ArtefactReference[] {
  const references =
    value
      .split(",")
      .map(
        (item) =>
          item.trim()
      )
      .filter(Boolean)
      .map(
        parseArtefactReference
      );

  if (!references.length) {
    throw new Error(
      "At least one Artefact reference is required."
    );
  }

  const unique =
    new Set(
      references.map(
        formatArtefactReference
      )
    );

  if (
    unique.size !==
    references.length
  ) {
    throw new Error(
      "Artefact references must be unique."
    );
  }

  return references;
}

/**
 * Turns a stored review status into words a reader knows.
 *
 * The stored value is untouched — `artefactStore` and the review commands
 * compare against it — but "revision_requested" is a field name, not something
 * to show an operator who is being asked to act on it.
 *
 * PURE: No side effects.
 */
export function describeArtefactReviewStatus(
  status: string
): string {
  const plain: Record<string, string> = {
    draft: "Draft",
    awaiting_review: "Waiting for review",
    approved: "Approved",
    rejected: "Rejected",
    revision_requested: "Changes requested",
  };
  return plain[status] ?? status.replace(/_/g, " ");
}
