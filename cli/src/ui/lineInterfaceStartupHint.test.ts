import {
  describe,
  expect,
  it,
} from "vitest";

import {
  formatEmptyEnterpriseHint,
} from "./lineInterface";

describe("formatEmptyEnterpriseHint", () => {
  it("suggests the guided setup when there are no Enterprises", () => {
    const hint = formatEmptyEnterpriseHint(0);
    expect(hint).toBeDefined();
    // Bare /enterprise now opens the guided menu — no switch to memorise.
    expect(hint).toContain("/enterprise");
    expect(hint).not.toContain("--advise");
  });

  it("shows nothing once at least one Enterprise exists", () => {
    expect(formatEmptyEnterpriseHint(1)).toBeUndefined();
    expect(formatEmptyEnterpriseHint(5)).toBeUndefined();
  });
});

import { formatHandBackSessionLine } from "../staffing/handBack";

describe("formatHandBackSessionLine", () => {
  it("is a line until handed-back drafts are dealt with", () => {
    expect(formatHandBackSessionLine(0)).toBeUndefined();
    expect(formatHandBackSessionLine(3)).toBe("3 need a new signer — name a new signer from the staff menu.");
  });
});
