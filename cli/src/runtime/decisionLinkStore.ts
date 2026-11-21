import crypto from "crypto";

export type DecisionLinkStatus =
  | "active"
  | "used"
  | "expired";

export type DecisionLink = {
  id: string;

  jobId: string;

  email: string;

  tokenHash: string;

  status: DecisionLinkStatus;

  createdAt: number;

  expiresAt: number;

  usedAt?: number;
};

const links =
  new Map<
    string,
    DecisionLink
  >();

/**
 * Creates a decision link.
 *
 * @param jobId Associated job id.
 * @param email Recipient email.
 * @param tokenHash Hashed review token.
 * @param expiresAt Expiration timestamp.
 * @returns Newly created decision link.
 *
 * SIDE EFFECT: Mutates in-memory decision link store.
 */
export function createDecisionLink(
  jobId: string,
  email: string,
  tokenHash: string,
  expiresAt: number
): DecisionLink {
  const link: DecisionLink = {
    id:
      crypto.randomUUID(),

    jobId,

    email,

    tokenHash,

    status: "active",

    createdAt:
      Date.now(),

    expiresAt,
  };

  links.set(
    link.id,
    link
  );

  return link;
}

/**
 * Retrieves a decision link by id.
 *
 * @param id Decision link id.
 * @returns Matching decision link.
 *
 * PURE: Reads store only.
 */
export function getDecisionLink(
  id: string
):
  | DecisionLink
  | undefined {
  return links.get(id);
}

/**
 * Finds a decision link by job id.
 *
 * @param jobId Associated job id.
 * @returns Matching decision link.
 *
 * PURE: Reads store only.
 */
export function findDecisionLinkByJobId(
  jobId: string
):
  | DecisionLink
  | undefined {
  return [
    ...links.values(),
  ].find(
    (link) =>
      link.jobId === jobId
  );
}

/**
 * Marks a decision link as used.
 *
 * @param id Decision link id.
 * @returns Updated decision link.
 *
 * SIDE EFFECT: Mutates in-memory decision link store.
 */
export function markDecisionLinkUsed(
  id: string
):
  | DecisionLink
  | undefined {
  const existing =
    links.get(id);

  if (!existing) {
    return undefined;
  }

  const updated = {
    ...existing,

    status:
      "used" as const,

    usedAt:
      Date.now(),
  };

  links.set(
    id,
    updated
  );

  return updated;
}

/**
 * Marks a decision link as expired.
 *
 * @param id Decision link id.
 * @returns Updated decision link.
 *
 * SIDE EFFECT: Mutates in-memory decision link store.
 */
export function markDecisionLinkExpired(
  id: string
):
  | DecisionLink
  | undefined {
  const existing =
    links.get(id);

  if (!existing) {
    return undefined;
  }

  const updated = {
    ...existing,

    status:
      "expired" as const,
  };

  links.set(
    id,
    updated
  );

  return updated;
}

/**
 * Lists all decision links.
 *
 * @returns Decision links.
 *
 * PURE: Reads store only.
 */
export function listDecisionLinks():
  DecisionLink[] {
  return [
    ...links.values(),
  ];
}

/**
 * Clears decision link store.
 *
 * @returns void
 *
 * SIDE EFFECT: Mutates in-memory decision link store.
 */
export function clearDecisionLinks():
  void {
  links.clear();
}