import {
  describe,
  expect,
  it,
} from "vitest";

import {
  executeHttpCapabilityRuntime,
} from "./httpCapabilityRuntime";

describe("httpCapabilityRuntime", () => {
  it("executes successful request", async () => {
    const result =
      await executeHttpCapabilityRuntime(
        {
          method: "GET",
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

  it("returns HTTP failure result", async () => {
    const result =
      await executeHttpCapabilityRuntime(
        {
          method: "GET",
          url: "https://example.com/api",
          timeoutMs: 1000,
        },
        async () => ({
          status: 500,
          text: async () =>
            "{\"error\":true}",
        })
      );

    expect(result).toEqual({
      ok: false,
      error:
        "HTTP request failed with status 500",
      status: 500,
    });
  });

  it("returns validation failure", async () => {
    const result =
      await executeHttpCapabilityRuntime(
        {
          method: "GET",
          url: "http://example.com/api",
          timeoutMs: 1000,
        },
        async () => ({
          status: 200,
          text: async () =>
            "{}",
        })
      );

    expect(result).toEqual({
      ok: false,
      error:
        "Only HTTPS or local HTTP URLs are allowed",
    });
  });

  it("handles invalid JSON response", async () => {
    const result =
      await executeHttpCapabilityRuntime(
        {
          method: "GET",
          url: "https://example.com/api",
          timeoutMs: 1000,
        },
        async () => ({
          status: 200,
          text: async () =>
            "not-json",
        })
      );

    expect(result).toEqual({
      ok: false,
      status: 200,
      error:
        "Response body is not valid JSON",
    });
  });
});