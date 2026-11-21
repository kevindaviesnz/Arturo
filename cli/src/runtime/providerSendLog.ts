/**
 * The log of every call Arturo makes to an AI provider for a Task, written
 * before the call (C2). Named work keeps its signed send log as well
 * (work/workSendLog.ts); this one covers every Task, so a Task that is run
 * again after a restart is seen to send again.
 *
 * A send belongs to one run of its Task, marked by when that run started. A
 * send in a later run, after a send in an earlier one, is a repeat: it is
 * logged as one and shown in the runtime log. On named work a repeat is not
 * made at all until a person asks for the Task again (M8).
 *
 * SIDE EFFECT: Writes the runtime database and the runtime event log.
 */

import crypto from "node:crypto";

import { generateWithConfiguredLlm, resolveConfiguredProvider } from "../llm/llmClient";
import { clearPersistedProviderSends, insertProviderSend, loadProviderSends } from "../storage/providerSendRepository";
import type { Job } from "./jobQueue";
import { appendRuntimeEventToStore } from "./runtimeEventStore";

/** "web-search": the search words of a web step, sent to the search provider (S4: every query is logged as a send). */
export type ProviderSendPurpose = "task" | "outcome-assessment" | "web-search";

export type ProviderSend = {
  readonly id: string;
  readonly jobId: string;
  /** With the id, names the Task even if an id is used again after /reset. */
  readonly jobCreatedAt: number;
  readonly purpose: ProviderSendPurpose;
  /** Which run of the Task: when that run started. */
  readonly run: number;
  /** Which call of that run, from 1. */
  readonly call: number;
  /** When the send started, stored before the provider is called. */
  readonly at: number;
  readonly provider: string;
  readonly routingMode: "single" | "local-first";
  /** True when an earlier run of the same Task had already sent. */
  readonly repeat: boolean;
  /** For a web search: the exact words sent to the search provider. */
  readonly query?: string;
};

/** The run a send belongs to. PURE: No side effects. */
export function runOf(job: Pick<Job, "startedAt" | "createdAt">, purpose: ProviderSendPurpose, completedAt?: number): number {
  return purpose === "outcome-assessment" ? completedAt ?? job.startedAt ?? job.createdAt : job.startedAt ?? job.createdAt;
}

/** When the first send for a Task started, if one has. SIDE EFFECT: Reads the runtime database. */
export function sendStartedAt(jobId: string, purpose?: ProviderSendPurpose, jobCreatedAt?: number): number | undefined {
  return loadProviderSends(jobId).find((send) => (!purpose || send.purpose === purpose) && (jobCreatedAt === undefined || send.jobCreatedAt === jobCreatedAt))?.at;
}

/** Whether this send would repeat one from an earlier run. SIDE EFFECT: Reads the runtime database. */
export function wouldRepeatSend(job: Pick<Job, "id" | "createdAt">, purpose: ProviderSendPurpose, run: number): boolean {
  return loadProviderSends(job.id).some((send) => send.jobCreatedAt === job.createdAt && send.purpose === purpose && send.run !== run);
}

export function repeatOnNamedWorkRefusal(jobId: string): string {
  return `${jobId} had already been sent to an AI provider before Arturo stopped, and it belongs to a named piece of work, so it is not sent again until a person asks for it again.`;
}

/**
 * Stores one send before the provider is called. Throws when the entry cannot
 * be written, so nothing is sent unlogged.
 *
 * SIDE EFFECT: Writes one row, and a runtime event for a repeat.
 */
export function recordProviderSend(
  job: Pick<Job, "id" | "startedAt" | "createdAt" | "completedAt">,
  purpose: ProviderSendPurpose,
  call: number,
  now = Date.now()
): ProviderSend {
  const run = runOf(job, purpose, job.completedAt);
  const repeat = wouldRepeatSend(job, purpose, run);
  const { provider, routingMode } = resolveConfiguredProvider();
  const send: ProviderSend = { id: `psend-${crypto.randomUUID()}`, jobId: job.id, jobCreatedAt: job.createdAt, purpose, run, call, at: now, provider, routingMode, repeat };
  insertProviderSend(send);
  if (repeat && call === 1) {
    appendRuntimeEventToStore({
      id: crypto.randomUUID(),
      type: "runtime.send.repeated",
      level: "warn",
      message: `Task ${job.id} is being sent to ${provider} again: it had already been sent before Arturo stopped, so the provider has seen it twice.`,
      timestamp: now,
      payload: { jobId: job.id, purpose, provider, firstSentAt: sendStartedAt(job.id, purpose, job.createdAt) },
    });
  }
  return send;
}

/**
 * Stores one web search before its words are sent to the search provider
 * (S4). Throws when the entry cannot be written, so nothing is searched
 * unlogged.
 *
 * SIDE EFFECT: Writes one row, and a runtime event for a repeat.
 */
export function recordSearchSend(
  job: Pick<Job, "id" | "startedAt" | "createdAt" | "completedAt">,
  searchProvider: string,
  query: string,
  now = Date.now()
): ProviderSend {
  const run = runOf(job, "web-search");
  const repeat = wouldRepeatSend(job, "web-search", run);
  const send: ProviderSend = { id: `psend-${crypto.randomUUID()}`, jobId: job.id, jobCreatedAt: job.createdAt, purpose: "web-search", run, call: 1, at: now, provider: searchProvider, routingMode: "single", repeat, query };
  insertProviderSend(send);
  if (repeat) {
    appendRuntimeEventToStore({
      id: crypto.randomUUID(),
      type: "runtime.send.repeated",
      level: "warn",
      message: `Task ${job.id} is searching ${searchProvider} again: it had already searched before Arturo stopped, so the search provider has seen these words twice.`,
      timestamp: now,
      payload: { jobId: job.id, purpose: "web-search", provider: searchProvider, firstSentAt: sendStartedAt(job.id, "web-search", job.createdAt) },
    });
  }
  return send;
}

/**
 * The logged provider caller: stores the send, then calls the configured model.
 *
 * SIDE EFFECT: Writes the send log and calls a model.
 */
export function createLoggedProviderCaller(
  job: Pick<Job, "id" | "startedAt" | "createdAt" | "completedAt">,
  purpose: ProviderSendPurpose
): (request: Parameters<typeof generateWithConfiguredLlm>[0]) => ReturnType<typeof generateWithConfiguredLlm> {
  let calls = 0;
  return async (request) => {
    calls += 1;
    recordProviderSend(job, purpose, calls);
    return generateWithConfiguredLlm(request);
  };
}

/** Sends for one Task. SIDE EFFECT: Reads the runtime database. */
export function listProviderSends(jobId: string): ProviderSend[] {
  return loadProviderSends(jobId);
}

/** SIDE EFFECT: Deletes the provider send log (tests and /reset). */
export function clearProviderSends(): void {
  clearPersistedProviderSends();
}
