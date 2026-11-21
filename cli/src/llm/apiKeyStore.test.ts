import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  looksLikePlausibleKey,
  saveApiKey,
  upsertEnvLine,
} from "./apiKeyStore";

describe("looksLikePlausibleKey", () => {
  it("accepts a realistic key and rejects blanks, spaces, and placeholders", () => {
    expect(looksLikePlausibleKey("AIzaSyD-realistic-looking-key-1234")).toBe(true);
    expect(looksLikePlausibleKey("short")).toBe(false);
    expect(looksLikePlausibleKey("has space in it")).toBe(false);
    expect(looksLikePlausibleKey("<your-key>")).toBe(false);
    expect(looksLikePlausibleKey("your-api-key-here")).toBe(false);
  });
});

describe("upsertEnvLine", () => {
  it("adds a new key when absent", () => {
    expect(upsertEnvLine("A=1\n", "B", "2")).toBe("A=1\nB=2\n");
  });

  it("replaces an existing key in place, keeping other lines", () => {
    expect(upsertEnvLine("A=1\nB=old\nC=3\n", "B", "new")).toBe("A=1\nB=new\nC=3\n");
  });

  it("creates content from empty", () => {
    expect(upsertEnvLine("", "KEY", "v")).toBe("KEY=v\n");
  });
});

describe("saveApiKey", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "arturo-env-"));
  const envPath = path.join(dir, ".env");

  afterEach(() => {
    delete process.env.TEST_SAVE_KEY;
    if (fs.existsSync(envPath)) fs.rmSync(envPath);
  });

  it("writes the key to the env file and the running process, and does not log it", () => {
    saveApiKey("TEST_SAVE_KEY", "secret-value-123456", envPath);

    expect(fs.readFileSync(envPath, "utf8")).toContain("TEST_SAVE_KEY=secret-value-123456");
    expect(process.env.TEST_SAVE_KEY).toBe("secret-value-123456");
    // Written with restrictive permissions.
    expect(fs.statSync(envPath).mode & 0o777).toBe(0o600);
  });
});
