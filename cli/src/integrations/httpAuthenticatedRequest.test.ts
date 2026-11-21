import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createApiSecret,
} from "./apiSecret";

import {
  addApiSecret,
  createApiSecretStore,
} from "./apiSecretStore";

import {
  createHttpGetRequest,
} from "./httpCapabilityAdapter";

import {
  resolveHttpRequestAuthHeaders,
} from "./httpAuthenticatedRequest";

describe("httpAuthenticatedRequest", () => {
  it("returns empty headers without auth", () => {
    expect(
      resolveHttpRequestAuthHeaders(
        createApiSecretStore(),
        createHttpGetRequest(
          "https://example.com/api",
          1000
        )
      )
    ).toEqual({
      ok: true,
      headers: {},
    });
  });

  it("resolves bearer token header", () => {
    const store =
      addApiSecret(
        createApiSecretStore(),
        createApiSecret(
          "openai",
          "secret-value"
        )
      );

    expect(
      resolveHttpRequestAuthHeaders(
        store,
        createHttpGetRequest(
          "https://example.com/api",
          1000,
          {
            bearerTokenSecretName:
              "openai",
          }
        )
      )
    ).toEqual({
      ok: true,
      headers: {
        authorization:
          "Bearer secret-value",
      },
    });
  });

  it("fails when secret is missing", () => {
    expect(
      resolveHttpRequestAuthHeaders(
        createApiSecretStore(),
        createHttpGetRequest(
          "https://example.com/api",
          1000,
          {
            bearerTokenSecretName:
              "missing",
          }
        )
      )
    ).toEqual({
      ok: false,
      error:
        "Secret 'missing' not found",
    });
  });
});