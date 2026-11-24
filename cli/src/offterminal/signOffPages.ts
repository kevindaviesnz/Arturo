/**
 * Pages for off-terminal sign-off and set-aside of one result. A passkey
 * is always required. Sign-off goes only through signOffTaskResult, and
 * set-aside only through setAsideTaskResult (off-terminal sign-off brief).
 *
 * SIDE EFFECT: May verify a passkey and record a sign-off or set-aside.
 */

import type { AuthenticationResponseJSON } from "@simplewebauthn/server";

import { formatNzTime } from "../core/nzTime";
import { getJob } from "../runtime/jobQueue";
import { hashResult, readResultSignOffStanding } from "../runtime/resultSignOff";
import { signOffAlongside } from "../runtime/resultPassOn";
import { setAsideTaskResult } from "../task/taskSetAside";
import { signOffTaskResult } from "../task/taskSignOff";
import { matterTypeLabel } from "../work/workRecord";
import { getWork } from "../work/workStore";
import type { ListenerHttpResult } from "./listenerRequest";
import { consumeOffTerminalLink, lookupOffTerminalLink } from "./offTerminalLinks";
import { usablePasskeys } from "./passkeys";
import { requirePublicBaseUrl } from "./publicBaseUrl";
import { escapeHtml } from "./pairPages";
import {
  beginAuthentication,
  completeAuthentication,
  type PasskeyPublic,
} from "./webAuthn";

const CSS = `
body{font:16px/1.45 system-ui,sans-serif;margin:0;padding:16px;max-width:24rem;color:#1a1a1a;background:#fff}
h1{font-size:1.25rem;font-weight:600;margin:0 0 12px}
p,pre{margin:0 0 12px}
pre{white-space:pre-wrap;word-break:break-word;font:inherit}
button,a.btn{display:block;width:100%;padding:12px 16px;border:0;border-radius:8px;background:#1a1a1a;color:#fff;font:inherit;text-align:center;text-decoration:none;box-sizing:border-box;cursor:pointer}
button.secondary,a.secondary{background:#fff;color:#1a1a1a;border:1px solid #1a1a1a;margin-top:10px}
label{display:block;margin:0 0 6px;font-weight:600}
textarea{width:100%;min-height:6rem;margin:0 0 12px;padding:8px;font:inherit;box-sizing:border-box}
.err{margin-top:12px}
`;

type Session = {
  person: string;
  jobId: string;
  enterpriseId: string;
  firstCheckedAt: number;
  challenge?: string;
  challengeExpiresAt?: number;
  openedSources: string[];
};

