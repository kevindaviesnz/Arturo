import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createBusinessFunctionDefinition,
} from "../business/businessFunctionDefinition";
import {
  addWorker,
  clearWorkers,
} from "../control/workers";
import {
  clearStaffingAssignments,
  saveStaffingAssignment,
} from "../staffing/staffingStore";
import {
  inferBusinessFunctionCapabilities,
  inferCapabilitiesFromText,
  selectRuntimeWorker,
  selectRuntimeWorkerWithCoverage,
} from "./businessFunctionRuntimeRouting";

beforeEach(() => {
  clearWorkers();
});

afterEach(() => {
  clearWorkers();
});

const productSafety = createBusinessFunctionDefinition({
  id: "enterprise-1:function-1",
  enterpriseId: "enterprise-1",
  label: "Product Safety",
  objective: "Ensure every toy is safe for its intended age group.",
});

describe("Business Function Runtime routing", () => {
  it("infers safety work from Product Safety", () => {
    expect(
      inferBusinessFunctionCapabilities(
        productSafety
      )
    ).toEqual([
      "safety",
    ]);
  });

  it("requires governed Web Search for a Function that retrieves from the internet", () => {
    const scienceDiscovery =
      createBusinessFunctionDefinition({
        id:
          "enterprise-1:function-2",
        enterpriseId:
          "enterprise-1",
        label:
          "Science Discovery",
        objective:
          "Get the latest science news from the internet.",
      });

    expect(
      inferBusinessFunctionCapabilities(
        scienceDiscovery
      )
    ).toEqual([
      "web-research",
    ]);
  });

  it("infers backup work from a code backup Job", () => {
    const codeBackup =
      createBusinessFunctionDefinition({
        id:
          "enterprise-1:function-3",
        enterpriseId:
          "enterprise-1",
        label:
          "Back up code",
        objective:
          "Create and verify a backup of the current source code.",
      });

    expect(
      inferBusinessFunctionCapabilities(
        codeBackup
      )
    ).toEqual([
      "backup",
    ]);
  });

  it("selects a matching Product Safety Worker", () => {
    addWorker({
      name: "safety-specialist",
      kind: "ai",
      capabilities: [
        "safety",
      ],
      run: function* () {
        return undefined;
      },
    });

    expect(
      selectRuntimeWorker(
        productSafety,
        [
          "safety",
        ]
      )?.name
    ).toBe("safety-specialist");
  });

  it("does not assign new work to a busy Worker", () => {
    addWorker({
      name: "busy-specialist",
      kind: "ai",
      availability: "busy",
      capabilities: ["safety"],
      run: function* () {
        return undefined;
      },
    });
    addWorker({
      name: "available-specialist",
      kind: "ai",
      availability: "available",
      capabilities: ["safety"],
      run: function* () {
        return undefined;
      },
    });

    expect(
      selectRuntimeWorker(
        productSafety,
        ["safety"]
      )?.name
    ).toBe("available-specialist");
  });

  it("infers human-contact for external outreach so a policy can gate it", () => {
    expect(
      inferCapabilitiesFromText(
        "Email acme@example.com apologising for the outage and offering a credit."
      )
    ).toContain("human-contact");

    expect(
      inferCapabilitiesFromText("Notify the customer that their ticket is resolved.")
    ).toContain("human-contact");
  });

  it("infers web-research only when the text means to look something up", () => {
    // Genuine intent, in several shapes.
    expect(
      inferCapabilitiesFromText("Search the web for current pricing.")
    ).toContain("web-research");
    expect(
      inferCapabilitiesFromText("Find recent online coverage of the recall.")
    ).toContain("web-research");
    expect(
      inferCapabilitiesFromText("Run a web search for the supplier's certifications.")
    ).toContain("web-research");

    // A web-related noun as subject matter is not a search. This exact
    // sentence routed a Task to Web Search, which then failed closed with
    // "Web Search is disabled" — in the flagship investor demonstration.
    expect(
      inferCapabilitiesFromText(
        "Its standard package includes a discovery call, a first draft, and one revision. It does not include website design, technical setup, or publishing."
      )
    ).not.toContain("web-research");
    expect(
      inferCapabilitiesFromText("Draft the copy for our website's pricing page.")
    ).not.toContain("web-research");
  });

  it("infers analysis, so a Governance rule on it can match a Task", () => {
    // A rule keyed on "analysis" is offered by /governance and is the natural
    // thing to gate analytical work with. It could never match, because no
    // Task instruction could declare the capability — the operator's rule was
    // stored, listed correctly, and silently never fired.
    for (const text of [
      "Analyse the supplied figures.",
      "Revised analysis, fully synthetic and anonymised: analyse the process.",
      "Produce an analytic comparison of the three options.",
    ]) {
      expect(inferCapabilitiesFromText(text), text).toContain("analysis");
    }
  });

  it("infers the kind of thinking a task asks for", () => {
    const expected: readonly [string, string][] = [
      ["Convert the supplied notes into a one-page brief.", "conversion"],
      ["Recommend three ways to reduce onboarding time.", "advice"],
      ["Plan the next quarter's outreach in ordered steps.", "planning"],
      ["Coach the new volunteer through their first shift.", "coaching"],
      ["Simulate what happens if demand doubles.", "simulation"],
      ["Optimise the delivery route for cost.", "optimization"],
      ["Draft a welcome email for a new customer.", "email-draft"],
    ];
    for (const [text, capability] of expected) {
      expect(inferCapabilitiesFromText(text), text).toContain(capability);
    }
  });

  it("never infers tool eligibility from prose", () => {
    // These are consequential: a Task that demands one nobody staffed fails
    // closed. Inferring them from a turn of phrase would block work for a word
    // it happened to contain, which is the worst version of that defect.
    const text =
      "Write a file to disk, read the config, run the deploy script, and email the result to the team.";
    for (const capability of [
      "file-write",
      "file-read",
      "shell-execute",
      "shell-read",
      "execution",
      "email-send",
      "web",
    ]) {
      expect(inferCapabilitiesFromText(text), capability).not.toContain(
        capability
      );
    }
  });

  it("never infers human-review, so prose about judgement cannot gate work", () => {
    // An approval gate turns on human-review. Describing why a person must
    // decide is not an instruction to obtain a decision, and blocking on the
    // difference would stop work the operator never asked to stop. Requiring a
    // person is what a Governance rule is for.
    expect(
      inferCapabilitiesFromText(
        "Analyse how a safeguarding concern should be handled, and why a trained person must decide on referral."
      )
    ).not.toContain("human-review");
  });

  it("never infers llm, which every AI Task would carry", () => {
    expect(
      inferCapabilitiesFromText("Analyse the supplied figures.")
    ).not.toContain("llm");
  });

  it("does not infer analysis from unrelated work", () => {
    expect(
      inferCapabilitiesFromText("Draft a welcome email for a new customer.")
    ).not.toContain("analysis");
  });

  it("does not infer human-contact for internal analysis work", () => {
    expect(
      inferCapabilitiesFromText("Summarise last week's incident metrics into a table.")
    ).not.toContain("human-contact");
  });
});

