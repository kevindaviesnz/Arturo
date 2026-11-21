import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearPersistedDelegations,
  loadPersistedDelegations,
  savePersistedDelegation,
} from "./delegationRepository";

beforeEach(clearPersistedDelegations);

describe("delegationRepository", () => {
  it("persists the linked Job, route, result, and timestamps", () => {
    savePersistedDelegation({
      id: "delegation-1",
      fromBusinessFunction: "Curriculum",
      toBusinessFunction: "Resources",
      work: "Prepare options",
      status: "completed",
      jobId: "job-1",
      workerName: "Resource Analyst",
      requiredCapabilities: ["analysis"],
      result: "Evidence status: UNVERIFIED MODEL SYNTHESIS\n\nOptions",
      createdAt: 100,
      completedAt: 200,
    });

    expect(loadPersistedDelegations()).toEqual([
      {
        id: "delegation-1",
        fromBusinessFunction: "Curriculum",
        toBusinessFunction: "Resources",
        work: "Prepare options",
        status: "completed",
        jobId: "job-1",
        workerName: "Resource Analyst",
        requiredCapabilities: ["analysis"],
        result: "Evidence status: UNVERIFIED MODEL SYNTHESIS\n\nOptions",
        error: undefined,
        createdAt: 100,
        completedAt: 200,
      },
    ]);
  });
});