const sessions = new Map<string, Session>();
const pendingChallenges = new Map<string, { challenge: string; expiresAt: number; purpose: "read" | "act" }>();

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${CSS}</style></head><body>${body}</body></html>`;
}

function htmlResult(status: number, html: string): ListenerHttpResult {
  return {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    body: html,
  };
}

function jsonResult(status: number, body: unknown): ListenerHttpResult {
  return {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
    body: JSON.stringify(body),
  };
}

const ENDED = page("Link ended", "<h1>This link no longer works</h1>");

function noCheckPage(): string {
  return page(
    "Not set up",
    "<h1>This draft can be signed off only at the Arturo computer.</h1>" +
      "<p>Ask the owner to send you a setup link. It takes a minute and uses Face ID, a fingerprint or a PIN. After that there's a 12-hour wait before it can sign anything off.</p>"
  );
}

function workTypeLabel(job: NonNullable<ReturnType<typeof getJob>>): string {
  if (!job.workId) {
    return "a piece of work";
  }
  const standing = getWork(job.workId);
  if (standing.state !== "verified" || !standing.work.matterType) {
    return "a piece of work";
  }
  return matterTypeLabel(standing.work.matterType);
}

function rp(env?: NodeJS.ProcessEnv): { origin: string; rpID: string } | { refused: string } {
  try {
    const origin = requirePublicBaseUrl(env ?? process.env);
    return { origin, rpID: new URL(origin).hostname };
  } catch (error) {
    return { refused: error instanceof Error ? error.message : String(error) };
  }
}

function toPublic(key: { credentialId: string; publicKeyBase64Url: string; counter: number; deviceDescription: string }): PasskeyPublic {
  return {
    credentialId: key.credentialId,
    publicKey: Buffer.from(key.publicKeyBase64Url, "base64url"),
    counter: key.counter,
    deviceDescription: key.deviceDescription,
  };
}

function tokenKey(token: string): string {
  return token;
}

export function formatFailedCheckMessage(): string {
  return "We couldn't check it's you. Nothing was signed off.";
}

function sourceCount(job: NonNullable<ReturnType<typeof getJob>>): number {
  return signOffAlongside(job).length;
}

function draftPage(input: {
  jobId: string;
  workType: string;
  draft: string;
  sourceCount: number;
}): string {
  return page(
    `Task ${input.jobId}`,
    `<h1>Task ${escapeHtml(input.jobId)}</h1>` +
      `<p>${escapeHtml(input.workType)}</p>` +
      `<pre>${escapeHtml(input.draft)}</pre>` +
      (input.sourceCount
        ? `<p>This draft was built from ${input.sourceCount} recorded source${input.sourceCount === 1 ? "" : "s"}.</p>`
        : "") +
      `<p>It does not prove it is correct.</p>` +
      `<button type="button" id="sign">Sign off</button>` +
      `<button type="button" class="secondary" id="aside">Set aside, with a note</button>` +
      `<p>Or close this page. It stays waiting for you.</p>` +
      `<p class="err" id="err"></p>`
  );
}

export async function handleSignOffRoute(input: {
  readonly action: string;
  readonly token: string;
  readonly method: string;
  readonly body: string;
  readonly now?: number;
  readonly env?: NodeJS.ProcessEnv;
}): Promise<ListenerHttpResult> {
  const now = input.now ?? Date.now();
  const link = lookupOffTerminalLink(input.token, { now });
  if ("refused" in link || link.kind !== "sign-off" || !link.jobId) {
    return input.action === "page" || input.action === ""
      ? htmlResult(404, ENDED)
      : jsonResult(404, { refused: "This link no longer works" });
  }

  const job = getJob(link.jobId);
  if (!job || job.output === undefined) {
    return htmlResult(404, ENDED);
  }
  if (link.resultSha256 && link.resultSha256 !== hashResult(job.output)) {
    return htmlResult(404, ENDED);
  }

  const usable = usablePasskeys(link.enterpriseId, link.person, now);
  if (usable.length === 0) {
    if (input.action === "page") {
      return htmlResult(200, noCheckPage());
    }
    return jsonResult(400, { refused: "This draft can be signed off only at the Arturo computer." });
  }

  const workType = workTypeLabel(job);
  const party = rp(input.env);
  if ("refused" in party) {
    return jsonResult(400, party);
  }

  if (input.action === "page") {
    const session = sessions.get(tokenKey(input.token));
    if (session && session.person === link.person) {
      return htmlResult(200, draftPage({ jobId: job.id, workType, draft: job.output, sourceCount: sourceCount(job) }));
    }
    return htmlResult(
      200,
      page(
        `Task ${job.id}`,
        `<h1>Task ${escapeHtml(job.id)}</h1><p>${escapeHtml(workType)}</p>` +
          `<p>Check it's you to read it.</p>` +
          `<button type="button" id="go">Check it's me</button>` +
          `<p class="err" id="err"></p>`
      )
    );
  }

  if (input.action === "options") {
    const purpose = sessions.has(tokenKey(input.token)) ? "act" : "read";
    const options = await beginAuthentication({
      rpID: party.rpID,
      allowCredentialIds: usable.map((key) => key.credentialId),
    });
    pendingChallenges.set(tokenKey(input.token), {
      challenge: options.challenge,
      expiresAt: now + 5 * 60 * 1000,
      purpose,
    });
    return jsonResult(200, { options, purpose });
  }

  if (input.action === "verify") {
    const pending = pendingChallenges.get(tokenKey(input.token));
    if (!pending || pending.expiresAt <= now) {
      return jsonResult(400, { refused: formatFailedCheckMessage() });
    }
    let response: AuthenticationResponseJSON;
    try {
      response = JSON.parse(input.body) as AuthenticationResponseJSON;
    } catch {
      return jsonResult(400, { refused: formatFailedCheckMessage() });
    }
    const credentialId = response.id;
    const stored = usable.find((key) => key.credentialId === credentialId);
    if (!stored) {
      pendingChallenges.delete(tokenKey(input.token));
      return jsonResult(400, { refused: formatFailedCheckMessage() });
    }
    const verified = await completeAuthentication({
      response,
      expectedChallenge: pending.challenge,
      expectedOrigin: party.origin,
      expectedRPID: party.rpID,
      credential: toPublic(stored),
    });
    pendingChallenges.delete(tokenKey(input.token));
    if (!verified.verified) {
      return jsonResult(400, { refused: formatFailedCheckMessage() });
    }
    if (pending.purpose === "read") {
      sessions.set(tokenKey(input.token), {
        person: link.person,
        jobId: job.id,
        enterpriseId: link.enterpriseId,
        firstCheckedAt: now,
        openedSources: [],
      });
      return jsonResult(200, {
        html: draftPage({ jobId: job.id, workType, draft: job.output, sourceCount: sourceCount(job) }),
      });
    }
    return jsonResult(200, { checked: true, assertion: verified.assertion ?? response });
  }

  const session = sessions.get(tokenKey(input.token));
  if (!session) {
    return jsonResult(400, { refused: "Check it's you to read it." });
  }

  let body: { note?: string; assertion?: AuthenticationResponseJSON } = {};
  try {
    body = input.body ? (JSON.parse(input.body) as typeof body) : {};
  } catch {
    return jsonResult(400, { refused: formatFailedCheckMessage() });
  }

  if (input.action === "sign-off" || input.action === "set-aside") {
    const pending = pendingChallenges.get(tokenKey(input.token));
    const assertion = body.assertion;
    if (!assertion || !pending || pending.purpose !== "act" || pending.expiresAt <= now) {
      return jsonResult(400, { refused: formatFailedCheckMessage() });
    }
    const stored = usable.find((key) => key.credentialId === assertion.id);
    if (!stored) {
      return jsonResult(400, { refused: formatFailedCheckMessage() });
    }
    const verified = await completeAuthentication({
      response: assertion,
      expectedChallenge: pending.challenge,
      expectedOrigin: party.origin,
      expectedRPID: party.rpID,
      credential: toPublic(stored),
    });
    pendingChallenges.delete(tokenKey(input.token));
    if (!verified.verified) {
      return jsonResult(400, { refused: formatFailedCheckMessage() });
    }

    if (input.action === "set-aside") {
      const note = (body.note ?? "").trim();
      if (!note) {
        return jsonResult(400, { refused: "A note is required to set this aside." });
      }
      const outcome = setAsideTaskResult([job.id, note, "--as", link.person]);
      if (!outcome.setAside) {
        return jsonResult(400, { refused: outcome.message });
      }
      consumeOffTerminalLink(input.token, now);
      sessions.delete(tokenKey(input.token));
      const started = job.requestedBy ?? "the person who started this task";
      return jsonResult(200, {
        html: page(
          "Set aside",
          `<h1>Set aside</h1><p>This draft was set aside by ${escapeHtml(link.person)} at ${escapeHtml(formatNzTime(now))}.</p>` +
            `<p>Your note goes to ${escapeHtml(started)}, who started this task, and to the owner.</p>` +
            `<p>Nothing is redrafted until someone gives a go-ahead at the Arturo computer.</p>`
        ),
      });
    }

    const outcome = signOffTaskResult([job.id, "--as", link.person]);
    if (!outcome.signedOff) {
      return jsonResult(400, { refused: outcome.message });
    }
    consumeOffTerminalLink(input.token, now);
    sessions.delete(tokenKey(input.token));
    const when = formatNzTime(now);
    return jsonResult(200, {
      html: page(
        "Signed off",
        `<h1>Signed off by ${escapeHtml(link.person)}.</h1>` +
          `<p>Checked it was you on your device, ${escapeHtml(when)}.</p>` +
          `<p>This records that you read it and accept it, not that it is correct.</p>` +
          `<p>What happens next: Nothing is sent to anyone.</p>`
      ),
      terminalLabel: `Signed off by ${link.person}, Passkey checked at sign-off, ${when}. This records that you read it and accept it, not that it is correct.`,
    });
  }

  return htmlResult(404, ENDED);
}

export function setAsideSheetCopy(input: { startedBy: string }): string {
  return [
    "What needs to change?",
    `Your note goes to ${input.startedBy}, who started this task, and to the owner.`,
    "Nothing is redrafted until someone gives a go-ahead at the Arturo computer.",
  ].join("\n");
}

export function signOffSheetCopy(input: { draftLabel: string; sourceCount: number; whatHappensNext: string }): string {
  const sources =
    input.sourceCount === 0
      ? "This records that you read it and accept it, under your name. It does not prove it is correct."
      : `It also records the ${input.sourceCount} things it was built from; it doesn't sign them off. This records that you read it and accept it, under your name. It does not prove it is correct.`;
  return [
    `You're signing off ${input.draftLabel}. ${sources}`,
    `What happens next: ${input.whatHappensNext}`,
    "Nothing is sent to anyone.",
  ].join(" ");
}

export function clearSignOffSessions(): void {
  sessions.clear();
  pendingChallenges.clear();
}
