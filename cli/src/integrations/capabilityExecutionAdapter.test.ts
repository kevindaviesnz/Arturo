import {
  describe,
  expect,
  it,
} from "vitest";

import {
  capabilityExecutionAdapters,
  executeHttpGetCapability,
} from "./capabilityExecutionAdapter";

describe("capabilityExecutionAdapter", () => {
  it("registers http.get execution adapter", () => {
    expect(
      capabilityExecutionAdapters[
        "http.get"
      ]
    ).toBe(
      executeHttpGetCapability
    );
  });

  it("executes http.get adapter", async () => {
    const result =
      await executeHttpGetCapability(
        {
          url: "https://example.com/api",
          timeoutMs: 1000,
        },
        async () => ({
          status: 200,
          text: async () =>
            "{\"ok\":true}",
        })
      );

    expect(result).toEqual({
      ok: true,
      status: 200,
      body: {
        ok: true,
      },
    });
  });
});