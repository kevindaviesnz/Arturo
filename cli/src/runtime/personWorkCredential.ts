import crypto from "crypto";

import { listWorkers } from "../control/workers";
import { getHumanTaskTokenSecret } from "./humanTaskLink";

/**
 * The link that opens one person's own work page.
 *
 * It binds a registered person's name with an HMAC, so the page acts for the
 * person Arturo issued it to and nobody else: the name cannot be edited in
 * the link, and a link for one person opens nothing of another's. It is
 * domain-separated from review links and Human Task links, so none of the
 * three can be passed off as another.
 *
 * Like the review link, it does not authenticate whoever holds it; it is a
 * capability for one named person, on this single-tenant, operator-trusted
 * host. See THREAT_MODEL.md item 12.
 */
export type PersonWorkCredential = {
  readonly person: string;
  readonly issuedAt: number;
};

/** How long a work-page link stays usable. A week, so it survives a weekend. */
export const PERSON_WORK_LINK_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

const DOMAIN = "person-work:v1";

/** PURE: No side effects. */
export function signPersonWorkPayload(payload: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(`${DOMAIN}:${payload}`).digest("hex");
}

const registeredPerson = (name: string) =>
  listWorkers().find(
    (worker) =>
      worker.kind === "human" &&
      (worker.name.toLowerCase() === name.toLowerCase() ||
        worker.displayName?.toLowerCase() === name.toLowerCase())
  );

/**
 * Issues a work-page credential for a registered person, or explains why not.
 *
 * SIDE EFFECT: Reads the Worker registry and HUMAN_TASK_TOKEN_SECRET.
 */
export function issuePersonWorkCredential(
  person: string,
  issuedAt: number = Date.now()
): { readonly credential: string; readonly person: string } | { readonly refused: string } {
  const worker = registeredPerson(person.trim());
  if (!worker) {
    return { refused: `${person} is not a registered person. Add them with /add-human-worker first.` };
  }
  const name = worker.displayName ?? worker.name;
  const payload = Buffer.from(JSON.stringify({ p: name, i: issuedAt }), "utf8").toString("base64url");
  return { credential: `${payload}.${signPersonWorkPayload(payload, getHumanTaskTokenSecret())}`, person: name };
}

/**
 * Reads a work-page credential, or nothing when Arturo did not issue it, it
 * has expired, or the person is no longer registered. Fails closed.
 *
 * SIDE EFFECT: Reads the Worker registry and HUMAN_TASK_TOKEN_SECRET.
 */
export function readPersonWorkCredential(
  value: string | null | undefined,
  now: number = Date.now()
): PersonWorkCredential | undefined {
  if (!value || value.length > 2048) return undefined;
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return undefined;
  const payload = value.slice(0, separator);
  const supplied = Buffer.from(value.slice(separator + 1), "utf8");
  const expected = Buffer.from(signPersonWorkPayload(payload, getHumanTaskTokenSecret()), "utf8");
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return undefined;

  let decoded: { p?: unknown; i?: unknown };
  try {
    decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { p?: unknown; i?: unknown };
  } catch {
    return undefined;
  }
  const person = typeof decoded.p === "string" ? decoded.p.trim() : "";
  const issuedAt = typeof decoded.i === "number" ? decoded.i : 0;
  if (!person || !issuedAt) return undefined;
  const age = now - issuedAt;
  if (age < 0 || age > PERSON_WORK_LINK_LIFETIME_MS) return undefined;
  // Removing a person ends their links.
  const worker = registeredPerson(person);
  if (!worker) return undefined;
  return { person: worker.displayName ?? worker.name, issuedAt };
}
