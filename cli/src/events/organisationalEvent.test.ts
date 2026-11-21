import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createDefaultOrganisationalEventReactions,
  createOrganisationalEventReactions,
  createOrganisationalRuntimeEventInput,
  formatOrganisationalEventMessage,
  organisationalEventType,
  reactionMatchesEvent,
} from "./organisationalEvent";

describe("organisationalEvent", () => {
  it("converts arbitrary Event labels into stable business Event types", () => {
    expect(
      organisationalEventType(
        "Order Accepted"
      )
    ).toBe(
      "business.order.accepted"
    );

    expect(
      organisationalEventType(
        "Loan Application Submitted"
      )
    ).toBe(
      "business.loan.application.submitted"
    );

    expect(
      organisationalEventType(
        "Support Ticket Escalated"
      )
    ).toBe(
      "business.support.ticket.escalated"
    );
  });

  it("formats organisational Event messages", () => {
    expect(
      formatOrganisationalEventMessage({
        label: "Order Accepted",
        sourceBusinessFunction:
          "Order Processing",
        enterpriseName:
          "Online Retailer",
      })
    ).toBe(
      "Order Accepted — source: Order Processing — enterprise: Online Retailer"
    );
  });

  it("converts organisational Events into runtime Events with payload", () => {
    expect(
      createOrganisationalRuntimeEventInput(
        {
          label: "Loan Application Submitted",
          sourceBusinessFunction:
            "Loan Origination",
          enterpriseName:
            "Autonomous Bank",
          payload: {
            applicationId: "LOAN-48213",
          },
        },
        "event-1",
        123
      )
    ).toEqual({
      id: "event-1",
      type: "business.loan.application.submitted",
      level: "success",
      message:
        "Loan Application Submitted — source: Loan Origination — enterprise: Autonomous Bank",
      timestamp: 123,
      payload: {
        enterpriseName:
          "Autonomous Bank",
        sourceBusinessFunction:
          "Loan Origination",
        fact:
          "Loan Application Submitted",
        applicationId:
          "LOAN-48213",
      },
    });
  });

  it("matches reactions by Event label and optional source Business Function", () => {
    expect(
      reactionMatchesEvent(
        {
          observedEventLabel:
            "Order Accepted",
          observedSourceBusinessFunction:
            "Order Processing",
          observingBusinessFunction:
            "Inventory",
          publishedEventLabel:
            "Stock Reserved",
        },
        {
          label:
            "Order Accepted",
          sourceBusinessFunction:
            "Order Processing",
          enterpriseName:
            "Online Retailer",
        }
      )
    ).toBe(true);
  });

  it("does not match reactions when the source Business Function differs", () => {
    expect(
      reactionMatchesEvent(
        {
          observedEventLabel:
            "Order Accepted",
          observedSourceBusinessFunction:
            "Order Processing",
          observingBusinessFunction:
            "Inventory",
          publishedEventLabel:
            "Stock Reserved",
        },
        {
          label:
            "Order Accepted",
          sourceBusinessFunction:
            "Customer Support",
          enterpriseName:
            "Online Retailer",
        }
      )
    ).toBe(false);
  });

  it("creates follow-up Events from matching reaction rules", () => {
    expect(
      createOrganisationalEventReactions(
        {
          label:
            "Order Accepted",
          sourceBusinessFunction:
            "Order Processing",
          enterpriseName:
            "Online Retailer",
        },
        createDefaultOrganisationalEventReactions()
      )
    ).toEqual([
      {
        label:
          "Stock Reserved",
        sourceBusinessFunction:
          "Inventory",
        enterpriseName:
          "Online Retailer",
        payload:
          undefined,
      },
    ]);
  });

  it("supports non-retail scenarios through generic reaction rules", () => {
    expect(
      createOrganisationalEventReactions(
        {
          label:
            "Loan Application Submitted",
          sourceBusinessFunction:
            "Loan Origination",
          enterpriseName:
            "Autonomous Bank",
        },
        [
          {
            observedEventLabel:
              "Loan Application Submitted",
            observedSourceBusinessFunction:
              "Loan Origination",
            observingBusinessFunction:
              "Credit Risk",
            publishedEventLabel:
              "Credit Risk Assessed",
          },
        ]
      )
    ).toEqual([
      {
        label:
          "Credit Risk Assessed",
        sourceBusinessFunction:
          "Credit Risk",
        enterpriseName:
          "Autonomous Bank",
        payload:
          undefined,
      },
    ]);
  });
});