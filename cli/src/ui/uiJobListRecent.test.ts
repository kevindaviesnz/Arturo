import { describe, expect, it } from "vitest";
import { createNumberedJobsListEntry, findJobByUiReference } from "./uiJobEntries";

const job = (n: number) =>
  ({ id: `task-${n}`, task: `Task number ${n}`, status: "completed", createdAt: 1_000 + n }) as never;

describe("the Tasks list", () => {
  it("shows the most recent Tasks, keeping their place in the numbering", () => {
    const jobs = Array.from({ length: 13 }, (_, index) => job(index + 1));

    const { body } = createNumberedJobsListEntry(jobs, 8);

    expect(body).not.toContain("ID: task-5\n");
    expect(body).toContain("6. Task number 6");
    expect(body).toContain("13. Task number 13");
    expect(body).toContain("Showing the 8 most recent of 13 Tasks.");
    // The number shown is the number /task inspect reads.
    expect(findJobByUiReference(jobs, "13")).toMatchObject({ id: "task-13" });
  });

  it("says nothing about hidden Tasks when none are", () => {
    const { body } = createNumberedJobsListEntry([job(1), job(2)], 8);

    expect(body).toContain("1. Task number 1");
    expect(body).not.toContain("Showing the");
  });
});
