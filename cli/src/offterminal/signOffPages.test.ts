import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearSignIn, setSignOffRight } from "../identity/companySignIn";
import { ENROLMENT_CONFIRM_WAIT_HOURS, SWITCH_ON_COOLING_OFF_HOURS } from "../runtime/chainLimits";
import { clearJobs, enqueueJob, replaceJob } from "../runtime/jobQueue";
import { hashResult, readResultSignOffStanding, clearResultSignOffs } from "../runtime/resultSignOff";
import { clearResultSetAsides, readResultSetAsideStanding } from "../runtime/resultSetAside";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { addEnterprisePerson } from "../testing/cliTestSetup";
import { setClaimOnceSenderForTests } from "./claimOnceEmail";
import { requestOffTerminalPathOn } from "./offTerminalPath";
import { clearOffTerminalPath } from "./offTerminalPathState";
import { clearOffTerminalLinks, issueOffTerminalLink } from "./offTerminalLinks";
import {
  clearPasskeys,
  completeEnrolment,
  confirmPasskeyEnrolment,
  enrolmentOptions,
  startPasskeyEnrolment,
} from "./passkeys";
import {
  clearSignOffSessions,
  formatFailedCheckMessage,
  handleSignOffRoute,
  setAsideSheetCopy,
  signOffSheetCopy,
} from "./signOffPages";
import { clearVerifiedEmails, confirmEmailVerification, startEmailVerification } from "./verifiedEmail";
import { setWebAuthnVerifiersForTests } from "./webAuthn";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";

const ENV = { PUBLIC_BASE_URL: "https://signoff.example.com" };
const NOW = 1_700_000_000_000;
const PATH_WAIT = SWITCH_ON_COOLING_OFF_HOURS * 60 * 60 * 1000;
const CONFIRM_WAIT = ENROLMENT_CONFIRM_WAIT_HOURS * 60 * 60 * 1000;
const FUNCTION_ID = "fn-signoff-pages";
const DRAFT = 'The lease is one-sided. <script>alert(1)</script> https://evil.example';

const reset = () => {
  setClaimOnceSenderForTests(undefined);
  setWebAuthnVerifiersForTests(undefined);
  clearSignOffSessions();
  clearPasskeys();
  clearVerifiedEmails();
  clearOffTerminalLinks();
  clearOffTerminalPath();
  clearJobs();
  clearResultSignOffs();
  clearResultSetAsides();
  clearStaffingAssignments();
  clearWorkers();
  clearSignIn();
  clearEnterprises();
};

function codeFrom(text: string | undefined): string {
  const match = text?.match(/code is ([A-F0-9]+)/i);
  if (!match?.[1]) {
    throw new Error(`no code in: ${text}`);
  }
  return match[1];
}

describe("sign-off and set-aside page copy", () => {
  it("follows Mia's wording and never says passkey, approve, phone or desk", () => {
    const sign = signOffSheetCopy({
      draftLabel: "this draft and its version",
      sourceCount: 2,
      whatHappensNext: "Nothing is sent to anyone.",
    });
    expect(sign).toContain("You're signing off this draft and its version.");
    expect(sign).toContain("It also records the 2 things it was built from; it doesn't sign them off.");
    expect(sign).toContain("It does not prove it is correct.");
    expect(sign).not.toMatch(/passkey|approve|phone|desk/i);
    const aside = setAsideSheetCopy({ startedBy: "Kevin Brown" });
    expect(aside).toContain("What needs to change?");
    expect(aside).toContain("Your note goes to Kevin Brown, who started this task, and to the owner.");
    expect(aside).toContain("Nothing is redrafted until someone gives a go-ahead at the Arturo computer.");
    expect(formatFailedCheckMessage()).toBe("We couldn't check it's you. Nothing was signed off.");
  });
});

