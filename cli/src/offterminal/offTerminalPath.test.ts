import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { clearWorkers } from "../control/workers";
import { formatNzTime } from "../core/nzTime";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { clearSignIn, setSignOffRight } from "../identity/companySignIn";
import { SWITCH_ON_COOLING_OFF_HOURS } from "../runtime/chainLimits";
import { hashResult } from "../runtime/resultSignOff";
import { addEnterprisePerson } from "../testing/cliTestSetup";
import { setClaimOnceSenderForTests } from "./claimOnceEmail";
import {
  cancelOffTerminalPathOn,
  requestOffTerminalPathOn,
  turnOffTerminalPathOff,
} from "./offTerminalPath";
import {
  PATH_OFF_REFUSAL,
  clearOffTerminalPath,
  isOffTerminalPathOn,
} from "./offTerminalPathState";
import {
  LINK_ENDED_MESSAGE,
  clearOffTerminalLinks,
  issueOffTerminalLink,
  lookupOffTerminalLink,
} from "./offTerminalLinks";

const ENV = { PUBLIC_BASE_URL: "https://signoff.example.com" };
const NOW = 1_700_000_000_000;
const WAIT = SWITCH_ON_COOLING_OFF_HOURS * 60 * 60 * 1000;
const REASON = "Staff need to sign off when they are not at the computer.";

const reset = () => {
  setClaimOnceSenderForTests(undefined);
  clearOffTerminalLinks();
  clearOffTerminalPath();
  clearWorkers();
  clearSignIn();
  clearEnterprises();
};

describe("off-terminal sign-off starts off", () => {
  let enterpriseId: string;

  beforeEach(() => {
    reset();
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

  it("issues no link while the path is off, and a typeless yes is not a reason", async () => {
    expect(isOffTerminalPathOn(enterpriseId, NOW)).toBe(false);
    expect(
      issueOffTerminalLink({
        kind: "sign-off",
        enterpriseId,
        person: "Priya Nair",
        jobId: "task-1",
        resultSha256: "hash-1",
        now: NOW,
        env: ENV,
      })
    ).toEqual({ refused: PATH_OFF_REFUSAL });

    setClaimOnceSenderForTests(async () => "accepted");
    expect(
      await requestOffTerminalPathOn({
        enterpriseId,
        reason: "yes",
        notifyTo: "owner@example.com",
        actor: undefined,
        now: NOW,
      })
    ).toEqual({
      refused: "Say why off-terminal sign-off should be on, in your own words, not only yes.",
    });
    expect(isOffTerminalPathOn(enterpriseId, NOW + WAIT)).toBe(false);
  });

  it("waits 12 hours after a notice is accepted, and refuses if the notice cannot be sent", async () => {
    setClaimOnceSenderForTests(async () => "no-sender");
    expect(
      await requestOffTerminalPathOn({
        enterpriseId,
        reason: REASON,
        notifyTo: "owner@example.com",
        actor: undefined,
        now: NOW,
      })
    ).toEqual({
      refused: "The notice could not be sent, so off-terminal sign-off was not switched on.",
    });
    expect(isOffTerminalPathOn(enterpriseId, NOW + WAIT)).toBe(false);

    let sent: { to: string; subject: string; text: string } | undefined;
    setClaimOnceSenderForTests(async (mail) => {
      sent = mail;
      return "accepted";
    });
    const requested = await requestOffTerminalPathOn({
      enterpriseId,
      reason: REASON,
      notifyTo: "owner@example.com",
      actor: undefined,
      now: NOW,
    });
    if ("refused" in requested) {
      throw new Error(requested.refused);
    }
    expect(requested.effectiveAt).toBe(NOW + WAIT);
    expect(isOffTerminalPathOn(enterpriseId, NOW)).toBe(false);
    expect(
      issueOffTerminalLink({
        kind: "sign-off",
        enterpriseId,
        person: "Priya Nair",
        jobId: "task-1",
        resultSha256: "hash-1",
        now: NOW,
        env: ENV,
      })
    ).toEqual({ refused: PATH_OFF_REFUSAL });
    expect(isOffTerminalPathOn(enterpriseId, NOW + WAIT)).toBe(true);
    expect(sent?.to).toBe("owner@example.com");
    expect(sent?.text).toContain(formatNzTime(NOW + WAIT));
    expect(sent?.text).toContain("Arturo computer");
    expect(sent?.text).not.toMatch(/draft|lease|client/i);
  });

  it("lets anyone who can sign off cancel during the wait, then the owner can turn it off and issued links fail closed", async () => {
    setClaimOnceSenderForTests(async () => "accepted");
    const requested = await requestOffTerminalPathOn({
      enterpriseId,
      reason: REASON,
      notifyTo: "owner@example.com",
      actor: undefined,
      now: NOW,
    });
    if ("refused" in requested) {
      throw new Error(requested.refused);
    }
    const cancelled = cancelOffTerminalPathOn({
      enterpriseId,
      actor: { workerName: "Priya Nair" },
      now: NOW + 1,
    });
    expect(cancelled).toEqual({
      message: "The switch-on was cancelled. Off-terminal sign-off is still off.",
    });
    expect(isOffTerminalPathOn(enterpriseId, NOW + WAIT)).toBe(false);

    const requestedAgain = await requestOffTerminalPathOn({
      enterpriseId,
      reason: REASON,
      notifyTo: "owner@example.com",
      actor: undefined,
      now: NOW,
    });
    if ("refused" in requestedAgain) {
      throw new Error(requestedAgain.refused);
    }
    const issued = issueOffTerminalLink({
      kind: "sign-off",
      enterpriseId,
      person: "Priya Nair",
      jobId: "task-1",
      resultSha256: hashResult("The lease is one-sided."),
      now: NOW + WAIT,
      env: ENV,
    });
    if ("refused" in issued) {
      throw new Error(issued.refused);
    }
    const off = turnOffTerminalPathOff({
      enterpriseId,
      actor: undefined,
      now: NOW + WAIT,
    });
    expect(off).toEqual({
      message: "Off-terminal sign-off is off. Issued links no longer work.",
    });
    expect(isOffTerminalPathOn(enterpriseId, NOW + WAIT)).toBe(false);
    expect(lookupOffTerminalLink(issued.token, { now: NOW + WAIT })).toEqual({
      refused: LINK_ENDED_MESSAGE,
    });
  });

  it("does not offer switch-on or cancel as listener routes", async () => {
    const { parseAllowedRoute } = await import("./listenerRequest");
    expect(parseAllowedRoute("POST", "/switch-on")).toBeUndefined();
    expect(parseAllowedRoute("POST", "/cancel")).toBeUndefined();
    expect(parseAllowedRoute("POST", "/path/on")).toBeUndefined();
  });
});
