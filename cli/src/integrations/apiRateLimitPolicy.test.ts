import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createApiRateLimitPolicy,
  isApiRequestAllowed,
  validateApiRateLimitPolicy,
} from "./apiRateLimitPolicy";

describe("apiRateLimitPolicy", () => {
  it("creates rate limit policy", () => {
    expect(
      createApiRateLimitPolicy(
        10,
        60000
      )
    ).toEqual({
      maxRequests: 10,
      windowMs: 60000,
    });
  });

  it("rejects invalid max requests", () => {
    expect(
      validateApiRateLimitPolicy(
        createApiRateLimitPolicy(
          0,
          60000
        )
      )
    ).toEqual({
      ok: false,
      error:
        "Rate limit max requests must be at least 1",
    });
  });

  it("rejects invalid window", () => {
    expect(
      validateApiRateLimitPolicy(
        createApiRateLimitPolicy(
          10,
          0
        )
      )
    ).toEqual({
      ok: false,
      error:
        "Rate limit window must be greater than zero",
    });
  });

  it("accepts valid policy", () => {
    expect(
      validateApiRateLimitPolicy(
        createApiRateLimitPolicy(
          10,
          60000
        )
      )
    ).toEqual({
      ok: true,
    });
  });

  it("allows request under limit", () => {
    expect(
      isApiRequestAllowed(
        [
          1000,
          2000,
        ],
        3000,
        createApiRateLimitPolicy(
          3,
          60000
        )
      )
    ).toBe(true);
  });

  it("rejects request at limit", () => {
    expect(
      isApiRequestAllowed(
        [
          1000,
          2000,
          3000,
        ],
        4000,
        createApiRateLimitPolicy(
          3,
          60000
        )
      )
    ).toBe(false);
  });

  it("ignores timestamps outside window", () => {
    expect(
      isApiRequestAllowed(
        [
          1000,
          2000,
        ],
        70000,
        createApiRateLimitPolicy(
          1,
          60000
        )
      )
    ).toBe(true);
  });
});