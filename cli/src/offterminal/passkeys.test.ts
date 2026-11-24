import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { clearWorkers } from "../control/workers";
import { formatNzTime } from "../core/nzTime";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearSignIn, listAuthorityChanges, setSignOffRight } from "../identity/companySignIn";
import { ENROLMENT_CONFIRM_WAIT_HOURS, SWITCH_ON_COOLING_OFF_HOURS } from "../runtime/chainLimits";
import { addEnterprisePerson } from "../testing/cliTestSetup";
import { setClaimOnceSenderForTests } from "./claimOnceEmail";
import { requestOffTerminalPathOn } from "./offTerminalPath";
import { clearOffTerminalPath } from "./offTerminalPathState";
import { clearOffTerminalLinks, issueOffTerminalLink, lookupOffTerminalLink, LINK_ENDED_MESSAGE } from "./offTerminalLinks";
import {
  cancelPasskeyEnrolment,
  clearPasskeys,
  completeEnrolment,
  confirmPasskeyEnrolment,
  enrolmentOptions,
  formatConfirmPasskeyPrompt,
  listPasskeys,
  markExistingKeyCheckedForTests,
  passkeyMatchesAuthorityLog,
  removePasskey,
  startPasskeyEnrolment,
  usablePasskeys,
} from "./passkeys";
import { confirmEmailVerification, clearVerifiedEmails, startEmailVerification } from "./verifiedEmail";
import { setWebAuthnVerifiersForTests } from "./webAuthn";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

const ENV = { PUBLIC_BASE_URL: "https://signoff.example.com" };
const NOW = 1_700_000_000_000;
const PATH_WAIT = SWITCH_ON_COOLING_OFF_HOURS * 60 * 60 * 1000;
const CONFIRM_WAIT = ENROLMENT_CONFIRM_WAIT_HOURS * 60 * 60 * 1000;

