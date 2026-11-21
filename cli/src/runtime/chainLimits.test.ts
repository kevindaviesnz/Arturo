import { describe, expect, it } from "vitest";
import * as limits from "./chainLimits";
import { MAX_ROUTE_STEPS as routeStepsFromPassOn, PASS_ON_STEPS as passOnStepsFromPassOn } from "./passOnRules";

describe("chain limits", () => {
  it("keeps the agreed values", () => {
    expect(limits.MAX_CHAIN_DEPTH).toBe(6);
    expect(limits.AI_IN_A_ROW).toEqual({ business: 4, matter: 2, chosenOnMatter: 1 });
    expect(limits.MAX_PLAN_STEPS).toBe(4);
    expect(limits.MAX_LOOP_ROUNDS).toBe(5);
    expect(limits.PASS_ON_STEPS).toBe(1);
    expect(limits.MAX_ROUTE_STEPS).toBe(2);
    expect(limits.MAX_DAILY_STARTS).toBe(20);
    expect(limits.MAX_AWAITING_SIGNOFF).toBe(3);
    expect(limits.SWITCH_ON_COOLING_OFF_HOURS).toBe(12);
  });

  it("orders them: AI-in-a-row <= plan steps <= chain depth, with 1 <= 2 <= 4", () => {
    const { chosenOnMatter, matter, business } = limits.AI_IN_A_ROW;
    expect(chosenOnMatter).toBeLessThanOrEqual(matter);
    expect(matter).toBeLessThanOrEqual(business);
    expect(business).toBeLessThanOrEqual(limits.MAX_PLAN_STEPS);
    expect(limits.MAX_PLAN_STEPS).toBeLessThanOrEqual(limits.MAX_CHAIN_DEPTH);
    expect(limits.PASS_ON_STEPS).toBeLessThanOrEqual(limits.MAX_ROUTE_STEPS);
    // A route (its first Function plus its steps) fits inside one chain.
    expect(limits.MAX_ROUTE_STEPS + 1).toBeLessThanOrEqual(limits.MAX_CHAIN_DEPTH);
    expect(limits.MAX_LOOP_ROUNDS).toBeLessThanOrEqual(limits.MAX_CHAIN_DEPTH);
  });

  it("is the only home of the route and pass-on limits", () => {
    expect(routeStepsFromPassOn).toBe(limits.MAX_ROUTE_STEPS);
    expect(passOnStepsFromPassOn).toBe(limits.PASS_ON_STEPS);
  });

  it("has retired the old follow-on limit of 3", async () => {
    const chain = await import("./followUpChain");
    expect(chain).not.toHaveProperty("MAX_FOLLOW_UP_DEPTH");
  });
});
