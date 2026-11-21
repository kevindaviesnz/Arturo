/**
 * The signed log of what was sent to an AI provider for named work.
 *
 * Written before every model call on a work-bound Task, so a send that was
 * never logged never happens: if the entry cannot be written, the Task fails
 * with no call made. Each entry names the Task, the work, the provider and
 * routing mode, and each item sent by name, version and SHA-256, and is
 * signed with its own purpose. Material already sent cannot be recalled; this
 * only says what went.
 *
 * SIDE EFFECT: Reads Artefacts and writes the runtime database.
 */

import crypto from "node:crypto";

import { formatNzTime } from "../core/nzTime";

import { parseArtefactReference } from "../artefacts/artefact";
import { getArtefact, getArtefactVersion } from "../artefacts/artefactStore";
import { resolveConfiguredProvider } from "../llm/llmClient";
import type { Job } from "../runtime/jobQueue";
import { getLocalApprovalSigningSecret } from "../runtime/runtimeSecrets";
import { clearPersistedWorkSends, insertWorkSend, loadWorkSends } from "../storage/workSendRepository";

export type WorkSendItem = { readonly ref: string; readonly name: string; readonly sha256: string };

export type WorkSend = {
  readonly id: string;
  readonly jobId: string;
  readonly jobCreatedAt: number;
  readonly workId: string;
  readonly at: number;
  readonly provider: string;
  readonly routingMode: "single" | "local-first";
  readonly items: readonly WorkSendItem[];
  /** Which model call of the Task this was, from 1. */
  readonly call: number;
  readonly signature: string;
};

/** PURE: No side effects. */
function payloadOf(send: Omit<WorkSend, "signature">): string {
  return JSON.stringify({
    purpose: "work-send",
    id: send.id,
    jobId: send.jobId,
    jobCreatedAt: send.jobCreatedAt,
    workId: send.workId,
    at: send.at,
    provider: send.provider,
    routingMode: send.routingMode,
    items: send.items.map((item) => ({ ref: item.ref, name: item.name, sha256: item.sha256 })),
    call: send.call,
  });
}

/** SIDE EFFECT: Reads the signing secret. */
function sign(send: Omit<WorkSend, "signature">): string {
  return crypto.createHmac("sha256", getLocalApprovalSigningSecret()).update(payloadOf(send)).digest("hex");
}

/** SIDE EFFECT: Reads the signing secret. */
export function verifyWorkSend(send: WorkSend): boolean {
  const { signature, ...rest } = send;
  const expected = Buffer.from(sign(rest));
  const actual = Buffer.from(String(signature ?? ""));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

/** Each item a Task carries, by name, version and SHA-256. Throws if one cannot be named. SIDE EFFECT: Reads Artefacts. */
export function itemsSentFor(job: Pick<Job, "inputArtefactRefs">): WorkSendItem[] {
  return (job.inputArtefactRefs ?? []).map((ref) => {
    const reference = parseArtefactReference(ref);
    const version = getArtefactVersion(reference);
    const artefact = getArtefact(reference.artefactId);
    if (!version || !artefact || !version.sha256) throw new Error(`${ref} cannot be identified for the send log, so nothing was sent.`);
    return { ref, name: artefact.name, sha256: version.sha256 };
  });
}

/**
 * Signs and stores one send, before the model is called. Throws on any
 * failure, so the caller sends nothing.
 *
 * SIDE EFFECT: Reads Artefacts and settings; writes one row.
 */
export function recordWorkSend(job: Job, call: number, now = Date.now()): WorkSend {
  if (!job.workId) throw new Error(`${job.id} belongs to no piece of work.`);
  const { provider, routingMode } = resolveConfiguredProvider();
  const unsigned = {
    id: `send-${crypto.randomUUID()}`,
    jobId: job.id,
    jobCreatedAt: job.createdAt,
    workId: job.workId,
    at: now,
    provider,
    routingMode,
    items: itemsSentFor(job),
    call,
  };
  const send = { ...unsigned, signature: sign(unsigned) };
  insertWorkSend(send);
  return send;
}

/** Sends for these pieces of work, each checked. SIDE EFFECT: Reads the runtime database and the signing secret. */
export function listWorkSends(workIds: readonly string[]): { readonly sends: WorkSend[]; readonly unverified: number } {
  const all = loadWorkSends(workIds);
  const sends = all.filter(verifyWorkSend);
  return { sends, unverified: all.length - sends.length };
}

/** One line per send, for the confirm sheet and /work inspect. PURE: No side effects. */
export function describeWorkSends(sends: readonly WorkSend[]): string[] {
  if (!sends.length) return ["Nothing has been sent to an AI worker for this work."];
  return sends.map((send) => {
    const when = formatNzTime(send.at);
    const items = send.items.length ? send.items.map((item) => `${item.name} (${item.ref})`).join(", ") : "the instruction only";
    return `${when}, ${send.jobId} call ${send.call}, to ${send.provider}: ${items}`;
  });
}

/** SIDE EFFECT: Deletes the send log (tests and /reset). */
export function clearWorkSends(): void {
  clearPersistedWorkSends();
}
