import {
  describe,
  expect,
  it,
} from "vitest";

import {
  completeDelegationRequest,
  createDelegationRequest,
  formatDelegationOwnership,
  formatDelegationRequest,
  formatDelegationSummary,
} from "./delegation";

describe("delegation", () => {
  it("creates a bounded delegation request", () => {
    expect(
      createDelegationRequest({
        id:
          "delegation-1",
        fromBusinessFunction:
          "Customer Support",
        toBusinessFunction:
          "Translation",
        work:
          "Translate this customer message.",
        now:
          123,
      })
    ).toEqual({
      id:
        "delegation-1",
      fromBusinessFunction:
        "Customer Support",
      toBusinessFunction:
        "Translation",
      work:
        "Translate this customer message.",
      status:
        "requested",
      createdAt:
        123,
    });
  });

  it("completes a delegation request with a bounded result", () => {
    const request =
      createDelegationRequest({
        id:
          "delegation-1",
        fromBusinessFunction:
          "Customer Support",
        toBusinessFunction:
          "Translation",
        work:
          "Translate this customer message.",
        now:
          123,
      });

    expect(
      completeDelegationRequest(
        request,
        "Translated message.",
        456
      )
    ).toEqual({
      ...request,
      status:
        "completed",
      result:
        "Translated message.",
      completedAt:
        456,
    });
  });

  it("keeps accountability with the delegating Business Function", () => {
    const request =
      createDelegationRequest({
        id:
          "delegation-1",
        fromBusinessFunction:
          "Customer Support",
        toBusinessFunction:
          "Translation",
        work:
          "Translate this customer message.",
        now:
          123,
      });

    expect(
      formatDelegationOwnership(
        request
      )
    ).toBe(
      "Customer Support is still answerable for it"
    );
  });

  it("formats Chapter 18 delegation output", () => {
    const request =
      completeDelegationRequest(
        createDelegationRequest({
          id:
            "delegation-1",
          fromBusinessFunction:
            "Customer Support",
          toBusinessFunction:
            "Translation",
          work:
            "Translate this customer message.",
          now:
            123,
        }),
        "Translation completed.",
        456
      );

    expect(
      formatDelegationRequest(
        request
      )
    ).toBe(
      [
        "Delegation completed.",
        "",
        "  ID:          delegation-1",
        "  From:        Customer Support",
        "  To:          Translation",
        "  Work:        Translate this customer message.",
        "  Answerable:  Customer Support is still answerable for it",
        "  Status:      Done",
        "  Result:      Translation completed.",
      ].join("\n")
    );
  });

  it("formats compact list output without repeating the full result", () => {
    const request = completeDelegationRequest(
      createDelegationRequest({
        id: "delegation-1",
        fromBusinessFunction: "Customer Support",
        toBusinessFunction: "Translation",
        work: "Translate this customer message.",
        now: 123,
      }),
      "A very long translated result.",
      456
    );

    const summary = formatDelegationSummary(request, 0);
    expect(summary).toContain("1. Customer Support → Translation · Done");
    expect(summary).toContain("Customer Support → Translation");
    expect(summary).toContain("ID: delegation-1");
    expect(summary).not.toContain("A very long translated result.");
  });
});
