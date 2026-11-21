import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { runtimeDb } from "../storage/runtimeDatabase";
import {
  STANDING_REFUSAL_CODES,
  STANDING_REFUSAL_WORDING,
  currentProviderPolicy,
  refuseStandingPermission,
  sameProviderPolicy,
  setterStillSigns,
  standingRefusal,
} from "./standingPermission";

const reset = () => {
  clearWorkers();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
};
const worksAt = (workerName: string, enterpriseId: string) =>
  runtimeDb.prepare("INSERT INTO enterprise_worker_memberships VALUES(?,?,NULL)").run(workerName, enterpriseId);

describe("a standing permission (B9)", () => {
  beforeEach(() => {
    reset();
    addWorker(createHumanWorker("Amy Wise", "guardian"));
    worksAt("Amy Wise", "e-1");
  });
  afterEach(reset);

  it("has a fixed code and fixed wording for every refusal", () => {
    for (const code of STANDING_REFUSAL_CODES) {
      expect(standingRefusal(code, { what: "The route set on Drafting" })).toEqual({ code, message: STANDING_REFUSAL_WORDING[code]({ what: "The route set on Drafting" }) });
    }
    expect(standingRefusal("permission_withdrawn", { what: "The route set on Drafting" }).message).toBe("The route set on Drafting was withdrawn, so nothing more goes on under it.");
    expect(standingRefusal("permission_withdrawn", { what: "The route set on Drafting", by: "Amy Wise", at: 1_700_000_000_000 }).message).toMatch(/^The route set on Drafting was withdrawn by Amy Wise at .+, so nothing more goes on under it\.$/);
  });

  it("holds only while the setter works at the business and can still sign off", () => {
    expect(setterStillSigns("e-1", "amy wise")).toBe(true);
    expect(setterStillSigns("e-1", "")).toBe(false);
    expect(setterStillSigns("e-2", "Amy Wise")).toBe(false);
    runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
    expect(setterStillSigns("e-1", "Amy Wise")).toBe(false);
  });

  it("checks the business, then the setter, then the provider policy, in that order", () => {
    const now = currentProviderPolicy();
    const base = { what: "The route set on Drafting", enterpriseId: "e-1", setBy: "Amy Wise" };
    expect(refuseStandingPermission({ ...base, forEnterpriseId: "e-1", provider: now })).toBeUndefined();
    expect(refuseStandingPermission({ ...base, forEnterpriseId: "e-1" })).toBeUndefined();
    expect(refuseStandingPermission({ ...base, forEnterpriseId: "e-2", setBy: "Nobody" })?.code).toBe("permission_other_business");
    expect(refuseStandingPermission({ ...base, forEnterpriseId: "e-1", setBy: "Nobody", provider: "unbound" })?.code).toBe("permission_lapsed");
    expect(refuseStandingPermission({ ...base, forEnterpriseId: "e-1", provider: "unbound" })?.code).toBe("permission_provider_changed");
    const other = { ...now, model: `${now.model}-other` };
    expect(sameProviderPolicy(other, now)).toBe(false);
    expect(refuseStandingPermission({ ...base, forEnterpriseId: "e-1", provider: other })).toMatchObject({
      code: "permission_provider_changed",
      message: expect.stringContaining(`was set while Arturo used ${other.model}`),
    });
  });
});
