import crypto from "crypto";

import {
  getHumanTaskTokenSecret,
} from "./humanTaskLink";

/**
 * A review link that says who it was issued to.
 *
 * The review link used to carry one thing: an unguessable random token stored on
 * the Job. Possession of it was the whole credential, so the server had no way
 * to know who was deciding and attributed the decision to whatever
 * `job.worker` happened to say at the time — a mutable field. Two consequences:
 * a signed Artefact decision could be recorded under a name nobody had issued a
 * link to, and changing `job.worker` after a link was sent silently changed who
 * the record blamed.
 *
 * A credential binds the reviewer's name to the Job with an HMAC, so the name
 * the server acts on is the name Arturo issued the link for, and no field it can
 * read afterwards can alter it.
 *
 * This credential does not authenticate its holder. The HTTP decision boundary
 * separately requires a verified User session with active Enterprise authority
 * bound to this Human Worker. Trusted in-process callers remain a local-host
 * boundary; see THREAT_MODEL.md item 4.
 */
export type ReviewCredential = {
  /** The random per-Job token. Still the unguessable part. */
  readonly bearerToken: string;
  /** The registered Human the link was issued to. */
  readonly reviewer: string;
  readonly issuedAt: number;
};

/**
 * How long a review link stays usable.
 *
 * Matches the Human Task link, which has always expired after a day. A decision
 * credential that never expired was the other half of the bearer-token problem:
 * an old link in an inbox stayed live for ever.
 */
export const REVIEW_LINK_LIFETIME_MS = 24 * 60 * 60 * 1000;

/** JSON, so a reviewer's name can contain anything a name can contain. PURE. */
function encodePayload(
  credential: ReviewCredential
): string {
  return Buffer.from(
    JSON.stringify({
      t: credential.bearerToken,
      r: credential.reviewer,
      i: credential.issuedAt,
    }),
    "utf8"
  ).toString("base64url");
}

/** Signs `<jobId>:<payload>`, so a payload cannot be moved to another Job. PURE. */
export function signReviewPayload(
  jobId: string,
  payload: string,
  secret: string
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${jobId}:${payload}`)
    .digest("hex");
}

/**
 * Builds the credential that goes in the link's `token` parameter.
 *
 * One parameter, not four, because `redirectTokenToCookie` exchanges the query
 * token for a path-scoped cookie and drops everything else — separate
 * `reviewer`/`issued`/`signature` parameters would not survive to the POST.
 *
 * SIDE EFFECT: Reads HUMAN_TASK_TOKEN_SECRET.
 */
export function createReviewCredential(input: {
  readonly jobId: string;
  readonly bearerToken: string;
  readonly reviewer: string;
  readonly issuedAt?: number;
}): string {
  const payload = encodePayload({
    bearerToken: input.bearerToken,
    reviewer: input.reviewer,
    issuedAt: input.issuedAt ?? Date.now(),
  });

  return `${payload}.${signReviewPayload(
    input.jobId,
    payload,
    getHumanTaskTokenSecret()
  )}`;
}

/**
 * Reads a credential, or returns nothing when it is not one Arturo issued.
 *
 * Fails closed on every path: wrong shape, wrong signature, wrong Job, expired,
 * or missing a reviewer. There is deliberately no fallback to treating the value
 * as a bare bearer token — that fallback is the behaviour being removed, and
 * keeping it would leave the old attribution in place for anyone who trimmed the
 * signature off their link.
 *
 * SIDE EFFECT: Reads HUMAN_TASK_TOKEN_SECRET.
 */
export function readReviewCredential(
  jobId: string,
  value: string | null,
  now: number = Date.now()
): ReviewCredential | undefined {
  if (!value) return undefined;

  const separator = value.lastIndexOf(".");
  if (separator <= 0) return undefined;

  const payload = value.slice(0, separator);
  const supplied = value.slice(separator + 1);

  const expected = signReviewPayload(
    jobId,
    payload,
    getHumanTaskTokenSecret()
  );
  const suppliedBytes = Buffer.from(supplied, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !crypto.timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    return undefined;
  }

  let decoded: { t?: unknown; r?: unknown; i?: unknown };
  try {
    decoded = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8")
    ) as { t?: unknown; r?: unknown; i?: unknown };
  } catch {
    return undefined;
  }

  const bearerToken = typeof decoded.t === "string" ? decoded.t : "";
  const reviewer = typeof decoded.r === "string" ? decoded.r.trim() : "";
  const issuedAt = typeof decoded.i === "number" ? decoded.i : 0;

  if (!bearerToken || !reviewer || !issuedAt) return undefined;

  const age = now - issuedAt;
  if (age < 0 || age > REVIEW_LINK_LIFETIME_MS) return undefined;

  return { bearerToken, reviewer, issuedAt };
}
