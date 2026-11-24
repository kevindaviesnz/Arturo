/**
 * Claim-once email of a single-use sign-off link. Never uses sendEmail,
 * never carries the draft, and is not sent if the person has no device
 * check or no verified address (off-terminal sign-off brief).
 *
 * SIDE EFFECT: May issue a link and send mail.
 */

import { formatNzTime } from "../core/nzTime";
import { getEnterprise } from "../enterprise/enterpriseStore";
import { listPeople, maySignOff } from "../identity/companySignIn";
import type { Job } from "../runtime/jobQueue";
import { hashResult, readResultSignOffStanding } from "../runtime/resultSignOff";
import { readResultSetAsideStanding } from "../runtime/resultSetAside";
import { designatedApproversForFunction, mayDecideForFunction } from "../staffing/functionApprovers";
import { matterTypeLabel } from "../work/workRecord";
import { getWork } from "../work/workStore";
import { sendClaimOnceMail } from "./claimOnceEmail";
import {
  consumeOffTerminalLink,
  issueOffTerminalLink,
  type IssuedOffTerminalLink,
} from "./offTerminalLinks";
import { isOffTerminalPathOn } from "./offTerminalPathState";
import { usablePasskeys } from "./passkeys";
import { requirePublicBaseUrl } from "./publicBaseUrl";
import { getVerifiedEmail } from "./verifiedEmail";

export type SignOffEmailResult = {
  readonly sent: number;
  readonly skipped: readonly string[];
};

function workTypeLabel(job: Job): string {
  if (!job.workId) {
    return "a piece of work";
  }
  const standing = getWork(job.workId);
  if (standing.state !== "verified" || !standing.work.matterType) {
    return "a piece of work";
  }
  return matterTypeLabel(standing.work.matterType);
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function formatSignOffEmail(input: {
  readonly business: string;
  readonly person: string;
  readonly taskId: string;
  readonly workType: string;
  readonly url: string;
  readonly expiresAt: number;
  readonly hostname: string;
}): { readonly subject: string; readonly text: string } {
  const subject = `${input.business}: draft ${input.taskId} is waiting for your sign-off`;
  const text = [
    `Hi ${firstName(input.person)},`,
    "",
    "A draft is waiting for your sign-off in Arturo.",
    "",
    "Task",
    `${input.taskId} · ${input.workType}`,
    "",
    "Open the draft:",
    input.url,
    "",
    "Opening it doesn't sign anything off. You read the draft first, then your device checks it's you before you decide.",
    "",
    `This link is only for you. It works until ${formatNzTime(input.expiresAt)}. It opens ${input.hostname}.`,
    "",
    `Arturo never asks for your password, by email or on the page. If anything asks, close it and tell the person who runs Arturo for ${input.business}.`,
    "",
    `Not expecting this? Don't open it. Tell the person who runs Arturo for ${input.business}.`,
  ].join("\n");
  return { subject, text };
}

export function eligibleSignOffRecipients(job: Job, now = Date.now()): string[] {
  if (!job.enterpriseId) {
    return [];
  }
  const designated = designatedApproversForFunction(job.businessFunctionId);
  const candidates =
    designated.length > 0
      ? [...designated]
      : listPeople(job.enterpriseId)
          .filter((person) => person.status !== "suspended")
          .map((person) => person.name);
  const seen = new Set<string>();
  const eligible: string[] = [];
  for (const name of candidates) {
    const key = name.trim().toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    if (!mayDecideForFunction(designated, name)) {
      continue;
    }
    if (!maySignOff(job.enterpriseId, name)) {
      continue;
    }
    if (!getVerifiedEmail(job.enterpriseId, name)) {
      continue;
    }
    if (usablePasskeys(job.enterpriseId, name, now).length === 0) {
      continue;
    }
    eligible.push(name);
  }
  return eligible;
}

async function sendOne(
  job: Job,
  person: string,
  now: number,
  env: NodeJS.ProcessEnv
): Promise<{ readonly sent: true; readonly issued: IssuedOffTerminalLink } | { readonly skipped: string }> {
  if (!job.enterpriseId || job.output === undefined) {
    return { skipped: person };
  }
  const email = getVerifiedEmail(job.enterpriseId, person);
  if (!email || usablePasskeys(job.enterpriseId, person, now).length === 0) {
    return { skipped: person };
  }
  const issued = issueOffTerminalLink({
    kind: "sign-off",
    enterpriseId: job.enterpriseId,
    person,
    jobId: job.id,
    resultSha256: hashResult(job.output),
    now,
    env,
  });
  if ("refused" in issued) {
    return { skipped: person };
  }
  const business = getEnterprise(job.enterpriseId)?.name ?? "the business";
  let hostname = "the sign-off page";
  try {
    hostname = new URL(requirePublicBaseUrl(env)).hostname;
  } catch {
    hostname = "the sign-off page";
  }
  const mail = formatSignOffEmail({
    business,
    person,
    taskId: job.id,
    workType: workTypeLabel(job),
    url: issued.url,
    expiresAt: issued.link.expiresAt,
    hostname,
  });
  const outcome = await sendClaimOnceMail({ to: email, subject: mail.subject, text: mail.text });
  if (outcome !== "accepted") {
    consumeOffTerminalLink(issued.token, now);
    return { skipped: person };
  }
  return { sent: true, issued };
}

/**
 * Sends a sign-off link to each eligible person when a result starts
 * waiting, if this path is on.
 */
export async function sendOffTerminalSignOffLinks(
  job: Job,
  options: { readonly now?: number; readonly env?: NodeJS.ProcessEnv } = {}
): Promise<SignOffEmailResult> {
  const now = options.now ?? Date.now();
  const env = options.env ?? process.env;
  if (!job.enterpriseId || !isOffTerminalPathOn(job.enterpriseId, now) || job.status !== "completed" || job.output === undefined) {
    return { sent: 0, skipped: [] };
  }
  if (readResultSignOffStanding(job).state === "signed") {
    return { sent: 0, skipped: [] };
  }
  if (readResultSetAsideStanding(job).state === "set_aside") {
    return { sent: 0, skipped: [] };
  }
  const skipped: string[] = [];
  let sent = 0;
  for (const person of eligibleSignOffRecipients(job, now)) {
    const result = await sendOne(job, person, now, env);
    if ("sent" in result) {
      sent += 1;
    } else {
      skipped.push(result.skipped);
    }
  }
  return { sent, skipped };
}

/** Resends a sign-off link to one person from the terminal. */
export async function resendOffTerminalSignOffLink(input: {
  readonly job: Job;
  readonly person: string;
  readonly now?: number;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<{ readonly message: string } | { readonly refused: string }> {
  const job = input.job;
  const now = input.now ?? Date.now();
  if (!job.enterpriseId || !isOffTerminalPathOn(job.enterpriseId, now)) {
    return { refused: "Off-terminal sign-off is not on at this business, so no link was sent." };
  }
  if (!eligibleSignOffRecipients(job, now).some((name) => name.toLowerCase() === input.person.trim().toLowerCase())) {
    return { refused: `No sign-off link was sent to ${input.person}. They may not have a verified email or a device check, or they may not be able to sign this off.` };
  }
  const result = await sendOne(job, input.person, now, input.env ?? process.env);
  if ("skipped" in result) {
    return { refused: `The sign-off link for ${input.person} could not be sent.` };
  }
  return { message: `A new sign-off link was sent to ${input.person}.` };
}

/** Called when a Task result is first written or changes, so waiting people can be emailed. */
export function notifyOffTerminalResultReady(job: Job): void {
  void sendOffTerminalSignOffLinks(job).catch(() => undefined);
}
