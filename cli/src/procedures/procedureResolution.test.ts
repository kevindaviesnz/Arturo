import {
  afterEach,
  describe,
  expect,
  it,
} from "vitest";

import type {
  ProcedureDocument,
} from "./procedure";

import {
  clearProcedures,
  registerProcedure,
} from "./procedureStore";

import {
  resolveProcedureForExecution,
} from "./procedureResolution";

import {
  verifyProcedureSignature,
} from "./procedureSigning";

const SECRET = "procedure-secret-0000000000000000000";

const generative: ProcedureDocument = {
  procedureId: "proc-writeup",
  version: 1,
  mode: "generative",
  requiredCapabilities: ["writing"],
  prompt: "Write a concise summary of the input.",
};

const backup: ProcedureDocument = {
  procedureId: "proc-backup",
  version: 1,
  mode: "deterministic",
  requiredCapabilities: ["shell-execute"],
  workflow: [
    { capability: "shell-execute", instruction: "Run the client-Y backup." },
  ],
};

afterEach(() => {
  clearProcedures();
});

describe("resolveProcedureForExecution", () => {
  it("resolves a registered generative Procedure for an authorized Worker", () => {
    registerProcedure(generative, SECRET);
    const result = resolveProcedureForExecution(
      "proc-writeup@1",
      ["writing"],
      SECRET
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.document.mode).toBe("generative");
    }
  });

  it("fails closed when the Procedure is not found", () => {
    const result = resolveProcedureForExecution(
      "proc-writeup@1",
      ["writing"],
      SECRET
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain("not found");
  });

  it("fails closed when the Worker lacks a required capability", () => {
    registerProcedure(backup, SECRET);
    const result = resolveProcedureForExecution(
      "proc-backup@1",
      ["writing"], // no shell-execute
      SECRET
    );
    expect(result).toMatchObject({ ok: false });
    if (!result.ok) expect(result.reason).toContain("not authorized");
  });

  it("fails closed when the stored Procedure is tampered (integrity)", () => {
    const signed = registerProcedure(generative, SECRET);
    // The signature no longer matches a broadened capability set.
    const tampered = {
      ...signed,
      document: {
        ...signed.document,
        requiredCapabilities: ["writing", "shell-execute"],
      },
    };
    expect(verifyProcedureSignature(tampered, SECRET)).toBe(false);
  });

  it("registers a version immutably — no overwrite", () => {
    registerProcedure(generative, SECRET);
    expect(() => registerProcedure(generative, SECRET)).toThrow(/already exists/);
  });

  it("authorizes a deterministic Procedure (execution wiring is a follow-up)", () => {
    registerProcedure(backup, SECRET);
    const result = resolveProcedureForExecution(
      "proc-backup@1",
      ["shell-execute"],
      SECRET
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.document.mode).toBe("deterministic");
  });
});
