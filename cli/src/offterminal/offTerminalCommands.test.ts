import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearSignIn, setSignOffRight } from "../identity/companySignIn";
import { ENROLMENT_CONFIRM_WAIT_HOURS, SWITCH_ON_COOLING_OFF_HOURS } from "../runtime/chainLimits";
import { addEnterprisePerson } from "../testing/cliTestSetup";
import { setClaimOnceSenderForTests } from "./claimOnceEmail";
import {
  OFF_TERMINAL_USAGE,
  runOffTerminalCommand,
  setOffTerminalCommandNowForTests,
} from "./offTerminalCommands";
import { clearOffTerminalPath, isOffTerminalPathOn } from "./offTerminalPathState";
import { clearOffTerminalLinks } from "./offTerminalLinks";
import { clearPasskeys, completeEnrolment, enrolmentOptions } from "./passkeys";
import { clearRealPersonTest, isRealPersonTestPassed, realPersonTestOutcome } from "./realPersonTest";
import { clearVerifiedEmails } from "./verifiedEmail";
import { setWebAuthnVerifiersForTests } from "./webAuthn";

const ENV_URL = "https://signoff.example.com";
const NOW = 1_700_000_000_000;
const PATH_WAIT = SWITCH_ON_COOLING_OFF_HOURS * 60 * 60 * 1000;
const CONFIRM_WAIT = ENROLMENT_CONFIRM_WAIT_HOURS * 60 * 60 * 1000;
const REASON = "Staff need to sign off when they are not at the computer.";

