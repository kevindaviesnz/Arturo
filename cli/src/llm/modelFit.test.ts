import { describe, expect, it } from "vitest";

import {
  assessModelFit,
  describeModelUnfit,
  machineMemoryGb,
} from "./modelFit";

describe("whether a local model can run here", () => {
  it("refuses the case this exists for: a 70B model on a 16 GB machine", () => {
    expect(
      assessModelFit({ approximateGb: 40, machineGb: 16 }).fits
    ).toBe(false);
  });

  it("allows the small models a 16 GB machine runs comfortably", () => {
    for (const approximateGb of [2, 4, 5]) {
      expect(
        assessModelFit({ approximateGb, machineGb: 16 }).fits
      ).toBe(true);
    }
  });

  it("allows a 70B model on the machine size it actually needs", () => {
    expect(
      assessModelFit({ approximateGb: 40, machineGb: 64 }).fits
    ).toBe(true);
  });

  it("counts working memory on top of the weights, not just the download", () => {
    // 11 GB of weights fits inside 12 GB of usable memory only if the KV cache
    // and runner overhead are ignored, which is how a model that downloads
    // successfully then fails to run.
    const fit = assessModelFit({ approximateGb: 11, machineGb: 16 });
    expect(fit.needsGb).toBeGreaterThan(11);
    expect(fit.fits).toBe(false);
  });

  it("gives the operator both numbers, not just a refusal", () => {
    const reason = describeModelUnfit({
      model: "llama3.3",
      approximateGb: 40,
      machineGb: 16,
    });
    expect(reason).toContain("llama3.3");
    expect(reason).toContain("16 GB");
    expect(reason).toContain("would not run");
  });

  it("says nothing when the model fits, so the caller may continue", () => {
    expect(
      describeModelUnfit({ model: "llama3.2", approximateGb: 2, machineGb: 16 })
    ).toBeUndefined();
  });

  it("reads a plausible size for the machine it is running on", () => {
    expect(machineMemoryGb()).toBeGreaterThan(0.5);
  });
});
