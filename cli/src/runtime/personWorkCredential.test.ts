import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addWorker, clearWorkers, createHumanWorker, removeWorker } from "../control/workers";
import { issuePersonWorkCredential, PERSON_WORK_LINK_LIFETIME_MS, readPersonWorkCredential } from "./personWorkCredential";
import { createReviewCredential } from "./reviewCredential";

describe("the link to a person's own work page", () => {
  beforeEach(() => {
    clearWorkers();
    addWorker(createHumanWorker("Kevin", "guardian"));
    addWorker(createHumanWorker("Dana", "guardian"));
  });
  afterEach(() => clearWorkers());

  const issue = (person: string, at = 1_000_000) => {
    const issued = issuePersonWorkCredential(person, at);
    if ("refused" in issued) throw new Error(issued.refused);
    return issued.credential;
  };

  it("names the person it was issued to, for a week", () => {
    const credential = issue("kevin");
    expect(readPersonWorkCredential(credential, 1_000_000 + 1000)).toEqual({ person: "Kevin", issuedAt: 1_000_000 });
    expect(readPersonWorkCredential(credential, 1_000_000 + PERSON_WORK_LINK_LIFETIME_MS + 1)).toBeUndefined();
    expect(readPersonWorkCredential(credential, 999_000)).toBeUndefined();
  });

  it("cannot be edited to name someone else, and is not a review link", () => {
    const credential = issue("Kevin");
    const [payload, signature] = credential.split(".");
    const forged = Buffer.from(JSON.stringify({ p: "Dana", i: 1_000_000 })).toString("base64url");
    expect(readPersonWorkCredential(`${forged}.${signature}`, 1_000_001)).toBeUndefined();
    expect(readPersonWorkCredential(`${payload}.${"0".repeat(64)}`, 1_000_001)).toBeUndefined();
    expect(readPersonWorkCredential(payload, 1_000_001)).toBeUndefined();
    const review = createReviewCredential({ jobId: "task-1", bearerToken: "t", reviewer: "Kevin", issuedAt: 1_000_000 });
    expect(readPersonWorkCredential(review, 1_000_001)).toBeUndefined();
  });

  it("is issued only for a registered person, and stops working when they are removed", () => {
    expect(issuePersonWorkCredential("Design Bot")).toEqual({ refused: "Design Bot is not a registered person. Add them with /add-human-worker first." });
    const credential = issue("Dana");
    removeWorker("Dana");
    expect(readPersonWorkCredential(credential, 1_000_001)).toBeUndefined();
  });
});
