import {
  describe,
  expect,
  it,
} from "vitest";

import {
  PRODUCT_COMPANY_FUNCTIONS,
  resolveBusinessFunctions,
} from "./businessFunction";

describe("businessFunction", () => {
  it("defines product company business functions", () => {
    expect(
      PRODUCT_COMPANY_FUNCTIONS.map(
        (businessFunction) =>
          businessFunction.id
      )
    ).toEqual([
      "business_strategy",
      "market_research",
      "trend_analysis",
      "product_design",
      "supply_chain",
      "brand_positioning",
      "go_to_market",
      "risk_review",
      "continuous_operation",
    ]);
  });

  it("resolves product company functions", () => {
    expect(
      resolveBusinessFunctions(
        "product_company"
      )
    ).toEqual({
      businessPatternId:
        "product_company",
      functions:
        PRODUCT_COMPANY_FUNCTIONS,
    });
  });

  it("returns an empty function plan for unsupported patterns", () => {
    expect(
      resolveBusinessFunctions(
        "unknown"
      )
    ).toEqual({
      businessPatternId:
        "unknown",
      functions:
        [],
    });
  });
});