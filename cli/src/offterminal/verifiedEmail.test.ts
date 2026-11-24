import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearSignIn } from "../identity/companySignIn";
import { addEnterprisePerson } from "../testing/cliTestSetup";
import { setClaimOnceSenderForTests } from "./claimOnceEmail";
import {
  clearVerifiedEmails,
  confirmEmailVerification,
  getVerifiedEmail,
  startEmailVerification,
} from "./verifiedEmail";

const NOW = 1_700_000_000_000;

const reset = () => {
  setClaimOnceSenderForTests(undefined);
  clearVerifiedEmails();
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

describe("verified email addresses", () => {
  let enterpriseId: string;

  beforeEach(() => {
    reset();
    expect(
      setUpBusiness(["Harbour Legal", "--owner", "Kevin Brown", "--about", "Commercial contracts."])
        .created
    ).toBe(true);
    enterpriseId = listEnterprises()[0]?.id ?? "";
    addEnterprisePerson({ enterpriseId, name: "Priya Nair", role: "approver" });
  });
  afterEach(reset);

  it("records an address only after the one-time code is accepted, and will not use an unverified one", async () => {
    expect(getVerifiedEmail(enterpriseId, "Priya Nair")).toBeUndefined();
    let sent: { text: string; to: string } | undefined;
    setClaimOnceSenderForTests(async (mail) => {
      sent = mail;
      return "accepted";
    });
    const started = await startEmailVerification({
      enterpriseId,
      person: "Priya Nair",
      email: "priya@example.com",
      actor: undefined,
      now: NOW,
    });
    if ("refused" in started) {
      throw new Error(started.refused);
    }
    expect(getVerifiedEmail(enterpriseId, "Priya Nair")).toBeUndefined();
    expect(sent?.to).toBe("priya@example.com");
    expect(sent?.text).not.toMatch(/password request|draft|client/i);
    expect(sent?.text).toContain("Arturo never asks for your password");

    expect(
      confirmEmailVerification({
        enterpriseId,
        person: "Priya Nair",
        code: "deadbeef",
        now: NOW,
      })
    ).toEqual({ refused: "That code is not right, or has expired." });

    const confirmed = confirmEmailVerification({
      enterpriseId,
      person: "Priya Nair",
      code: codeFrom(sent?.text),
      now: NOW,
    });
    expect(confirmed).toEqual({ message: "priya@example.com is now verified for Priya Nair." });
    expect(getVerifiedEmail(enterpriseId, "Priya Nair")).toBe("priya@example.com");
  });

  it("notices the old address when the owner changes a verified one, and refuses if that notice cannot be sent", async () => {
    const mails: Array<{ to: string; text: string }> = [];
    setClaimOnceSenderForTests(async (mail) => {
      mails.push(mail);
      return "accepted";
    });
    await startEmailVerification({
      enterpriseId,
      person: "Priya Nair",
      email: "priya@example.com",
      actor: undefined,
      now: NOW,
    });
    confirmEmailVerification({
      enterpriseId,
      person: "Priya Nair",
      code: codeFrom(mails[0]?.text),
      now: NOW,
    });

    setClaimOnceSenderForTests(async () => "failed");
    expect(
      await startEmailVerification({
        enterpriseId,
        person: "Priya Nair",
        email: "priya.new@example.com",
        actor: undefined,
        now: NOW + 1,
      })
    ).toEqual({
      refused: "The notice to the old address could not be sent, so the address was not changed.",
    });
    expect(getVerifiedEmail(enterpriseId, "Priya Nair")).toBe("priya@example.com");
  });
});