const reset = () => {
  setOffTerminalCommandNowForTests(undefined);
  setClaimOnceSenderForTests(undefined);
  setWebAuthnVerifiersForTests(undefined);
  delete process.env.PUBLIC_BASE_URL;
  clearPasskeys();
  clearVerifiedEmails();
  clearOffTerminalLinks();
  clearOffTerminalPath();
  clearRealPersonTest();
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

describe("/off-terminal commands", () => {
  let enterpriseId: string;
  const mails: Array<{ to: string; subject: string; text: string }> = [];

  beforeEach(() => {
    reset();
    mails.length = 0;
    process.env.PUBLIC_BASE_URL = ENV_URL;
    setOffTerminalCommandNowForTests(NOW);
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
  });
  afterEach(reset);

  it("prints usage and writes nothing when the subcommand is missing or typeless yes is the reason", async () => {
    expect(await runOffTerminalCommand([])).toEqual({ text: OFF_TERMINAL_USAGE, refused: false });
    expect(await runOffTerminalCommand(["on", "--reason", "yes", "--notify-to", "owner@example.com"])).toEqual({
      refused: true,
      text: "Say why off-terminal sign-off should be on, in your own words, not only yes.",
    });
    expect(isOffTerminalPathOn(enterpriseId, NOW)).toBe(false);
  });

  it("turns the path on after a notice, shows the wait, and lets a signer cancel", async () => {
    const started = await runOffTerminalCommand([
      "on",
      "--reason",
      REASON,
      "--notify-to",
      "owner@example.com",
    ]);
    expect(started.refused).toBe(false);
    expect(started.text).toContain("will turn on");
    expect(started.text).toContain("/off-terminal cancel --as");
    expect(isOffTerminalPathOn(enterpriseId, NOW)).toBe(false);

    const status = await runOffTerminalCommand(["status"]);
    expect(status.refused).toBe(false);
    expect(status.text).toContain("waiting to turn on");

    expect(await runOffTerminalCommand(["cancel"])).toMatchObject({
      refused: true,
      text: expect.stringContaining("--as"),
    });
    const cancelled = await runOffTerminalCommand(["cancel", "--as", "Priya Nair"]);
    expect(cancelled).toEqual({
      refused: false,
      text: "The switch-on was cancelled. Off-terminal sign-off is still off.",
    });
    expect((await runOffTerminalCommand(["status"])).text).toContain("is off");
  });

  it("turns the path off at once after the wait has ended", async () => {
    expect(
      (await runOffTerminalCommand(["on", "--reason", REASON, "--notify-to", "owner@example.com"])).refused
    ).toBe(false);
    setOffTerminalCommandNowForTests(NOW + PATH_WAIT);
    expect(isOffTerminalPathOn(enterpriseId, NOW + PATH_WAIT)).toBe(true);
    const off = await runOffTerminalCommand(["off"]);
    expect(off).toEqual({
      refused: false,
      text: "Off-terminal sign-off is off. Issued links no longer work.",
    });
  });

  it("sends a one-time email code and records the address when the code is entered", async () => {
    const started = await runOffTerminalCommand([
      "verify-email",
      "--person",
      "Priya Nair",
      "--address",
      "priya@example.com",
    ]);
    expect(started.refused).toBe(false);
    expect(started.text).toContain("priya@example.com");
    const code = codeFrom(mails.at(-1)?.text);
    const confirmed = await runOffTerminalCommand([
      "confirm-email",
      "--person",
      "Priya Nair",
      "--code",
      code,
    ]);
    expect(confirmed).toEqual({
      refused: false,
      text: "priya@example.com is now verified for Priya Nair.",
    });
    expect(
      await runOffTerminalCommand(["confirm-email", "--person", "Priya Nair", "--code", "000000"])
    ).toEqual({ refused: true, text: "That code is not right, or has expired." });
  });

  it("issues a 30-minute enrolment link and confirms it only after the wait, with a named confirmation", async () => {
    for (const [person, email] of [
      ["Kevin Brown", "kevin@example.com"],
      ["Priya Nair", "priya@example.com"],
    ] as const) {
      await runOffTerminalCommand(["verify-email", "--person", person, "--address", email]);
      const code = codeFrom(mails.filter((mail) => mail.to === email).at(-1)?.text);
      await runOffTerminalCommand(["confirm-email", "--person", person, "--code", code]);
    }
    expect(
      (await runOffTerminalCommand(["on", "--reason", REASON, "--notify-to", "kevin@example.com"])).refused
    ).toBe(false);
    setOffTerminalCommandNowForTests(NOW + PATH_WAIT);

    expect(
      await runOffTerminalCommand(["enrol", "--person", "Priya Nair", "--reason", "yes"])
    ).toEqual({
      refused: true,
      text: "Say why this person should get a device check, in your own words, not only yes.",
    });

    const enrolled = await runOffTerminalCommand([
      "enrol",
      "--person",
      "Priya Nair",
      "--reason",
      "Priya needs to sign off when she is not at this computer.",
    ]);
    expect(enrolled.refused).toBe(false);
    expect(enrolled.text).toContain("Setup link");
    expect(enrolled.text).toContain(ENV_URL);
    const token = mails.at(-1)?.text.match(/https:\/\/signoff\.example\.com\/pair\/([A-Za-z0-9-_]+)/)?.[1];
    if (!token) {
      throw new Error(`no enrolment token in ${mails.at(-1)?.text}`);
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
    await enrolmentOptions({ token, now: NOW + PATH_WAIT, env: { PUBLIC_BASE_URL: ENV_URL } });
    const completed = await completeEnrolment({
      token,
      response: { id: "x" } as RegistrationResponseJSON,
      now: NOW + PATH_WAIT,
      env: { PUBLIC_BASE_URL: ENV_URL },
    });
    if ("refused" in completed) {
      throw new Error(completed.refused);
    }

    expect(
      await runOffTerminalCommand([
        "confirm",
        "--person",
        "Priya Nair",
        "--confirmation",
        "I spoke to Priya Nair and they set this up.",
      ])
    ).toMatchObject({ refused: true, text: expect.stringContaining("can be confirmed after") });

    setOffTerminalCommandNowForTests(NOW + PATH_WAIT + CONFIRM_WAIT);
    expect(
      await runOffTerminalCommand(["confirm", "--person", "Priya Nair", "--confirmation", "yes"])
    ).toEqual({ refused: true, text: "Type a confirmation that names the person, not only yes." });

    const confirmed = await runOffTerminalCommand([
      "confirm",
      "--person",
      "Priya Nair",
      "--confirmation",
      "I spoke to Priya Nair and they set this up.",
    ]);
    expect(confirmed.refused).toBe(false);
    expect(confirmed.text).toContain("A passkey was added for Priya Nair");
  });

  it("records a fail, and refuses a pass when the person was helped", async () => {
    expect(
      await runOffTerminalCommand([
        "record-test",
        "--outcome",
        "passed",
        "--person",
        "Priya Nair",
        "--recorded-by",
        "Kevin Brown",
        "--unaided",
        "no",
        "--started",
        "now",
      ])
    ).toEqual({
      refused: true,
      text: "This test only passes if the person enrolled and signed off without help.",
    });
    expect(realPersonTestOutcome()).toBe("not_run");

    const failed = await runOffTerminalCommand([
      "record-test",
      "--outcome",
      "failed",
      "--person",
      "Priya Nair",
      "--recorded-by",
      "Kevin Brown",
      "--unaided",
      "no",
      "--started",
      "now",
      "--minutes",
      "20",
    ]);
    expect(failed).toEqual({
      refused: false,
      text: "Recorded: failed. Priya Nair needed help, so this is a fail, recorded by Kevin Brown.",
    });

    const passed = await runOffTerminalCommand([
      "record-test",
      "--outcome",
      "passed",
      "--person",
      "Priya Nair",
      "--recorded-by",
      "Kevin Brown",
      "--unaided",
      "yes",
      "--started",
      String(NOW),
      "--enrolled",
      String(NOW + 1),
      "--signed-off",
      String(NOW + 2),
      "--minutes",
      "18",
    ]);
    expect(passed).toEqual({
      refused: false,
      text: "Recorded: passed. Priya Nair enrolled and signed off unaided, recorded by Kevin Brown.",
    });
    expect(isRealPersonTestPassed()).toBe(true);
  });
});
