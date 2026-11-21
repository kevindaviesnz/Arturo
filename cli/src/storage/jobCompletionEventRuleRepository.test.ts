import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearPersistedJobCompletionEventRules,
  deletePersistedJobCompletionEventRule,
  hasPersistedJobCompletionEventEmission,
  loadPersistedJobCompletionEventRules,
  savePersistedJobCompletionEventEmission,
  savePersistedJobCompletionEventRule,
} from "./jobCompletionEventRuleRepository";

beforeEach(() => {
  clearPersistedJobCompletionEventRules();
});

describe("jobCompletionEventRuleRepository", () => {
  it("persists rules and deduplicates Job emissions", () => {
    savePersistedJobCompletionEventRule({
      id:
        "event-rule-1",
      enterpriseId:
        "enterprise-1",
      sourceBusinessFunctionId:
        "enterprise-1:function-1",
      triggerType:
        "job.completed",
      requiredCapability:
        "web-research",
      publishedEventLabel:
        "Science evidence ready",
      enabled:
        true,
      createdAt:
        123,
    });

    expect(
      loadPersistedJobCompletionEventRules()
    ).toEqual([
      {
        id:
          "event-rule-1",
        enterpriseId:
          "enterprise-1",
        sourceBusinessFunctionId:
          "enterprise-1:function-1",
        triggerType:
          "job.completed",
        requiredCapability:
          "web-research",
        publishedEventLabel:
          "Science evidence ready",
        enabled:
          true,
        createdAt:
          123,
      },
    ]);

    expect(
      hasPersistedJobCompletionEventEmission(
        "event-rule-1",
        "job-1"
      )
    ).toBe(false);
    savePersistedJobCompletionEventEmission({
      ruleId:
        "event-rule-1",
      jobId:
        "job-1",
      eventId:
        "event-1",
      createdAt:
        456,
    });
    expect(
      hasPersistedJobCompletionEventEmission(
        "event-rule-1",
        "job-1"
      )
    ).toBe(true);
    expect(
      deletePersistedJobCompletionEventRule(
        "event-rule-1"
      )
    ).toBe(true);
  });
});
