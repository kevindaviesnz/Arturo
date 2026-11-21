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
