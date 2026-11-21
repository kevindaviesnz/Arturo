import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createApiRetryPolicy,
  shouldRetryApiRequest,
  validateApiRetryPolicy,
} from "./apiRetryPolicy";

describe("apiRetryPolicy", () => {
  it("creates retry policy", () => {
    expect(
      createApiRetryPolicy(3, 100)
    ).toEqual({
      maxAttempts: 3,
      delayMs: 100,
    });
  });

  it("rejects invalid max attempts", () => {
    expect(
      validateApiRetryPolicy(
        createApiRetryPolicy(0, 100)
      )
    ).toEqual({
      ok: false,
      error:
        "Retry max attempts must be at least 1",
    });
  });

  it("rejects negative delay", () => {
    expect(
      validateApiRetryPolicy(
        createApiRetryPolicy(3, -1)
      )
    ).toEqual({
      ok: false,
      error:
        "Retry delay must not be negative",
    });
  });

  it("accepts valid retry policy", () => {
    expect(
      validateApiRetryPolicy(
        createApiRetryPolicy(3, 100)
      )
    ).toEqual({
      ok: true,
    });
  });

  it("allows retry before max attempts", () => {
    expect(
      shouldRetryApiRequest(
        1,
        createApiRetryPolicy(3, 100)
      )
    ).toBe(true);
  });

  it("rejects retry at max attempts", () => {
    expect(
      shouldRetryApiRequest(
        3,
        createApiRetryPolicy(3, 100)
      )
    ).toBe(false);
  });
});