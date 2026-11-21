import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadOrCreateApprovalSigningSecret } from "./approvalSigningSecret";

const directory = path.join(os.tmpdir(), `arturo-secret-test-${process.pid}`);
const filePath = path.join(directory, "approval-secret");

afterEach(() => {
  fs.rmSync(directory, { recursive: true, force: true });
});

describe("approvalSigningSecret", () => {
  it("creates and reuses a private strong local secret", () => {
    const first = loadOrCreateApprovalSigningSecret(filePath);
    const second = loadOrCreateApprovalSigningSecret(filePath);
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(second).toBe(first);
    expect(fs.statSync(filePath).mode & 0o777).toBe(0o600);
  });
});
