import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createHttpFailureResult,
  createHttpGetRequest,
  createHttpSuccessResult,
  createHttpResultFromResponse,
  parseHttpJsonBody,
  validateHttpCapabilityRequest,
  isAllowedLocalHttpUrl,
  validateHttpDestinationAddresses,
} from "./httpCapabilityAdapter";

describe("httpCapabilityAdapter", () => {
  it("creates GET request", () => {
    expect(
      createHttpGetRequest(
        "https://example.com/api",
        1000
      )
    ).toEqual({
      method: "GET",
      url: "https://example.com/api",
      timeoutMs: 1000,
    });
  });

  it("creates GET request with auth reference", () => {
    expect(
      createHttpGetRequest(
        "https://example.com/api",
        1000,
        {
          bearerTokenSecretName:
            "openai",
        }
      )
    ).toEqual({
      method: "GET",
      url: "https://example.com/api",
      timeoutMs: 1000,
      auth: {
        bearerTokenSecretName:
          "openai",
      },
    });
  });

  it("creates success result", () => {
    expect(
      createHttpSuccessResult(
        200,
        {
          ok: true,
        }
      )
    ).toEqual({
      ok: true,
      status: 200,
      body: {
        ok: true,
      },
    });
  });

  it("creates failure result", () => {
    expect(
      createHttpFailureResult(
        "Request failed",
        500
      )
    ).toEqual({
      ok: false,
      error: "Request failed",
      status: 500,
    });
  });

  it("accepts valid HTTPS GET request", () => {
    expect(
      validateHttpCapabilityRequest(
        createHttpGetRequest(
          "https://example.com/api",
          1000
        )
      )
    ).toBeUndefined();
  });

  it("rejects non-HTTPS URL", () => {
    expect(
      validateHttpCapabilityRequest(
        createHttpGetRequest(
          "http://example.com/api",
          1000
        )
      )
    ).toEqual({
      ok: false,
      error: "Only HTTPS or local HTTP URLs are allowed",
    });
  });

  it("does not mistake a deceptive hostname for localhost", () => {
    expect(
      isAllowedLocalHttpUrl(
        "http://localhost.attacker.example/api"
      )
    ).toBe(false);
  });

  it.each([
    "https://127.0.0.1/api",
    "https://10.0.0.1/api",
    "https://169.254.169.254/latest/meta-data",
    "https://192.168.1.2/api",
    "https://[::1]/api",
  ])("rejects private HTTPS destination %s", (url) => {
    expect(
      validateHttpCapabilityRequest(
        createHttpGetRequest(url, 1000)
      )
    ).toEqual({
      ok: false,
      error:
        "Private and local HTTPS destinations are not allowed",
    });
  });

  it("rejects invalid timeout", () => {
    expect(
      validateHttpCapabilityRequest(
        createHttpGetRequest(
          "https://example.com/api",
          0
        )
      )
    ).toEqual({
      ok: false,
      error:
        "Timeout must be greater than zero",
    });
  });

  it("rejects an allowlisted hostname that resolves to a private address", async () => {
    await expect(
      validateHttpDestinationAddresses(
        createHttpGetRequest("https://example.com/api", 1000),
        async () => ["127.0.0.1"]
      )
    ).resolves.toEqual({
      ok: false,
      error: "HTTPS destination resolves to a private or non-public address",
    });
  });

  it("accepts an allowlisted hostname only when every resolved address is public", async () => {
    await expect(
      validateHttpDestinationAddresses(
        createHttpGetRequest("https://example.com/api", 1000),
        async () => ["93.184.216.34"]
      )
    ).resolves.toBeUndefined();
  });

  it("parses JSON response body", () => {
    expect(
      parseHttpJsonBody(
        "{\"ok\":true}"
      )
    ).toEqual({
      ok: true,
      status: 200,
      body: {
        ok: true,
      },
    });
  });

  it("rejects invalid JSON response body", () => {
    expect(
      parseHttpJsonBody(
        "not-json"
      )
    ).toEqual({
      ok: false,
      error:
        "Response body is not valid JSON",
    });
  });

  it("creates success result from HTTP response", () => {
    expect(
      createHttpResultFromResponse(
        200,
        "{\"ok\":true}"
      )
    ).toEqual({
      ok: true,
      status: 200,
      body: {
        ok: true,
      },
    });
  });

  it("creates failure result from HTTP error status", () => {
    expect(
      createHttpResultFromResponse(
        500,
        "{\"error\":true}"
      )
    ).toEqual({
      ok: false,
      error:
        "HTTP request failed with status 500",
      status: 500,
    });
  });

  it("creates failure result from invalid JSON response", () => {
    expect(
      createHttpResultFromResponse(
        200,
        "not-json"
      )
    ).toEqual({
      ok: false,
      status: 200,
      error:
        "Response body is not valid JSON",
    });
  });
});
