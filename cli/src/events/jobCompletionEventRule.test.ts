import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createJobCompletionEventRule,
} from "./jobCompletionEventRule";

describe("createJobCompletionEventRule", () => {
  it("creates an enabled, bounded Job-completion rule", () => {
    const rule =
      createJobCompletionEventRule({
        enterpriseId:
          "enterprise-1",
        sourceBusinessFunctionId:
          "enterprise-1:function-1",
        requiredCapability:
          "web-research",
        publishedEventLabel:
          "  Science   evidence ready  ",
        now:
          123,
      });

    expect(rule).toMatchObject({
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
    expect(rule.id).toMatch(
      /^event-rule-/
    );
  });

  it("rejects unsupported trigger types", () => {
    expect(() =>
      createJobCompletionEventRule({
        enterpriseId:
          "enterprise-1",
        sourceBusinessFunctionId:
          "enterprise-1:function-1",
        triggerType:
          "job.failed" as
            "job.completed",
        publishedEventLabel:
          "Evidence ready",
      })
    ).toThrow(
      "only --when task.completed"
    );
  });
});
