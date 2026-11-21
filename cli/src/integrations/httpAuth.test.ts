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
  createBearerTokenAuth,
  resolveHttpAuthHeaders,
} from "./httpAuth";

describe("httpAuth", () => {
  it("creates bearer token auth input", () => {
    expect(
      createBearerTokenAuth(
        "openai"
      )
    ).toEqual({
      bearerToken: {
        secretName: "openai",
      },
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
      resolveHttpAuthHeaders(
        store,
        createBearerTokenAuth(
          "openai"
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

  it("returns empty headers when auth missing", () => {
    expect(
      resolveHttpAuthHeaders(
        createApiSecretStore(),
        {}
      )
    ).toEqual({
      ok: true,
      headers: {},
    });
  });

  it("returns failure when secret missing", () => {
    expect(
      resolveHttpAuthHeaders(
        createApiSecretStore(),
        createBearerTokenAuth(
          "missing"
        )
      )
    ).toEqual({
      ok: false,
      error:
        "Secret 'missing' not found",
    });
  });
});