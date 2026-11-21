import {
  buildReviewUrl,
  getPublicBaseUrl,
  normalizePublicBaseUrl,
} from "./publicUrl";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

describe("publicUrl", () => {
  const originalPublicBaseUrl =
    process.env.PUBLIC_BASE_URL;

  afterEach(() => {
    if (
      originalPublicBaseUrl ===
      undefined
    ) {
      delete process.env.PUBLIC_BASE_URL;
    } else {
      process.env.PUBLIC_BASE_URL =
        originalPublicBaseUrl;
    }
  });

  it("removes trailing slash", () => {
    expect(
      normalizePublicBaseUrl(
        "https://example.com/"
      )
    ).toBe("https://example.com");
  });

  it("removes multiple trailing slashes", () => {
    expect(
      normalizePublicBaseUrl(
        "https://example.com///"
      )
    ).toBe("https://example.com");
  });

  it("uses localhost fallback", () => {
    delete process.env.PUBLIC_BASE_URL;

    expect(
      getPublicBaseUrl()
    ).toBe("http://localhost:8788");
  });

  it("uses PUBLIC_BASE_URL when set", () => {
    process.env.PUBLIC_BASE_URL =
      "https://abc.ngrok-free.dev";

    expect(
      getPublicBaseUrl()
    ).toBe(
      "https://abc.ngrok-free.dev"
    );
  });

  it("builds a review URL", () => {
    process.env.PUBLIC_BASE_URL =
      "https://abc.ngrok-free.dev";

    expect(
      buildReviewUrl(
        "job-123",
        "token-abc"
      )
    ).toBe(
      "https://abc.ngrok-free.dev/review/job-123?token=token-abc"
    );
  });

  it("encodes job id and token", () => {
    process.env.PUBLIC_BASE_URL =
      "https://abc.ngrok-free.dev";

    expect(
      buildReviewUrl(
        "job 123",
        "token/value"
      )
    ).toBe(
      "https://abc.ngrok-free.dev/review/job%20123?token=token%2Fvalue"
    );
  });
});