describe("off-terminal sign-off and set-aside pages", () => {
  let enterpriseId: string;
  const mails: Array<{ to: string; text: string }> = [];

  beforeEach(async () => {
    reset();
    mails.length = 0;
    setClaimOnceSenderForTests(async (mail) => {
      mails.push(mail);
      return "accepted";
    });
    expect(
      setUpBusiness(["Harbour Legal", "--owner", "Kevin Brown", "--about", "Commercial contracts."])
        .created
    ).toBe(true);
    enterpriseId = listEnterprises()[0]?.id ?? "";
    addEnterprisePerson({ enterpriseId, name: "Priya Nair", role: "approver" });
    const granted = setSignOffRight({
      enterpriseId,
      person: "Priya Nair",
      canSignOff: true,
      actor: undefined,
    });
    if ("refused" in granted) {
      throw new Error(granted.refused);
    }
    saveStaffingAssignment({
      businessFunctionId: FUNCTION_ID,
      workerName: "Priya Nair",
      role: "human-approver",
      rationale: "Principal.",
    });
    for (const [person, email] of [
      ["Kevin Brown", "kevin@example.com"],
      ["Priya Nair", "priya@example.com"],
    ] as const) {
      await startEmailVerification({ enterpriseId, person, email, actor: undefined, now: NOW });
      confirmEmailVerification({
        enterpriseId,
        person,
        code: codeFrom(mails.filter((mail) => mail.to === email).at(-1)?.text),
        now: NOW,
      });
    }
    const path = await requestOffTerminalPathOn({
      enterpriseId,
      reason: "Staff need to sign off when they are not at the computer.",
      notifyTo: "kevin@example.com",
      actor: undefined,
      now: NOW - PATH_WAIT,
    });
    if ("refused" in path) {
      throw new Error(path.refused);
    }
    setWebAuthnVerifiersForTests({
      registration: async () => ({
        verified: true,
        credential: {
          credentialId: "cred-priya-1",
          publicKey: new Uint8Array([1, 2, 3, 4, 5]),
          counter: 0,
          deviceDescription: "Priya's device",
        },
      }),
      authentication: async () => ({ verified: true, newCounter: 1 }),
    });
  });
  afterEach(reset);

  function finished() {
    return replaceJob({
      ...enqueueJob("Review the lease.", undefined, { businessFunctionId: FUNCTION_ID, enterpriseId, requestedBy: "Kevin Brown" }),
      status: "completed",
      output: DRAFT,
    });
  }

  async function issueLink(job: { id: string; output?: string }, now = NOW + CONFIRM_WAIT) {
    const issued = issueOffTerminalLink({
      kind: "sign-off",
      enterpriseId,
      person: "Priya Nair",
      jobId: job.id,
      resultSha256: hashResult(job.output ?? ""),
      now,
      env: ENV,
    });
    if ("refused" in issued) {
      throw new Error(issued.refused);
    }
    return issued;
  }

  it("shows the ended page or the no-device-check page, and does not show the draft", async () => {
    const ended = await handleSignOffRoute({
      action: "page",
      token: "not-a-real-token-xxxxx",
      method: "GET",
      body: "",
      now: NOW,
      env: ENV,
    });
    expect(ended.body).toContain("This link no longer works");
    expect(ended.body).not.toMatch(/Priya|lease|passkey|approve|phone|desk/i);

    const job = finished();
    const issued = await issueLink(job);
    const noCheck = await handleSignOffRoute({
      action: "page",
      token: issued.token,
      method: "GET",
      body: "",
      now: NOW + CONFIRM_WAIT,
      env: ENV,
    });
    expect(noCheck.body).toContain("This draft can be signed off only at the Arturo computer.");
    expect(noCheck.body).toContain("setup link");
    expect(noCheck.body).toContain("12-hour wait");
    expect(noCheck.body).not.toContain(DRAFT);
    expect(noCheck.body).not.toMatch(/passkey|approve|phone|desk/i);
  });

  it("shows the escaped draft only after a device check, signs off through signOffTaskResult, and requires a note to set aside", async () => {
    const started = await startPasskeyEnrolment({
      enterpriseId,
      person: "Priya Nair",
      reason: "Priya needs to sign off when she is not at the computer.",
      actor: undefined,
      now: NOW,
      env: ENV,
    });
    if ("refused" in started) {
      throw new Error(started.refused);
    }
    await enrolmentOptions({ token: started.token, now: NOW, env: ENV });
    await completeEnrolment({
      token: started.token,
      response: { id: "x" } as RegistrationResponseJSON,
      now: NOW,
      env: ENV,
    });
    confirmPasskeyEnrolment({
      enterpriseId,
      person: "Priya Nair",
      confirmation: "I spoke to Priya Nair and they set this up.",
      actor: undefined,
      now: NOW + CONFIRM_WAIT,
    });

    const job = finished();
    const issued = await issueLink(job);
    const open = await handleSignOffRoute({
      action: "page",
      token: issued.token,
      method: "GET",
      body: "",
      now: NOW + CONFIRM_WAIT,
      env: ENV,
    });
    expect(open.body).toContain("Check it's you to read it.");
    expect(open.body).toContain("Check it's me");
    expect(open.body).not.toContain("The lease is one-sided.");

    await handleSignOffRoute({
      action: "options",
      token: issued.token,
      method: "POST",
      body: "{}",
      now: NOW + CONFIRM_WAIT,
      env: ENV,
    });
    const verified = await handleSignOffRoute({
      action: "verify",
      token: issued.token,
      method: "POST",
      body: JSON.stringify({ id: "cred-priya-1" } satisfies Partial<AuthenticationResponseJSON>),
      now: NOW + CONFIRM_WAIT,
      env: ENV,
    });
    const payload = JSON.parse(verified.body) as { html?: string };
    expect(payload.html).toContain("The lease is one-sided.");
    expect(payload.html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(payload.html).not.toContain("<script>alert(1)</script>");
    expect(payload.html).toContain("Sign off");
    expect(payload.html).toContain("Set aside, with a note");
    expect(payload.html).toContain("It does not prove it is correct.");

    const missingNote = await handleSignOffRoute({
      action: "set-aside",
      token: issued.token,
      method: "POST",
      body: JSON.stringify({ assertion: { id: "cred-priya-1" } }),
      now: NOW + CONFIRM_WAIT,
      env: ENV,
    });
    expect(JSON.parse(missingNote.body)).toMatchObject({
      refused: formatFailedCheckMessage(),
    });

    await handleSignOffRoute({
      action: "options",
      token: issued.token,
      method: "POST",
      body: "{}",
      now: NOW + CONFIRM_WAIT,
      env: ENV,
    });
    const signed = await handleSignOffRoute({
      action: "sign-off",
      token: issued.token,
      method: "POST",
      body: JSON.stringify({ assertion: { id: "cred-priya-1" } }),
      now: NOW + CONFIRM_WAIT,
      env: ENV,
    });
    const signedPage = JSON.parse(signed.body) as { html?: string; terminalLabel?: string };
    expect(signedPage.html).toContain("Signed off by Priya Nair.");
    expect(signedPage.html).toContain("Checked it was you on your device");
    expect(signedPage.html).not.toMatch(/passkey|approve|phone|desk/i);
    expect(signedPage.terminalLabel).toContain("Passkey checked at sign-off");
    expect(readResultSignOffStanding(job).state).toBe("signed");

    const other = finished();
    const otherLink = await issueLink(other, NOW + CONFIRM_WAIT + 1);
    await handleSignOffRoute({
      action: "options",
      token: otherLink.token,
      method: "POST",
      body: "{}",
      now: NOW + CONFIRM_WAIT + 1,
      env: ENV,
    });
    await handleSignOffRoute({
      action: "verify",
      token: otherLink.token,
      method: "POST",
      body: JSON.stringify({ id: "cred-priya-1" }),
      now: NOW + CONFIRM_WAIT + 1,
      env: ENV,
    });
    await handleSignOffRoute({
      action: "options",
      token: otherLink.token,
      method: "POST",
      body: "{}",
      now: NOW + CONFIRM_WAIT + 1,
      env: ENV,
    });
    const setAside = await handleSignOffRoute({
      action: "set-aside",
      token: otherLink.token,
      method: "POST",
      body: JSON.stringify({ assertion: { id: "cred-priya-1" }, note: "The facts are incomplete." }),
      now: NOW + CONFIRM_WAIT + 1,
      env: ENV,
    });
    const asidePage = JSON.parse(setAside.body) as { html?: string };
    expect(asidePage.html).toContain("Nothing is redrafted until someone gives a go-ahead at the Arturo computer.");
    expect(readResultSetAsideStanding(other).state).toBe("set_aside");
    expect(readResultSignOffStanding(other).state).toBe("none");
  });
});
