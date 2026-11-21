import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
/**
 * Proposes concrete bounded Tasks for an already-staffed Function.
 *
 * After `/staff`, an operator has a working business and no idea what to ask it
 * for. Recommending Functions (`/next`) answers "what should this company be
 * responsible for"; this answers the question that immediately follows: "what
 * should I actually give it to do today?"
 *
 * Suggestions are advisory model output. Nothing is created until the operator
 * confirms, and each suggestion still passes through normal routing and
 * Governance when it becomes a real Task.
 */

import {
  extractJsonObjectSubstring,
  isUnknownRecord,
  readOptionalString,
  readRequiredString,
  stripNextStepMarkdownFences,
} from "./nextStepAdvisor";

export type TaskSuggestion = {
  /** Short imperative label, e.g. "Draft a client engagement letter". */
  readonly title: string;
  /** The full outcome text used verbatim as the Task request. */
  readonly outcome: string;
  /** Why this Function would plausibly need the work done. */
  readonly reason: string;
  /** True when the work would normally recur on a schedule. */
  readonly recurring: boolean;
  /**
   * Real-world details the operator must supply for the Task to be useful,
   * e.g. "the client's name" or "the contract to review". Empty when the Task
   * can run on what Arturo already holds.
   */
  readonly requiredInputs: readonly string[];
};

/**
 * Placeholder syntaxes models reach for when they write a template instead of
 * a Task. A suggestion containing one is not actionable, so it is rejected
 * rather than shown to the operator as if it were ready to run.
 */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /\[\[.*?\]\]/,
  /\{\{.*?\}\}/,
  // Any bracketed phrase, in any case: "[contract to review]" is as much a
  // blank as "[CONTRACT]". Bare numeric brackets are left alone so a citation
  // marker is not mistaken for a placeholder.
  /\[(?!\d+\])[^\]]{1,60}\]/,
  /<[a-z][a-z -]*>/i,
  /_{3,}/,
];

/**
 * Returns true when text contains a fill-in-the-blank placeholder.
 *
 * PURE: No side effects.
 */
export function containsPlaceholder(
  value: string
): boolean {
  return PLACEHOLDER_PATTERNS.some(
    (pattern) => pattern.test(value)
  );
}

/**
 * External actions a suggestion can imply, and the capability each needs.
 *
 * A model asked for useful work will propose sending, publishing, or filing
 * something regardless of instructions not to. Proposing an action the staffed
 * Workers cannot perform is worse than proposing nothing: the operator accepts
 * it, the Task fails to route, and the failure looks like a product defect
 * rather than a missing capability.
 */
const EXTERNAL_ACTION_PATTERNS: readonly {
  readonly pattern: RegExp;
  readonly capabilities: readonly string[];
  readonly action: string;
}[] = [
  {
    pattern: /\b(send|email|e-mail|reply to|respond to|forward)\b[^.]*\b(email|e-mail|message|client|letter|invoice|reminder)\b/i,
    capabilities: ["email", "email-send", "notify"],
    action: "send email",
  },
  {
    pattern: /\b(publish|post|upload|share)\b[^.]*\b(website|site|social|blog|online|platform|portal)\b/i,
    capabilities: ["http-post", "webhook", "publish"],
    action: "publish externally",
  },
  {
    pattern: /\b(search|look up|research)\b[^.]*\b(online|web|internet|current|latest|recent)\b/i,
    capabilities: ["web-research"],
    action: "search the web",
  },
  {
    pattern: /\b(call|phone|telephone|meet with|visit)\b/i,
    capabilities: ["human-contact"],
    action: "contact someone directly",
  },
];

/**
 * Phrasing that means "enumerate the Enterprise's actual records".
 *
 * A suggestion like "report listing all slow-moving books, including quantity
 * in stock" cannot be done from the Enterprise mission and Function objective
 * alone. If it declares no required inputs, the operator accepts it believing
 * Arturo holds the data, and gets confident invented values back. That failure
 * looks like a working feature, which is what makes it dangerous.
 */
const DATA_DEPENDENT_PATTERNS: readonly RegExp[] = [
  /\b(list|report on|compile|reconcile|tally|audit)\b[^.]*\ball\b/i,
  /\b(quantity|quantities|stock level|inventory level|balance)s?\b/i,
  /\b(sales|revenue|turnover|invoice|payment|transaction)s?\s+(data|figures|volume|history|records)\b/i,
  /\b(current|existing|actual|our|the)\s+(inventory|stock|customers?|clients?|suppliers?|accounts?)\b/i,
  /\bover the (past|last)\s+\w+\b/i,
];

/**
 * Returns true when an outcome needs the Enterprise's own records.
 *
 * PURE: No side effects.
 */
export function needsSuppliedRecords(
  outcome: string
): boolean {
  return DATA_DEPENDENT_PATTERNS.some(
    (pattern) => pattern.test(outcome)
  );
}

/**
 * Returns the external action a suggestion implies but cannot perform, or
 * undefined when the staffed Workers could carry it out.
 *
 * PURE: No side effects.
 */
