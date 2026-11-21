import { describe, expect, it } from "vitest";

import {
  describeConfirmationRecovery,
  formatUnhandledInputEntry,
} from "./uiUnhandledInput";

const noEnterprise = { functionCount: 0, workerCount: 0 };

describe("formatUnhandledInputEntry", () => {
  it.each(["yes", "Yes", "no", "nope", "sure", "ok"])(
    "explains that %s has nothing to attach to rather than reciting usage",
    (reply) => {
      const entry = formatUnhandledInputEntry(reply, {
        enterpriseName: "Manaaki Kai Trust",
        functionCount: 0,
        workerCount: 0,
      });

      expect(entry.label).toBe("Nothing to confirm");
      expect(entry.body).toContain("Nothing is waiting for a yes or no");
      expect(entry.body).toContain("Nothing was\nchanged");
      expect(entry.body).toContain('/next "Manaaki Kai Trust"');
    }
  );

  it("routes a first-time operator's plain-English description to the next setup step", () => {
    const entry = formatUnhandledInputEntry(
      "i run a food truck and want some help running it",
      noEnterprise
    );

    expect(entry.label).toBe("Getting started");
    expect(entry.body).toContain("/enterprise");
    // Must not strand them on /ask, which itself refuses without an Enterprise.
    expect(entry.body).not.toContain("/ask");
  });

  it("points a confused operator at navigation once the install is ready for work", () => {
    const entry = formatUnhandledInputEntry(
      "I want to make sure we never run out of food",
      { enterpriseName: "Manaaki Kai Trust", functionCount: 4, workerCount: 6 }
    );

    expect(entry.label).toBe("Not a command");
    expect(entry.body).toContain("/overview");
    expect(entry.body).toContain("/tasks");
    expect(entry.body).toContain("/approvals");
    expect(entry.body).toContain("/help");
    // The one-off /ask escape hatch stays mentioned.
    expect(entry.body).toContain("/ask");
  });
});

describe("describeConfirmationRecovery", () => {
  it("offers guided setup when there is no Enterprise yet", () => {
    expect(describeConfirmationRecovery(noEnterprise).join("\n")).toContain(
      "/enterprise"
    );
  });

  it("offers /next when the Enterprise has no Functions", () => {
    expect(
      describeConfirmationRecovery({
        enterpriseName: "Manaaki Kai Trust",
        functionCount: 0,
        workerCount: 0,
      }).join("\n")
    ).toContain('/next "Manaaki Kai Trust"');
  });

  it("offers /staff once Functions exist but no Worker does", () => {
    expect(
      describeConfirmationRecovery({
        enterpriseName: "Manaaki Kai Trust",
        functionCount: 4,
        workerCount: 0,
      }).join("\n")
    ).toContain("/staff");
  });

  it("offers the running Enterprise's next moves once it is staffed", () => {
    const lines = describeConfirmationRecovery({
      enterpriseName: "Manaaki Kai Trust",
      functionCount: 4,
      workerCount: 6,
    }).join("\n");

    expect(lines).toContain("/suggest");
    expect(lines).not.toContain("/staff");
  });
});
