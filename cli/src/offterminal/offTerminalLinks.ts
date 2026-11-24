/**
 * Single-use off-terminal links, stored only as a hash, bound to one
 * result, one person and the content hash (off-terminal sign-off brief).
 *
 * SIDE EFFECT: Reads and writes the runtime database.
 */

import crypto from "node:crypto";

import {
  ENROLMENT_LINK_LIFE_MS,
  resolveOffTerminalLinkLifeMs,
} from "../runtime/chainLimits";
import {
  clearPersistedOffTerminalLinks,
  loadOffTerminalLinkRow,
  loadOffTerminalLinkRows,
  loadOffTerminalLinkRowsForJob,
  loadOffTerminalLinkRowsForEnterprise,
  loadOffTerminalLinkRowsForPerson,
  saveOffTerminalLinkRow,
} from "../storage/offTerminalLinkRepository";
import { isOffTerminalPathOn, PATH_OFF_REFUSAL } from "./offTerminalPathState";
import { mayIssueOffTerminalLink } from "./publicBaseUrl";

export const LINK_ENDED_MESSAGE = "This link no longer works";

export type OffTerminalLinkKind = "sign-off" | "enrolment";

export type OffTerminalLink = {
  readonly tokenSha256: string;
  readonly kind: OffTerminalLinkKind;
  readonly enterpriseId: string;
  readonly jobId?: string;
  readonly resultSha256?: string;
  readonly person: string;
  readonly userId?: string;
  readonly createdAt: number;
  readonly expiresAt: number;
  readonly revokedAt?: number;
  readonly consumedAt?: number;
};

export type IssuedOffTerminalLink = {
  readonly token: string;
  readonly url: string;
  readonly link: OffTerminalLink;
};

export type OffTerminalLinkRefusal = { readonly refused: string };

export type IssueOffTerminalLinkInput = {
  readonly kind: OffTerminalLinkKind;
  readonly enterpriseId: string;
  readonly person: string;
  readonly userId?: string;
  readonly jobId?: string;
  readonly resultSha256?: string;
  readonly lifeMs?: number;
  readonly now?: number;
  readonly env?: NodeJS.ProcessEnv;
};