const reset = () => {
  setClaimOnceSenderForTests(undefined);
  setWebAuthnVerifiersForTests(undefined);
  clearPasskeys();
  clearVerifiedEmails();
  clearOffTerminalLinks();
  clearOffTerminalPath();
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

describe("passkey enrolment", () => {
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
    for (const [person, email] of [
      ["Kevin Brown", "kevin@example.com"],
      ["Priya Nair", "priya@example.com"],
    ] as const) {
      await startEmailVerification({
        enterpriseId,
        person,
        email,
        actor: undefined,
        now: NOW,
      });
      const started = mails.filter((mail) => mail.to === email).at(-1);
      confirmEmailVerification({
        enterpriseId,
        person,
        code: codeFrom(started?.text),
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

  async function start(now = NOW) {
    const started = await startPasskeyEnrolment({
      enterpriseId,
      person: "Priya Nair",
      reason: "Priya needs to sign off when she is not at the computer.",
      actor: undefined,
      now,
      env: ENV,
    });
    if ("refused" in started) {
      throw new Error(started.refused);
    }
    return started;
  }

  it("will not start without a typed reason, an account, or a verified email", async () => {
    expect(
      await startPasskeyEnrolment({
        enterpriseId,
        person: "Priya Nair",
        reason: "yes",
        actor: undefined,
        now: NOW,
        env: ENV,
      })
    ).toMatchObject({ refused: expect.stringContaining("not only yes") });
  });

  it("issues a 30-minute setup link, emails it without a draft, and names no password", async () => {
    const started = await start();
    expect(started.url).toContain("/pair/");
    expect(started.offer).toContain(started.url);
    expect(started.offer).toContain("own device");
    const mail = mails.filter((one) => one.to === "priya@example.com").at(-1);
    expect(mail?.text).toContain(started.url);
    expect(mail?.text).not.toMatch(/passkey|password request|draft|client/i);
    expect(mail?.text).toContain("Arturo never asks for your password");
  });

  it("saves no credential when a check fails, then waits 12 hours and needs a typed owner confirmation", async () => {
    const started = await start();
    setWebAuthnVerifiersForTests({
      registration: async () => ({ verified: false }),
    });
    await enrolmentOptions({ token: started.token, now: NOW, env: ENV });
    expect(
      await completeEnrolment({
        token: started.token,
        response: { id: "x" } as RegistrationResponseJSON,
        now: NOW,
        env: ENV,
      })
    ).toEqual({ refused: "We couldn't check it's you. Nothing was saved." });
    expect(listPasskeys(enterpriseId, "Priya Nair")).toEqual([]);

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
    await enrolmentOptions({ token: started.token, now: NOW, env: ENV });
    const enrolled = await completeEnrolment({
      token: started.token,
      response: { id: "x" } as RegistrationResponseJSON,
      now: NOW,
      env: ENV,
    });
    if ("refused" in enrolled) {
      throw new Error(enrolled.refused);
    }
    expect(usablePasskeys(enterpriseId, "Priya Nair", NOW + CONFIRM_WAIT)).toEqual([]);
    expect(mails.at(-1)?.text).toContain(`${"Priya Nair"} can sign off from ${formatNzTime(NOW + CONFIRM_WAIT)}`);
    expect(mails.at(-1)?.text).toContain("Cancel");

    expect(
      confirmPasskeyEnrolment({
        enterpriseId,
        person: "Priya Nair",
        confirmation: "I spoke to Priya Nair and they set this up.",
        actor: undefined,
        now: NOW + 1,
      })
    ).toMatchObject({ refused: expect.stringContaining("can be confirmed after") });

    expect(
      confirmPasskeyEnrolment({
        enterpriseId,
        person: "Priya Nair",
        confirmation: "yes",
        actor: undefined,
        now: NOW + CONFIRM_WAIT,
      })
    ).toEqual({ refused: "Type a confirmation that names the person, not only yes." });

    const key = listPasskeys(enterpriseId, "Priya Nair")[0];
    if (!key) {
      throw new Error("expected a waiting key");
    }
    expect(formatConfirmPasskeyPrompt(key)).toContain("Confirm only if Priya Nair told you themselves that they set this up");
    expect(formatConfirmPasskeyPrompt(key)).toContain("Priya's device");
    expect(formatConfirmPasskeyPrompt(key)).toContain(formatNzTime(NOW));

    const confirmed = confirmPasskeyEnrolment({
      enterpriseId,
      person: "Priya Nair",
      confirmation: "I spoke to Priya Nair and they set this up.",
      actor: undefined,
      now: NOW + CONFIRM_WAIT,
    });
    expect(confirmed).toMatchObject({
      message: expect.stringContaining("A passkey was added for Priya Nair"),
    });
    const usable = usablePasskeys(enterpriseId, "Priya Nair", NOW + CONFIRM_WAIT);
    expect(usable).toHaveLength(1);
    expect(usable[0]?.publicKeyHash).toHaveLength(64);
    expect(passkeyMatchesAuthorityLog(usable[0]!)).toBe(true);
    expect(
      listAuthorityChanges(enterpriseId).some((entry) =>
        entry.what.includes(usable[0]!.publicKeyHash) && entry.what.includes("confirmed device check")
      )
    ).toBe(true);
  });

  it("lets the owner cancel during the wait, so nothing is kept, and removing a key kills issued links", async () => {
    const started = await start();
    await enrolmentOptions({ token: started.token, now: NOW, env: ENV });
    const enrolled = await completeEnrolment({
      token: started.token,
      response: { id: "x" } as RegistrationResponseJSON,
      now: NOW,
      env: ENV,
    });
    if ("refused" in enrolled) {
      throw new Error(enrolled.refused);
    }
    const cancelled = cancelPasskeyEnrolment({
      enterpriseId,
      person: "Priya Nair",
      actor: undefined,
      now: NOW + 1,
    });
    expect(cancelled).toEqual({
      message: "The device-check setup for Priya Nair was cancelled. Nothing was kept.",
    });
    expect(listPasskeys(enterpriseId, "Priya Nair")).toEqual([]);

    const second = await start(NOW + 2);
    await enrolmentOptions({ token: second.token, now: NOW + 2, env: ENV });
    await completeEnrolment({
      token: second.token,
      response: { id: "x" } as RegistrationResponseJSON,
      now: NOW + 2,
      env: ENV,
    });
    confirmPasskeyEnrolment({
      enterpriseId,
      person: "Priya Nair",
      confirmation: "I spoke to Priya Nair and they set this up.",
      actor: undefined,
      now: NOW + 2 + CONFIRM_WAIT,
    });
    const issued = issueOffTerminalLink({
      kind: "sign-off",
      enterpriseId,
      person: "Priya Nair",
      jobId: "task-1",
      resultSha256: "hash-1",
      now: NOW + 2 + CONFIRM_WAIT,
      env: ENV,
    });
    if ("refused" in issued) {
      throw new Error(issued.refused);
    }
    const key = usablePasskeys(enterpriseId, "Priya Nair", NOW + 2 + CONFIRM_WAIT)[0];
    const removed = removePasskey({
      enterpriseId,
      person: "Priya Nair",
      credentialId: key?.credentialId ?? "",
      actor: undefined,
      now: NOW + 2 + CONFIRM_WAIT,
    });
    expect(removed).toMatchObject({
      message: expect.stringContaining("Links already issued to them no longer work"),
    });
    expect(lookupOffTerminalLink(issued.token, { now: NOW + 2 + CONFIRM_WAIT })).toEqual({
      refused: LINK_ENDED_MESSAGE,
    });
  });

  it("will not add a further device check until an existing one has been used", async () => {
    const started = await start();
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

    const further = await start(NOW + CONFIRM_WAIT + 1);
    expect(await enrolmentOptions({ token: further.token, now: NOW + CONFIRM_WAIT + 1, env: ENV })).toEqual({
      refused: "An existing device check has to be used first, before a new one can be set up.",
    });
    markExistingKeyCheckedForTests(further.token);
    expect(
      await enrolmentOptions({ token: further.token, now: NOW + CONFIRM_WAIT + 1, env: ENV })
    ).toMatchObject({ options: expect.objectContaining({ challenge: expect.any(String) }) });
  });
});
