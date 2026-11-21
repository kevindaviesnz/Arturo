import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearJobs, enqueueJob, requestJobApproval } from "./jobQueue";
import { announceApprovalReviewLinks, createApprovalReviewUrl } from "./workerRuntime";
import { clearNotifications, listNotifications } from "./notificationStore";
import { readReviewCredential } from "./reviewCredential";
import { markReviewLinksServed, resetReviewLinksServedForTests } from "./reviewSurface";
import { clearStaffingAssignments, saveStaffingAssignment } from "../staffing/staffingStore";

const FUNCTION_ID = "function-advice";

function heldTask(businessFunctionId: string | undefined = FUNCTION_ID) {
  return requestJobApproval(
    enqueueJob("Send the advice to the client.", "Advice Drafter", {
      requiredCapabilities: ["writing"],
      businessFunctionId,
    }).id
  );
}

function staffApprover(workerName: string): void {
  saveStaffingAssignment({
    businessFunctionId: FUNCTION_ID,
    workerName,
    role: "human-approver",
    rationale: "Test staffing.",
  });
}

describe("review links for a Task held for approval", () => {
  beforeEach(() => {
    clearJobs();
    clearNotifications();
    clearStaffingAssignments();
    resetReviewLinksServedForTests();
    vi.spyOn(console, "log").mockImplementation(() => undefined);
  });
  afterEach(() => {
    clearJobs();
    clearNotifications();
    clearStaffingAssignments();
    resetReviewLinksServedForTests();
    vi.restoreAllMocks();
  });

  it("gives a held Task a decision token and keeps it on a second hold", () => {
    const held = heldTask();

    expect(held.status).toBe("awaiting_approval");
    expect(held.reviewToken).toBeTruthy();
    expect(requestJobApproval(held.id).reviewToken).toBe(held.reviewToken);
  });

  it("names the approver in the link, not the Worker that will do the work", () => {
    const held = heldTask();
    const token = new URL(createApprovalReviewUrl(held, "Principal Lawyer")!).searchParams.get("token");

    expect(readReviewCredential(held.id, token)?.reviewer).toBe("Principal Lawyer");
  });

  it("announces one link to each accountable approver when links are served", () => {
    staffApprover("Principal Lawyer");
    staffApprover("Practice Partner");
    markReviewLinksServed();

    announceApprovalReviewLinks(heldTask());

    expect(listNotifications().map((notification) => notification.message.split(":")[0])).toEqual(
      expect.arrayContaining([
        "Principal Lawyer to decide Task task-1",
        "Practice Partner to decide Task task-1",
      ])
    );
    expect(listNotifications()).toHaveLength(2);
  });

  it("announces nothing where no server would answer the link", () => {
    staffApprover("Principal Lawyer");

    announceApprovalReviewLinks(heldTask());

    expect(listNotifications()).toHaveLength(0);
  });

  it("announces nothing when the staffing plan names no approver", () => {
    markReviewLinksServed();

    announceApprovalReviewLinks(heldTask());
    announceApprovalReviewLinks(heldTask(undefined));

    expect(listNotifications()).toHaveLength(0);
  });
});