function tokenSha256(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

function parseLink(recordJson: string): OffTerminalLink | undefined {
  try {
    const record = JSON.parse(recordJson) as OffTerminalLink;
    if (!record || typeof record.tokenSha256 !== "string") {
      return undefined;
    }
    return record;
  } catch {
    return undefined;
  }
}

function persist(link: OffTerminalLink): void {
  saveOffTerminalLinkRow(
    link.tokenSha256,
    link.enterpriseId,
    link.jobId,
    link.person,
    JSON.stringify(link)
  );
}

function ended(link: OffTerminalLink, now: number): boolean {
  return (
    link.expiresAt <= now ||
    link.revokedAt !== undefined ||
    link.consumedAt !== undefined
  );
}

function revokeLink(link: OffTerminalLink, now: number): void {
  if (link.revokedAt !== undefined || link.consumedAt !== undefined) {
    return;
  }
  persist({ ...link, revokedAt: now });
}

/** Issues a single-use link and returns the raw token once. Nothing is stored but the hash. */
export function issueOffTerminalLink(
  input: IssueOffTerminalLinkInput
): IssuedOffTerminalLink | OffTerminalLinkRefusal {
  const publicUrl = mayIssueOffTerminalLink(input.env ?? process.env);
  if (!publicUrl.ok) {
    return { refused: publicUrl.refused };
  }
  const now = input.now ?? Date.now();
  if (!isOffTerminalPathOn(input.enterpriseId, now)) {
    return { refused: PATH_OFF_REFUSAL };
  }
  if (!input.enterpriseId.trim() || !input.person.trim()) {
    return { refused: "A link has to be bound to a business and a person." };
  }
  if (input.kind === "sign-off") {
    if (!input.jobId || !input.resultSha256) {
      return { refused: "A sign-off link has to be bound to one result and its content hash." };
    }
  }

  const lifeMs =
    input.kind === "enrolment"
      ? ENROLMENT_LINK_LIFE_MS
      : resolveOffTerminalLinkLifeMs(input.lifeMs);
  const token = crypto.randomBytes(32).toString("base64url");
  const link: OffTerminalLink = {
    tokenSha256: tokenSha256(token),
    kind: input.kind,
    enterpriseId: input.enterpriseId,
    person: input.person,
    createdAt: now,
    expiresAt: now + lifeMs,
    ...(input.userId ? { userId: input.userId } : {}),
    ...(input.jobId ? { jobId: input.jobId } : {}),
    ...(input.resultSha256 ? { resultSha256: input.resultSha256 } : {}),
  };
  persist(link);
  const path = input.kind === "enrolment" ? "pair" : "sign-off";
  return {
    token,
    url: `${publicUrl.baseUrl}/${path}/${token}`,
    link,
  };
}

/**
 * Resolves a presented token. A miss, an expiry, a revoke, a spent link or
 * a changed result all look the same to the person.
 */
export function lookupOffTerminalLink(
  token: string,
  options: { readonly now?: number; readonly resultSha256?: string } = {}
): OffTerminalLink | OffTerminalLinkRefusal {
  const now = options.now ?? Date.now();
  const record = loadOffTerminalLinkRow(tokenSha256(token));
  const link = record ? parseLink(record) : undefined;
  if (!link || ended(link, now)) {
    return { refused: LINK_ENDED_MESSAGE };
  }
  if (!isOffTerminalPathOn(link.enterpriseId, now)) {
    return { refused: LINK_ENDED_MESSAGE };
  }
  if (
    link.resultSha256 &&
    options.resultSha256 !== undefined &&
    options.resultSha256 !== link.resultSha256
  ) {
    revokeLink(link, now);
    return { refused: LINK_ENDED_MESSAGE };
  }
  return link;
}

/** Spends a link after a successful sign-off or set-aside. */
export function consumeOffTerminalLink(token: string, now = Date.now()): void {
  const record = loadOffTerminalLinkRow(tokenSha256(token));
  const link = record ? parseLink(record) : undefined;
  if (!link || ended(link, now)) {
    return;
  }
  persist({ ...link, consumedAt: now });
}

/** Revokes every link issued for one Task, for example after sign-off or set-aside. */
export function revokeOffTerminalLinksForJob(jobId: string, now = Date.now()): void {
  for (const record of loadOffTerminalLinkRowsForJob(jobId)) {
    const link = parseLink(record);
    if (link) {
      revokeLink(link, now);
    }
  }
}

/** Revokes every link issued to one person, for example after a role change. */
export function revokeOffTerminalLinksForPerson(
  enterpriseId: string,
  person: string,
  now = Date.now()
): void {
  for (const record of loadOffTerminalLinkRowsForPerson(enterpriseId, person)) {
    const link = parseLink(record);
    if (link) {
      revokeLink(link, now);
    }
  }
}

/** Revokes every link issued at one business, for example when the path is turned off. */
export function revokeOffTerminalLinksForEnterprise(
  enterpriseId: string,
  now = Date.now()
): void {
  for (const record of loadOffTerminalLinkRowsForEnterprise(enterpriseId)) {
    const link = parseLink(record);
    if (link) {
      revokeLink(link, now);
    }
  }
}

/** SIDE EFFECT: Deletes every off-terminal link (tests and /reset). */
export function clearOffTerminalLinks(): void {
  clearPersistedOffTerminalLinks();
}

/** Test helper: every stored record, so tests can assert the raw token is absent. */
export function listOffTerminalLinkRecords(): OffTerminalLink[] {
  return loadOffTerminalLinkRows()
    .map(parseLink)
    .filter((link): link is OffTerminalLink => link !== undefined);
}