export function unsupportedExternalAction(
  outcome: string,
  staffedCapabilities: readonly string[]
): string | undefined {
  const held =
    new Set(
      staffedCapabilities.map(
        (capability) => capability.toLowerCase()
      )
    );

  return EXTERNAL_ACTION_PATTERNS.find(
    (candidate) =>
      candidate.pattern.test(outcome) &&
      !candidate.capabilities.some(
        (capability) => held.has(capability)
      )
  )?.action;
}

/**
 * Collapses a model-written outcome onto one line.
 *
 * Models often format an outcome across several lines, which reads as broken
 * output once it is rendered under a numbered heading.
 *
 * PURE: No side effects.
 */
export function normaliseOutcomeText(
  value: string
): string {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

export type TaskSuggestionContext = {
  readonly enterpriseName: string;
  readonly mission: string;
  readonly functionLabel: string;
  readonly functionObjective: string;
  /** Capability ids the Function's staffed Workers actually hold. */
  readonly staffedCapabilities: readonly string[];
};

export type TaskSuggestionGenerator = (input: {
  readonly model: string;
  readonly prompt: string;
}) => Promise<{ readonly response: string }>;

/**
 * Builds the JSON-only prompt asking for bounded Task suggestions.
 *
 * PURE: No side effects.
 */
export function buildTaskSuggestionPrompt(
  context: TaskSuggestionContext
): string {
  return renderEnterprisePrompt("Bounded Task Suggestions", {
    ENTERPRISE_NAME: context.enterpriseName,
    MISSION: context.mission || "(no mission recorded)",
    FUNCTION_NAME: context.functionLabel,
    FUNCTION_OBJECTIVE: context.functionObjective || "(no objective recorded)",
    STAFFED_CAPABILITIES: context.staffedCapabilities.length > 0
    ? context.staffedCapabilities.map((id) => `- ${id}`).join("\n")
    : "- (none recorded)"
  });
}

/**
 * Parses one suggestion object, rejecting anything missing a required field.
 *
 * PURE: No side effects.
 */
export function parseTaskSuggestion(
  value: unknown,
  staffedCapabilities: readonly string[] = []
): TaskSuggestion {
  if (!isUnknownRecord(value)) {
    throw new Error(
      "Each suggestion must be a JSON object."
    );
  }

  const outcome =
    normaliseOutcomeText(
      readRequiredString(
        value,
        "outcome"
      )
    );

  if (containsPlaceholder(outcome)) {
    throw new Error(
      `Suggestion "${outcome}" is a fill-in template, not an actionable Task.`
    );
  }

  const unsupported =
    unsupportedExternalAction(
      outcome,
      staffedCapabilities
    );

  if (unsupported) {
    throw new Error(
      `Suggestion "${outcome}" needs to ${unsupported}, which no staffed Worker can do.`
    );
  }

  const requiredInputs =
    Array.isArray(value.requiredInputs)
      ? value.requiredInputs
          .filter(
            (input): input is string =>
              typeof input === "string" && input.trim().length > 0
          )
          .map(
            (input) => normaliseOutcomeText(input)
          )
      : [];

  if (
    needsSuppliedRecords(outcome) &&
    requiredInputs.length === 0
  ) {
    throw new Error(
      `Suggestion "${outcome}" needs the Enterprise's own records but declares ` +
      "no required inputs, so accepting it would produce invented data."
    );
  }

  return {
    title: normaliseOutcomeText(
      readRequiredString(
        value,
        "title"
      )
    ),
    outcome,
    reason: normaliseOutcomeText(
      readOptionalString(
        value,
        "reason"
      ) ?? ""
    ),
    recurring: value.recurring === true,
    requiredInputs,
  };
}

/**
 * Parses a full model response into validated suggestions.
 *
 * PURE: No side effects.
 */
export function parseTaskSuggestions(
  response: string,
  staffedCapabilities: readonly string[] = []
): readonly TaskSuggestion[] {
  const json =
    extractJsonObjectSubstring(
      stripNextStepMarkdownFences(
        response
      )
    );
  const parsed: unknown =
    JSON.parse(
      json
    );

  if (!isUnknownRecord(parsed)) {
    throw new Error(
      "Suggestion response must be a JSON object."
    );
  }

  const { suggestions } = parsed;

  if (!Array.isArray(suggestions)) {
    throw new Error(
      "Suggestion response must contain a suggestions array."
    );
  }

  if (suggestions.length === 0) {
    throw new Error(
      "Suggestion response contained no suggestions."
    );
  }

  // One malformed or template-shaped entry should not discard the usable rest,
  // so bad suggestions are dropped individually and only an entirely unusable
  // response is treated as a failure.
  const usable =
    suggestions.flatMap(
      (suggestion) => {
        try {
          return [
            parseTaskSuggestion(
              suggestion,
              staffedCapabilities
            ),
          ];
        } catch {
          return [];
        }
      }
    );

  if (usable.length === 0) {
    throw new Error(
      "No usable suggestions: every one was a fill-in template, malformed, or " +
      "required an action no staffed Worker can perform."
    );
  }

  return usable;
}
