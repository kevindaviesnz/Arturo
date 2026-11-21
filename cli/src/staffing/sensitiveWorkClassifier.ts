import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
import type {
  BusinessFunctionDefinition,
} from "../business/businessFunctionDefinition";

/**
 * Decides which Functions do work that a person must sign off.
 *
 * The staffing prompt has always instructed the planner to "always propose
 * Human approval when a Function's work touches ... money leaving the business
 * ...". A walkthrough ran `/staff` three times against a Function called
 * `invoicing` and got one approval, then none, then — even when told outright
 * in `--instructions` that money was involved and a person must approve —
 * none again. Asked as one clause inside a large JSON planning task, the
 * requirement is simply dropped, and dropping it is silent.
 *
 * So it is asked on its own. Classification is a genuine semantic judgement and
 * belongs with the model, but it must be the model's only question, and the
 * decision that follows from the answer is made here.
 *
 * Fails closed: when the classification cannot be obtained or understood, every
 * Function is treated as needing a person. An unapproved financial or safety
 * action is a worse outcome than an approval the operator did not need.
 */

export type SensitiveCategory =
  | "vulnerable-people"
  | "safety-or-health"
  | "legal-or-regulatory"
  | "money"
  | "employment"
  | "published-in-the-enterprise-name";

const SENSITIVE_CATEGORIES: readonly SensitiveCategory[] = [
  "vulnerable-people",
  "safety-or-health",
  "legal-or-regulatory",
  "money",
  "employment",
  "published-in-the-enterprise-name",
];

/** How each category is named to the operator. Reads as a list after "touches". */
export const SENSITIVE_CATEGORY_DESCRIPTIONS:
  Readonly<Record<SensitiveCategory, string>> = {
  "vulnerable-people": "children or people at risk",
  "safety-or-health": "someone's safety or health",
  "legal-or-regulatory": "a legal or regulatory obligation",
  "money": "money",
  "employment": "employment decisions",
  "published-in-the-enterprise-name": "anything published in the business's name",
};

/**
 * Categories per Function id. `undefined` means the Function was not
 * successfully classified, which requires approval rather than waiving it.
 */
export type SensitiveWorkClassification =
  ReadonlyMap<string, readonly SensitiveCategory[] | undefined>;

/**
 * Builds the prompt asking whether one Function touches one category.
 *
 * One yes/no question at a time, deliberately. Asked to pick from a list of six
 * categories for a Function in a single call, the default local model said a
 * register of "risks to children at the club" touched nothing at all, and that
 * a weekly summary of published science news touched money. A false negative
 * here is the precise failure this control exists to prevent. Asked "does this
 * work affect children, patients, or people at risk?" about the same register,
 * it answers yes.
 *
 * PURE: No side effects.
 */
export function buildCategoryQuestionPrompt(
  definition: BusinessFunctionDefinition,
  category: SensitiveCategory
): string {
  return renderEnterprisePrompt("Sensitive Work Classification", {
    FUNCTION_NAME: definition.label,
    FUNCTION_OBJECTIVE: definition.objective || "(not stated)",
    CATEGORY_QUESTION: SENSITIVE_CATEGORY_QUESTIONS[category]
  });
}

/** How each category is put to the model as a yes/no question. */
const SENSITIVE_CATEGORY_QUESTIONS:
  Readonly<Record<SensitiveCategory, string>> = {
  "vulnerable-people": "affect children, patients, or people at risk",
  "safety-or-health": "affect someone's physical safety or health",
  "legal-or-regulatory": "create a legal or regulatory obligation",
  "money": "commit, charge, or move money",
  "employment": "make decisions about someone's employment",
  "published-in-the-enterprise-name": "produce anything published in the business's name",
};

/**
 * Reads a yes/no answer.
 *
 * Anything that is not recognisably "no" counts as yes. This is a governance
 * control: an unreadable answer must not clear a requirement.
 *
 * PURE: No side effects.
 */
export function readsAsYes(
  response: string
): boolean {
  return !/^\W*no\b/i.test(
    response.trim()
  );
}

/**
 * Classifies every Function, one question per category.
 *
 * A Function is left unclassified only when a call fails outright, which
 * requires approval rather than waiving it.
 *
 * SIDE EFFECT: Calls the supplied generator once per Function per category.
 */
export async function classifySensitiveWork(
  functions: readonly BusinessFunctionDefinition[],
  ask: (prompt: string) => Promise<string>
): Promise<SensitiveWorkClassification> {
  const classified = new Map<string, readonly SensitiveCategory[] | undefined>();

  for (const definition of functions) {
    try {
      const touched: SensitiveCategory[] = [];

      for (const category of SENSITIVE_CATEGORIES) {
        const answer = await ask(
          buildCategoryQuestionPrompt(
            definition,
            category
          )
        );
        if (readsAsYes(answer)) touched.push(category);
      }

      classified.set(definition.id, touched);
    } catch {
      classified.set(definition.id, undefined);
    }
  }

  return classified;
}

/**
 * Whether a Function's work needs a person to approve it.
 *
 * `undefined` means the classification could not be obtained, which requires
 * approval rather than waiving it.
 *
 * PURE: No side effects.
 */
export function requiresHumanApproval(
  functionId: string,
  classification: SensitiveWorkClassification | undefined
): boolean {
  if (!classification) return true;

  const categories = classification.get(functionId);
  return categories === undefined || categories.length > 0;
}

/**
 * The reason shown to the operator for a deterministically added requirement.
 *
 * PURE: No side effects.
 */
export function describeSensitiveWork(
  label: string,
  categories: readonly SensitiveCategory[]
): string {
  if (categories.length === 0) {
    return `Arturo could not establish what ${label}'s work touches, so it requires a person's approval until that is settled.`;
  }

  const named = categories.map(
    (category) => SENSITIVE_CATEGORY_DESCRIPTIONS[category]
  );
  const listed =
    named.length === 1
      ? named[0]
      : `${named.slice(0, -1).join(", ")} and ${named[named.length - 1]}`;

  return `${label} touches ${listed}, so a person must approve its work rather than an AI Worker alone.`;
}
