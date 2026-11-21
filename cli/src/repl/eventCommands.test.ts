import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

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
} from "../events/jobCompletionEventRuleStore";

import {
  addEventRuleFromArgs,
  formatBusinessEventType,
  formatEventRule,
  formatEventType,
  getEventFlagValue,
} from "./eventCommands";

describe("eventCommands", () => {
  beforeEach(() => {
    clearJobCompletionEventRules();
    clearBusinessFunctionDefinitions();
    clearEnterprises();
  });

  it("formats generic business Event types", () => {
    expect(
      formatBusinessEventType(
        "business.order.accepted"
      )
    ).toBe(
      "Order Accepted"
    );

    expect(
      formatBusinessEventType(
        "business.loan.application.submitted"
      )
    ).toBe(
      "Loan Application Submitted"
    );
  });

  it("formats Chapter 17 organisational Event types", () => {
    expect(
      formatEventType(
        "business.order.accepted"
      )
    ).toBe(
      "Order Accepted"
    );

    expect(
      formatEventType(
        "business.stock.reserved"
      )
    ).toBe(
      "Stock Reserved"
    );
  });

  it("keeps existing audit-facing Event labels", () => {
    expect(
      formatEventType(
        "risk.assessed"
      )
    ).toBe(
      "Risk Assessed"
    );

    expect(
      formatEventType(
        "policy.evaluated"
      )
    ).toBe(
      "Governance Check"
    );

    expect(
      formatEventType(
        "job.approved"
      )
    ).toBe(
      "Approval Granted"
    );
  });

  it("reads flag values from Event command args", () => {
    expect(
      getEventFlagValue(
        [
          "Order Accepted",
          "--source",
          "Order Processing",
          "--enterprise",
          "Online Retailer",
        ],
        "--source"
      )
    ).toBe(
      "Order Processing"
    );

    expect(
      getEventFlagValue(
        [
          "Order Accepted",
          "--enterprise=Online Retailer",
        ],
        "--enterprise"
      )
    ).toBe(
      "Online Retailer"
    );
  });

  it("formats Chapter 18 delegation Event types", () => {
    expect(
      formatEventType(
        "delegation.requested"
      )
    ).toBe(
      "Delegation Requested"
    );

    expect(
      formatEventType(
        "delegation.completed"
      )
    ).toBe(
      "Delegation Completed"
    );
  });

  it("creates a scoped Job-completion Event rule from flags", () => {
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

    const rule =
      addEventRuleFromArgs([
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

    expect(rule).toMatchObject({
      enterpriseId:
        enterprise.id,
      sourceBusinessFunctionId:
        `${enterprise.id}:function-1`,
      triggerType:
        "job.completed",
      requiredCapability:
        "web-research",
      publishedEventLabel:
        "Science evidence ready",
    });
    expect(
      formatEventRule(
        rule
      )
    ).toContain(
      "Verified governed Web Search evidence"
    );
  });
});
