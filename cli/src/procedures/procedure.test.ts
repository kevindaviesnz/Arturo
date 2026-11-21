import {
  describe,
  expect,
  it,
} from "vitest";

import {
  formatProcedureReference,
  parseProcedureReference,
  validateProcedureDocument,
  type ProcedureDocument,
} from "./procedure";

describe("procedure reference", () => {
  it("round-trips an exact-version reference", () => {
    expect(
      parseProcedureReference("proc-backup@4")
    ).toEqual({ procedureId: "proc-backup", version: 4 });
    expect(
      formatProcedureReference({ procedureId: "proc-backup", version: 4 })
    ).toBe("proc-backup@4");
  });

  it("rejects a reference without a version (no silent float)", () => {
    expect(() => parseProcedureReference("proc-backup")).toThrow();
    expect(() => parseProcedureReference("proc-backup@0")).toThrow();
    expect(() => parseProcedureReference("backup@1")).toThrow();
  });
});

describe("validateProcedureDocument", () => {
  const generative: ProcedureDocument = {
    procedureId: "proc-writeup",
    version: 1,
    mode: "generative",
    requiredCapabilities: ["writing"],
    prompt: "Write a concise summary.",
  };

  const deterministic: ProcedureDocument = {
    procedureId: "proc-backup",
    version: 1,
    mode: "deterministic",
    requiredCapabilities: ["shell-execute"],
    workflow: [
      { capability: "shell-execute", instruction: "Run the backup script." },
    ],
  };

  it("accepts a well-formed generative Procedure", () => {
    expect(validateProcedureDocument(generative)).toBeUndefined();
  });

  it("accepts a well-formed deterministic Procedure", () => {
    expect(validateProcedureDocument(deterministic)).toBeUndefined();
  });

  it("rejects a generative Procedure with no prompt", () => {
    expect(
      validateProcedureDocument({ ...generative, prompt: "  " })
    ).toContain("non-empty prompt");
  });

  it("rejects a deterministic Procedure with no steps", () => {
    expect(
      validateProcedureDocument({ ...deterministic, workflow: [] })
    ).toContain("at least one workflow step");
  });

  it("rejects a step capability outside the declared contract", () => {
    expect(
      validateProcedureDocument({
        ...deterministic,
        workflow: [
          { capability: "email-send", instruction: "Send it." },
        ],
      })
    ).toContain("not listed in requiredCapabilities");
  });
});
