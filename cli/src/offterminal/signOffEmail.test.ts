import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearSignIn, setSignOffRight } from "../identity/companySignIn";
import { ENROLMENT_CONFIRM_WAIT_HOURS, SWITCH_ON_COOLING_OFF_HOURS } from "../runtime/chainLimits";
import { clearJobs, enqueueJob, replaceJob } from "../runtime/jobQueue";
import { hashResult } from "../runtime/resultSignOff";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";
import { addEnterprisePerson } from "../testing/cliTestSetup";
import { setClaimOnceSenderForTests } from "./claimOnceEmail";
import { requestOffTerminalPathOn } from "./offTerminalPath";
import { clearOffTerminalPath } from "./offTerminalPathState";
import { clearOffTerminalLinks, lookupOffTerminalLink } from "./offTerminalLinks";
import {
  cancelPasskeyEnrolment,
  clearPasskeys,
  completeEnrolment,
  confirmPasskeyEnrolment,
  enrolmentOptions,
  startPasskeyEnrolment,
} from "./passkeys";
import {
  eligibleSignOffRecipients,
  formatSignOffEmail,
  resendOffTerminalSignOffLink,
  sendOffTerminalSignOffLinks,
} from "./signOffEmail";
import { clearVerifiedEmails, confirmEmailVerification, startEmailVerification } from "./verifiedEmail";
import { setWebAuthnVerifiersForTests } from "./webAuthn";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

const ENV = { PUBLIC_BASE_URL: "https://signoff.example.com" };
const NOW = 1_700_000_000_000;
const PATH_WAIT = SWITCH_ON_COOLING_OFF_HOURS * 60 * 60 * 1000;
const CONFIRM_WAIT = ENROLMENT_CONFIRM_WAIT_HOURS * 60 * 60 * 1000;
const FUNCTION_ID = "fn-email-signoff";

const reset = () => {
  setClaimOnceSenderForTests(undefined);
  setWebAuthnVerifiersForTests(undefined);
  clearPasskeys();
  clearVerifiedEmails();
  clearOffTerminalLinks();
  clearOffTerminalPath();
  clearJobs();
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

describe("sign-off email", () => {
  it("names only the business, the Task, the work type and who it is waiting for, and never carries the draft", () => {
    const mail = formatSignOffEmail({
      business: "Harbour Legal",
      person: "Priya Nair",
      taskId: "2026-033",
      workType: "Letter or email draft",
      url: "https://signoff.example.com/sign-off/abc",
      expiresAt: NOW,
      hostname: "signoff.example.com",
    });
    expect(mail.subject).toBe("Harbour Legal: draft 2026-033 is waiting for your sign-off");
    expect(mail.text).toContain("Open the draft:");
    expect(mail.text).toContain("https://signoff.example.com/sign-off/abc");
    expect(mail.text).toContain("Opening it doesn't sign anything off.");
    expect(mail.text).toContain("Arturo never asks for your password");
    expect(mail.text).not.toMatch(/passkey|approve|phone|desk|the lease is one-sided|client/i);
  });
});

describe("sending a sign-off link", () => {
  let enterpriseId: string;
  const mails: Array<{ to: string; subject: string; text: string }> = [];

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
    });
  });
  afterEach(reset);

  const finished = () =>
    replaceJob({
      ...enqueueJob("Review the lease.", undefined, { businessFunctionId: FUNCTION_ID, enterpriseId }),
      status: "completed",
      output: "The lease is one-sided.",
    });

  it("does not send a link when the person has no device check", async () => {
    const job = finished();
    expect(eligibleSignOffRecipients(job, NOW + CONFIRM_WAIT)).toEqual([]);
    const result = await sendOffTerminalSignOffLinks(job, { now: NOW + CONFIRM_WAIT, env: ENV });
    expect(result).toEqual({ sent: 0, skipped: [] });
    expect(mails.some((mail) => mail.text.includes("/sign-off/"))).toBe(false);
  });

  it("sends a single-use link only to an eligible person, and can resend from the terminal", async () => {
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
    mails.length = 0;
    const result = await sendOffTerminalSignOffLinks(job, { now: NOW + CONFIRM_WAIT, env: ENV });
    expect(result.sent).toBe(1);
    const mail = mails.find((one) => one.to === "priya@example.com");
    expect(mail?.subject).toContain("Harbour Legal");
    expect(mail?.subject).toContain(job.id);
    expect(mail?.text).toContain("Open the draft:");
    expect(mail?.text).toContain("/sign-off/");
    expect(mail?.text).not.toContain("The lease is one-sided.");
    const url = mail?.text.match(/https:\/\/signoff\.example\.com\/sign-off\/[^\s]+/)?.[0];
    expect(url).toBeTruthy();
    const token = url?.split("/sign-off/")[1] ?? "";
    expect(lookupOffTerminalLink(token, { now: NOW + CONFIRM_WAIT, resultSha256: hashResult("The lease is one-sided.") })).toMatchObject({
      person: "Priya Nair",
      jobId: job.id,
    });

    const resent = await resendOffTerminalSignOffLink({
      job,
      person: "Priya Nair",
      now: NOW + CONFIRM_WAIT,
      env: ENV,
    });
    expect(resent).toEqual({ message: "A new sign-off link was sent to Priya Nair." });
  });
});
