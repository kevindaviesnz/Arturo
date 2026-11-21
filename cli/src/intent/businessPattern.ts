export type BusinessPatternId =
  | "product_company"
  | "professional_services"
  | "content_business"
  | "consultancy"
  | "agency"
  | "saas"
  | "marketplace"
  | "education"
  | "internal_operations"
  | "unknown";

export type BusinessPattern = {
  readonly id: BusinessPatternId;
  readonly label: string;
  readonly description: string;
  readonly exampleRequests: readonly string[];
};

export const BUSINESS_PATTERNS: readonly BusinessPattern[] = [
  {
    id: "product_company",
    label: "Product Company",
    description: "Creates, validates, launches, sells, and improves physical or digital products.",
    exampleRequests: [
      "Build me a fast fashion business",
      "Create an AI-native toy company",
      "Launch a sustainable clothing brand",
    ],
  },
  {
    id: "professional_services",
    label: "Professional Services",
    description: "Delivers expert client services such as legal, accounting, advisory, or specialist practice work.",
    exampleRequests: [
      "Build an AI-native sole law practice",
      "Create a legal services business",
      "Start an accounting practice",
    ],
  },
  {
    id: "content_business",
    label: "Content Business",
    description: "Researches, creates, edits, publishes, and promotes recurring content.",
    exampleRequests: [
      "Create an article writing business",
      "Write daily news summaries",
      "Run a niche newsletter",
    ],
  },
  {
    id: "consultancy",
    label: "Consultancy",
    description: "Handles leads, qualification, proposals, delivery, follow-up, and client operations.",
    exampleRequests: [
      "Create a mentoring business",
      "Run an AI consultancy",
      "Handle leads and proposals",
    ],
  },
  {
    id: "agency",
    label: "Agency",
    description: "Manages client acquisition, briefs, production, review, delivery, and reporting.",
    exampleRequests: [
      "Create a marketing agency",
      "Run a design agency",
    ],
  },
  {
    id: "saas",
    label: "SaaS",
    description: "Builds, launches, supports, monitors, and improves software products.",
    exampleRequests: [
      "Create a SaaS startup",
      "Build a subscription app",
    ],
  },
  {
    id: "marketplace",
    label: "Marketplace",
    description: "Coordinates buyers, sellers, supply, demand, trust, support, and transactions.",
    exampleRequests: [
      "Create a marketplace for tutors",
      "Build an Etsy-style platform",
    ],
  },
  {
    id: "education",
    label: "Education",
    description: "Creates learning material, lessons, assessments, feedback loops, and student support.",
    exampleRequests: [
      "Create an online course business",
      "Teach users Hebrew every day",
    ],
  },
  {
    id: "internal_operations",
    label: "Internal Operations",
    description: "Improves repeatable internal company processes, reporting, reviews, and coordination.",
    exampleRequests: [
      "Automate weekly reports",
      "Improve our hiring process",
    ],
  },
  {
    id: "unknown",
    label: "Unknown",
    description: "No confident supported business pattern found.",
    exampleRequests: [],
  },
];

/**
 * Purpose: Finds a business pattern by id.
 *
 * Params:
 * - id: Business pattern id.
 *
 * Returns:
 * - Matching business pattern.
 *
 * PURE: No side effects.
 */
export function findBusinessPattern(
  id: BusinessPatternId
): BusinessPattern {
  return (
    BUSINESS_PATTERNS.find(
      (pattern) => pattern.id === id
    ) ??
    BUSINESS_PATTERNS[
      BUSINESS_PATTERNS.length - 1
    ]
  );
}