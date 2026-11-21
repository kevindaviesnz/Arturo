import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";
import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";
import { handleUiCommand } from "./uiCommandHandlers";

import { formatLineInterfaceDisplayEntry } from "./lineInterface";
import { describeRuntimeEventType } from "./uiTimelineEntries";
import { formatEventType } from "../repl/eventCommands";

/**
 * The Timeline is the record a reader is sent to when they want to know what
 * Arturo did. Three of its headings said something the message underneath
 * contradicted, and one line lost a separator to the key/value renderer.
 */
describe("timeline wording", () => {
  it("calls a started Function a Function, not a Job", () => {
    // The message under this heading reads "Function started Product Safety".
    expect(
      describeRuntimeEventType("job.started")
    ).toBe("Function started");
  });

  it("does not surface the internal word Runtime", () => {
    for (const type of [
      "runtime.signal.evaluated",
      "runtime.signal.evaluation_failed",
    ]) {
      expect(
        describeRuntimeEventType(type),
        type
      ).not.toContain("Runtime");
    }
  });

  it("does not build a heading out of the operator's Event label", () => {
    // organisationalEventType("Safety review") === "business.safety.review",
    // which the mechanical rewrite turned into "Business safety review".
    expect(
      describeRuntimeEventType(
        "business.safety.review"
      )
    ).toBe("Event published");
    expect(
      describeRuntimeEventType(
        "business.new.fabric.activity.cube.submitted"
      )
    ).toBe("Event published");
  });

  it("still rewrites an ordinary type mechanically", () => {
    expect(
      describeRuntimeEventType(
        "delegation.completed"
      )
    ).toBe("Delegation completed");
  });
});

describe("Event message rendering", () => {
  /** The Timeline entry a published Event produces. */
  function renderPublishedEvent(): string {
    return formatLineInterfaceDisplayEntry({
      actor: "SUCCESS",
      label: "#2 · Event published",
      body: [
        "Safety review — source: Product Safety — enterprise: Ethical Toys",
        "time: 2026-08-07T04:07:59.061Z",
        "id: ba4c7fbf-c376-4f0b-a105-ba2d5f650d4c",
      ].join("\n"),
    });
  }

  it("leaves a published Event's message as the sentence it is", () => {
    const rendered = renderPublishedEvent();

    // Both separators survive: the line is prose, not a two-column record.
    // It used to render as "Safety review — source  Product Safety — ...".
    expect(rendered).toContain(
      "source: Product Safety"
    );
    expect(rendered).toContain(
      "enterprise: Ethical Toys"
    );
  });

  it("still aligns the record lines beneath it", () => {
    const rendered = renderPublishedEvent();

    // A genuine label keeps its column, and drops the colon it was written
    // with — that is the behaviour the Event sentence was wrongly getting.
    expect(rendered).not.toContain("time:");
    expect(rendered).toContain(
      "2026-08-07T04:07:59.061Z"
    );
    expect(rendered).toContain(
      "ba4c7fbf-c376-4f0b-a105-ba2d5f650d4c"
    );
  });
});

/**
 * A Function that has never been started still exists, and inspecting it has
 * to say so. `/runtime inspect <id>` used to answer "Function not found" for
 * an id `/function inspect` had just displayed, sending the operator looking
 * for a typo that was not there. /runtime has since been removed; these cover
 * the command that replaced it.
 */
describe("/function inspect on a Function that is not running", () => {
  beforeEach(() => {
    clearEnterprises();
    clearBusinessFunctionDefinitions();
  });
  afterEach(() => {
    clearEnterprises();
    clearBusinessFunctionDefinitions();
  });

  function seedUnstartedFunction(): string {
    const enterprise =
      createAndSaveEnterprise({
        name: "Ethical Toys",
        mission: "Help families choose safe toys.",
      });
    const definition =
      createAndSaveBusinessFunctionDefinition({
        id: `${enterprise.id}:toy-design`,
        enterpriseId: enterprise.id,
        label: "Toy Design",
        objective: "Design safe and sustainable toys.",
      });
    return definition.id;
  }

  it("says the Function is not started, not that it does not exist", async () => {
    const id = seedUnstartedFunction();

    const [entry] = await handleUiCommand("/function", ["inspect", id]);

    expect(entry.body).toContain("Toy Design");
    expect(entry.body).toContain("Not started");
    expect(entry.label).not.toBe("Function not found");
  });

  it("still reports a genuinely unknown Function as not found", async () => {
    seedUnstartedFunction();

    const [entry] = await handleUiCommand("/function", [
      "inspect",
      "ethical-toys:no-such-thing",
    ]);

    expect(entry.body.toLowerCase()).toContain("not found");
  });

  it("no longer answers /runtime, which has been removed", async () => {
    const [entry] = await handleUiCommand("/runtime", ["inspect", seedUnstartedFunction()]);

    // The catch-all for an unknown command, not a working alias.
    expect(entry.body).toContain("/runtime");
    expect(entry.body).not.toContain("Not started");
  });
});

/**
 * /events and /timeline label the same records through two entirely separate
 * formatters, and they had drifted: /events printed the heading "Job Queued"
 * over its own message "Task queued for …". Every type either product surface
 * can show gets checked here, because the pair only stays consistent if both
 * are asserted against the same list.
 */
describe("stored event types never show the pre-rename vocabulary", () => {
  const STORED_TYPES = [
    "job.queued",
    "job.created",
    "job.started",
    "job.completed",
    "job.failed",
    "job.approval_refused",
    "job.rejection_refused",
    "job.operating_state_reset",
    "job.artefact_gate.released",
    "runtime.started",
    "runtime.reset",
    "runtime.snapshot",
    "runtime.heartbeat",
    "runtime.error",
    "scheduled-job.queued",
    "scheduled-job.dispatched",
    "scheduled-job.ignored",
  ] as const;

  it("keeps Job, Runtime and raw underscores out of /events headings", () => {
    for (const type of STORED_TYPES) {
      const heading = formatEventType(type);

      expect(heading, type).not.toMatch(/\bJob\b/i);
      expect(heading, type).not.toMatch(/\bRuntime\b/i);
      expect(heading, type).not.toContain("_");
    }
  });

  it("keeps Job, Runtime and raw underscores out of /timeline headings", () => {
    for (const type of STORED_TYPES) {
      const heading = describeRuntimeEventType(type);

      expect(heading, type).not.toMatch(/\bJob\b/i);
      expect(heading, type).not.toMatch(/\bRuntime\b/i);
      expect(heading, type).not.toContain("_");
    }
  });

  it("names a queued Task a Task, in both views", () => {
    expect(formatEventType("job.queued")).toBe("Task Queued");
    expect(describeRuntimeEventType("job.queued")).toContain("Task");
  });

  it("holds the line for an event type nobody has named yet", () => {
    // The fallback, not the lookup table — a job.* type added later must not
    // reintroduce the contradiction this suite exists to catch.
    expect(
      formatEventType("job.some_future_thing")
    ).toBe("Task Some Future Thing");
  });
});
