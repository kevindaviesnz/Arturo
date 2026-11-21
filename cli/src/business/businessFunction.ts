import type {
  AgentArchetype,
} from "../agents/agentArchetype";

import type {
  BusinessPatternId,
} from "../intent/businessPattern";

export type BusinessFunctionId =
  | "business_strategy"
  | "market_research"
  | "trend_analysis"
  | "product_design"
  | "supply_chain"
  | "brand_positioning"
  | "go_to_market"
  | "risk_review"
  | "continuous_operation";

export type BusinessFunction = {
  readonly id: BusinessFunctionId;
  readonly label: string;
  readonly description: string;
  readonly defaultArchetype: AgentArchetype;
};

export type BusinessFunctionPlan = {
  readonly businessPatternId: BusinessPatternId;
  readonly functions: readonly BusinessFunction[];
};

export const PRODUCT_COMPANY_FUNCTIONS: readonly BusinessFunction[] = [
  {
    id: "business_strategy",
    label: "Business Strategy",
    description: "Define the business model, operating assumptions, priorities, and validation path.",
    defaultArchetype: "planner",
  },
  {
    id: "market_research",
    label: "Market Research",
    description: "Research target customers, competitors, market context, and demand signals.",
    defaultArchetype: "researcher",
  },
  {
    id: "trend_analysis",
    label: "Trend Analysis",
    description: "Analyse trends, pricing, positioning, customer preferences, and opportunity areas.",
    defaultArchetype: "analyst",
  },
  {
    id: "product_design",
    label: "Product Design",
    description: "Create product concepts, descriptions, specifications, and draft launch materials.",
    defaultArchetype: "creator",
  },
  {
    id: "supply_chain",
    label: "Supply Chain",
    description: "Assess sourcing, manufacturing, fulfilment, supplier risks, and cost constraints.",
    defaultArchetype: "analyst",
  },
  {
    id: "brand_positioning",
    label: "Brand Positioning",
    description: "Define brand positioning, customer promise, messaging, and differentiation.",
    defaultArchetype: "advisor",
  },
  {
    id: "go_to_market",
    label: "Go-to-Market",
    description: "Plan launch channels, campaign approach, sales motion, and early traction strategy.",
    defaultArchetype: "advisor",
  },
  {
    id: "risk_review",
    label: "Risk Review",
    description: "Review legal, safety, compliance, reputational, supplier, and execution risks.",
    defaultArchetype: "guardian",
  },
  {
    id: "continuous_operation",
    label: "Continuous Operation",
    description: "Define recurring operating loops for monitoring, product iteration, reviews, and decisions.",
    defaultArchetype: "planner",
  },
];

/**
 * Purpose: Resolves business functions for a known business pattern.
 *
 * Params:
 * - businessPatternId: Business pattern id.
 *
 * Returns:
 * - Business function plan for the pattern.
 *
 * PURE: No side effects.
 */
export function resolveBusinessFunctions(
  businessPatternId: BusinessPatternId
): BusinessFunctionPlan {
  if (businessPatternId === "product_company") {
    return {
      businessPatternId,
      functions: PRODUCT_COMPANY_FUNCTIONS,
    };
  }

  return {
    businessPatternId,
    functions: [],
  };
}