/**
 * The autonomous path has to make the same team allowance the /task path does.
 * Measured end to end before this: Article Creation finished, its completion
 * rule published, Content Editing evaluated the Event and created a Task
 * needing monitoring + review + writing, no single staffed Worker held all
 * three, and the Task was created with no Worker at all. Approving it moved it
 * to Queued, where it stayed. The event chain worked and produced a dead Task.
 */
describe("Runtime routing for a team-staffed Function", () => {
  const contentEditing = createBusinessFunctionDefinition({
    id: "kid-edu:content-editing",
    enterpriseId: "kid-edu",
    label: "Content Editing",
    objective: "Review and edit articles so they meet quality standards.",
  });

  const staff = (workerName: string): void =>
    saveStaffingAssignment({
      businessFunctionId: contentEditing.id,
      workerName,
      role: "ai",
      rationale: "test",
    });

  beforeEach(() => {
    clearStaffingAssignments();
  });
  afterEach(() => {
    clearStaffingAssignments();
  });

  it("routes to the best-covering Worker when no one Worker covers everything", () => {
    addWorker({
      name: "Editing Reviewer",
      kind: "ai",
      capabilities: ["review", "writing"],
      run: function* () { return undefined; },
    });
    addWorker({
      name: "Editing Observer",
      kind: "ai",
      capabilities: ["monitoring"],
      run: function* () { return undefined; },
    });
    staff("Editing Reviewer");
    staff("Editing Observer");

    const selection = selectRuntimeWorkerWithCoverage(contentEditing, [
      "monitoring",
      "review",
      "writing",
    ]);

    expect(selection?.worker.name).toBe("Editing Reviewer");
    expect(selection?.unmetCapabilities).toEqual(["monitoring"]);
  });

  it("prefers the Worker that covers everything", () => {
    addWorker({
      name: "Editing Allrounder",
      kind: "ai",
      capabilities: ["monitoring", "review", "writing"],
      run: function* () { return undefined; },
    });
    addWorker({
      name: "Editing Observer",
      kind: "ai",
      capabilities: ["monitoring"],
      run: function* () { return undefined; },
    });
    staff("Editing Allrounder");
    staff("Editing Observer");

    const selection = selectRuntimeWorkerWithCoverage(contentEditing, [
      "monitoring",
      "review",
      "writing",
    ]);

    expect(selection?.worker.name).toBe("Editing Allrounder");
    expect(selection?.unmetCapabilities).toEqual([]);
  });

  // Routing must never hand work to a Worker lacking the capability that
  // Governance and dispatch checks key on, so this is the one case where
  // producing no Worker is the right answer.
  it("refuses rather than routing consequential work to a Worker without it", () => {
    addWorker({
      name: "Editing Writer",
      kind: "ai",
      capabilities: ["writing"],
      run: function* () { return undefined; },
    });
    staff("Editing Writer");

    expect(
      selectRuntimeWorkerWithCoverage(contentEditing, ["writing", "email-send"])
    ).toBeUndefined();
  });

  it("still searches every Worker when the Function has no staffing at all", () => {
    addWorker({
      name: "Unstaffed Reviewer",
      kind: "ai",
      capabilities: ["review"],
      run: function* () { return undefined; },
    });

    expect(
      selectRuntimeWorkerWithCoverage(contentEditing, ["review"])?.worker.name
    ).toBe("Unstaffed Reviewer");
  });
});
