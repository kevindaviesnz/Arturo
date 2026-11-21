import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getApprovalChain } from "./approvalChainStore";
import { signApprovalDecision } from "./approvalDecisionSigning";
import { clearJobs, enqueueJob, replaceJob, type Job } from "./jobQueue";
import {
  clearResultSignOffs,
  createResultSignOffPayload,
  describeResultSignOff,
  readResultSignOffStanding,
  recordResultSignOff,
  refuseUnacceptedHandOver,
  refuseResultSignOff,
  verifyResultSignOffSignature,
} from "./resultSignOff";
import { saveResultSignOff } from "../storage/resultSignOffRepository";

const SECRET = process.env.APPROVAL_SIGNING_SECRET ?? "";

const finished = (output = "The lease is one-sided."): Job =>
  replaceJob({
    ...enqueueJob("Review the lease.", undefined, { requiredCapabilities: ["email-send"] }),
    status: "completed",
    output,
  });

describe("signing off a finished result", () => {
  beforeEach(() => {
    clearJobs();
    clearResultSignOffs();
  });
  afterEach(() => {
    clearJobs();
    clearResultSignOffs();
  });

  it("refuses when there is no finished result to accept", () => {
    const waiting = replaceJob({ ...finished(), status: "awaiting_approval", output: undefined });
    const review = replaceJob({
      ...enqueueJob("Review the draft.", "Priya", { requiredCapabilities: ["human-review"] }),
      status: "completed",
      output: "Human review approved",
    });

    expect(refuseResultSignOff(undefined, "task-9")).toContain("There is no Task called task-9");
    expect(refuseResultSignOff(waiting, waiting.id)).toContain("has not finished");
    expect(refuseResultSignOff(review, review.id)).toContain("is itself a review by a person");
    expect(() => recordResultSignOff(waiting, "Kevin")).toThrow("has not finished");
    expect(readResultSignOffStanding(waiting)).toEqual({ state: "none" });
    expect(describeResultSignOff(waiting, { state: "none" })).toBeUndefined();
  });

  it("records who accepted the result without touching the approval record", () => {
    const job = finished();

    expect(describeResultSignOff(job, readResultSignOffStanding(job))).toBe(
      `Nobody has signed off this result. Once you have read it and accept it: /task signoff ${job.id}`
    );

    const signOff = recordResultSignOff(job, "Kevin", 1_700_000_000_000);

    expect(verifyResultSignOffSignature(signOff, SECRET)).toBe(true);
    expect(readResultSignOffStanding(job)).toEqual({ state: "signed", signOff });
    expect(describeResultSignOff(job, readResultSignOffStanding(job))).toMatch(
      /^Kevin signed off this result on .*2023\. That records that they accepted it; it does not prove the result is correct\.$/
    );
    // A sign-off is not an approval: it adds no decision and releases nothing.
    expect(getApprovalChain(job.id)).toBeUndefined();
  });

  it("does not carry over to a result that has since changed", () => {
    const job = finished();
    recordResultSignOff(job, "Kevin");
    const changed = replaceJob({ ...job, output: "The lease is balanced." });

    expect(readResultSignOffStanding(changed).state).toBe("superseded");
    expect(describeResultSignOff(changed, readResultSignOffStanding(changed))).toBe(
      "Kevin signed off an earlier version of this result. This version has not been signed off."
    );
  });

  it("does not carry over to a later Task that was given the same id", () => {
    const job = finished();
    recordResultSignOff(job, "Kevin");

    expect(readResultSignOffStanding({ ...job, createdAt: job.createdAt + 1 })).toEqual({ state: "none" });
  });

  it("does not count a stored sign-off whose signature does not verify", () => {
    const job = finished();
    const signOff = recordResultSignOff(job, "Kevin");

    saveResultSignOff({ ...signOff, worker: "Priya" });
    expect(readResultSignOffStanding(job)).toEqual({ state: "unverified" });
    expect(describeResultSignOff(job, readResultSignOffStanding(job))).toContain(
      "its signature does not verify, so it is not counted"
    );

    saveResultSignOff({ ...signOff, jobId: "task-elsewhere" });
    expect(verifyResultSignOffSignature({ ...signOff, jobId: "task-elsewhere" }, SECRET)).toBe(false);
  });

  it("cannot be forged from a signed approval decision", () => {
    const job = finished();
    const signOff = recordResultSignOff(job, "Kevin", 1000);
    const approval = signApprovalDecision(
      { worker: "Kevin", decision: "approved", timestamp: 1000 },
      job.id,
      SECRET
    );

    expect(createResultSignOffPayload(signOff)).toContain('"purpose":"result-sign-off"');
    expect(verifyResultSignOffSignature({ ...signOff, signature: approval }, SECRET)).toBe(false);
  });
});

describe("handing an AI-written result to a person", () => {
  beforeEach(() => {
    clearJobs();
    clearResultSignOffs();
  });

  it("refuses until someone has signed it off, and says how", () => {
    const job = finished("Evidence status: UNVERIFIED MODEL SYNTHESIS\nExternal tools used: none\n\nBallet flats brief.");

    const refusal = refuseUnacceptedHandOver(job);
    expect(refusal).toContain(`${job.id} was written by an AI model and nobody has signed it off, so it was not handed to a person.`);
    expect(refusal).toContain(`/task signoff ${job.id}`);

    recordResultSignOff(job, "Kevin");
    expect(refuseUnacceptedHandOver(job)).toBeUndefined();
  });

  it("refuses a result that changed after it was signed off", () => {
    const job = finished("Evidence status: UNVERIFIED MODEL SYNTHESIS\n\nFirst.");
    recordResultSignOff(job, "Kevin");
    const changed = replaceJob({ ...job, output: "Evidence status: UNVERIFIED MODEL SYNTHESIS\n\nSecond." });

    expect(refuseUnacceptedHandOver(changed)).toContain("Kevin signed off an earlier version of it, not this one");
  });

  it("does not hold a result no model wrote", () => {
    expect(refuseUnacceptedHandOver(finished("Measured by a person."))).toBeUndefined();
  });
});
