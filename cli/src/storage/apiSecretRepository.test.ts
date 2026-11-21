import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  createApiSecret,
} from "../integrations/apiSecret";

import {
  addApiSecret,
  createApiSecretStore,
} from "../integrations/apiSecretStore";

import {
  deserializeApiSecrets,
  loadApiSecrets,
  saveApiSecrets,
  serializeApiSecrets,
} from "./apiSecretRepository";

const testFilePath =
  path.join(
    os.tmpdir(),
    "Arturo-api-secrets-test.json"
  );

afterEach(() => {
  if (
    fs.existsSync(testFilePath)
  ) {
    fs.unlinkSync(testFilePath);
  }
});

describe("apiSecretRepository", () => {
  it("serializes secret store", () => {
    const store =
      addApiSecret(
        createApiSecretStore(),
        createApiSecret(
          "openai",
          "secret"
        )
      );

    expect(
      serializeApiSecrets(store)
    ).toBe(
      "{\"secrets\":{\"openai\":{\"name\":\"openai\",\"value\":\"secret\"}}}"
    );
  });

  it("deserializes secret store", () => {
    expect(
      deserializeApiSecrets(
        "{\"secrets\":{\"openai\":{\"name\":\"openai\",\"value\":\"secret\"}}}"
      )
    ).toEqual({
      openai: {
        name: "openai",
        value: "secret",
      },
    });
  });

  it("rejects invalid JSON", () => {
    expect(
      () => deserializeApiSecrets(
        "not-json"
      )
    ).toThrow();
  });

  it("saves and loads secrets", () => {
    const store =
      addApiSecret(
        createApiSecretStore(),
        createApiSecret(
          "openai",
          "secret"
        )
      );

    saveApiSecrets(
      testFilePath,
      store
    );

    expect(
      loadApiSecrets(
        testFilePath
      )
    ).toEqual(store);
  });

  it("returns empty store for missing file", () => {
    expect(
      loadApiSecrets(
        testFilePath
      )
    ).toEqual({});
  });

  it("rejects a corrupted file", () => {
    fs.writeFileSync(
      testFilePath,
      "not-json",
      "utf8"
    );

    expect(
      () => loadApiSecrets(
        testFilePath
      )
    ).toThrow();
  });

  it("writes secrets with owner-only permissions", () => {
    saveApiSecrets(
      testFilePath,
      addApiSecret(
        createApiSecretStore(),
        createApiSecret("openai", "secret")
      )
    );

    expect(
      fs.statSync(testFilePath).mode & 0o777
    ).toBe(0o600);

    expect(
      fs.readFileSync(testFilePath, "utf8")
    ).not.toContain("secret");
  });
});
