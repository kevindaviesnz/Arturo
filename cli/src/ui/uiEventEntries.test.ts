import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  appendRuntimeEventToStore,
  clearRuntimeEventStore,
} from "../runtime/runtimeEventStore";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  clearJobCompletionEventRules,
  listJobCompletionEventRules,
} from "../events/jobCompletionEventRuleStore";

import {
  handleUiEventCommand,
  readEventEntries,
} from "./uiEventEntries";

describe("uiEventEntries", () => {
  beforeEach(() => {
    clearRuntimeEventStore();
    clearJobCompletionEventRules();
    clearBusinessFunctionDefinitions();
    clearEnterprises();
  });

  it("creates an empty Events UI entry", () => {
    expect(
      readEventEntries()
    ).toEqual({
      actor: "Arturo",
      label: "Events",
      body: [
        "Events",
        "",
        "No events recorded.",
      ].join("\n"),
    });
  });

  it("creates an Events UI entry from runtime events", () => {
    appendRuntimeEventToStore({
      id: "event-1",
      type: "runtime.started",
      level: "success",
      message: "Runtime started: Hydration Reminder",
      timestamp: new Date(
        "2026-07-10T09:00:00.000Z"
      ).getTime(),
    });

    expect(
      readEventEntries().body
    ).toContain(
      "Function Started"
    );

    expect(
      readEventEntries().body
    ).toContain(
      "Function started: Hydration Reminder"
    );
  });

  it("adds, lists, inspects, and removes a post-Job Event rule", async () => {
    const enterprise =
      createAndSaveEnterprise({
        name:
          "Science Tracker",
        mission:
          "Find and summarise current science news.",
      });
    createAndSaveBusinessFunctionDefinition({
      id:
        `${enterprise.id}:function-1`,
      enterpriseId:
        enterprise.id,
      label:
        "Science Discovery",
      objective:
        "Retrieve current public science evidence.",
    });

    const added =
      await handleUiEventCommand([
        "rule",
        "add",
        "--when",
        "job.completed",
        "--function",
        "Science Discovery",
        "--capability",
        "web-research",
        "--publish",
        "Science evidence ready",
        "--enterprise",
        "Science Tracker",
      ]);

    expect(
      added.label
    ).toBe(
      "Event rule added"
    );
    expect(
      added.body
    ).toContain(
      "Verified governed Web Search evidence"
    );
    const [
      rule,
    ] =
      listJobCompletionEventRules();
    expect(
      rule.publishedEventLabel
    ).toBe(
      "Science evidence ready"
    );

    const listed =
      await handleUiEventCommand([
        "rule",
        "list",
      ]);
    expect(
      listed.body
    ).toContain(
      rule.id
    );

    const inspected =
      await handleUiEventCommand([
        "rule",
        "inspect",
        rule.id,
      ]);
    expect(
      inspected.body
    ).toContain(
      "Science Discovery"
    );

    const removed =
      await handleUiEventCommand([
        "rule",
        "remove",
        rule.id,
      ]);
    expect(
      removed.label
    ).toBe(
      "Event rule removed"
    );
    expect(
      listJobCompletionEventRules()
    ).toEqual([]);
  });
});
