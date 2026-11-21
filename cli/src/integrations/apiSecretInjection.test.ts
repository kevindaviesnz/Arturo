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
  createSecretReference,
  resolveSecretReference,
} from "./apiSecretInjection";

describe("apiSecretInjection", () => {
  it("creates secret reference", () => {
    expect(
      createSecretReference(
        "openai"
      )
    ).toEqual({
      secretName: "openai",
    });
  });

  it("resolves secret reference", () => {
    const store =
      addApiSecret(
        createApiSecretStore(),
        createApiSecret(
          "openai",
          "secret-value"
        )
      );

    expect(
      resolveSecretReference(
        store,
        createSecretReference(
          "openai"
        )
      )
    ).toEqual({
      ok: true,
      value: "secret-value",
    });
  });

  it("returns failure for missing secret", () => {
    expect(
      resolveSecretReference(
        createApiSecretStore(),
        createSecretReference(
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