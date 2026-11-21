import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
import {
  generateWithConfiguredLlm,
} from "../llm/llmClient";

export type NextStepGenerator = (input: {
  readonly model: string;
  readonly prompt: string;
}) => Promise<{ readonly response: string }>;

export type BusinessFunctionRecommendation = {
  readonly name: string;
  readonly objective: string;
  readonly reason: string;
  /**
   * A couple of concrete, plain-language tasks this Function would carry out,
   * shown in the interactive review so a newcomer can picture the work. The
   * model supplies them; parsing is tolerant and defaults to none. Optional in
   * the type only so hand-built fixtures need not set it — the parser always
   * populates it (to [] when the model omits it).
   */
  readonly exampleTasks?: readonly string[];
};

export type NextStepAdvice = {
  readonly summary: string;
  readonly recommendations:
    readonly BusinessFunctionRecommendation[];
  readonly recommendedNextAction: string;
  readonly caveats: readonly string[];
};

export type NextStepAdviceContext = {
  readonly enterpriseName: string;
  readonly mission: string;
  readonly existingBusinessFunctions:
    readonly string[];
  /**
   * What the operator said about the business in their own words.
   *
   * Instruction 8b has always told the model to cover the problems the
   * operator actually named, but nothing supplied them: the context carried a
   * mission and nothing else, and the mission states what a business does, not
   * what is going wrong in it. A walkthrough said twice that its problem was
   * invoices sitting unbilled for weeks, and got back Functions for service
   * scheduling, parts inventory, and customer records — the guided interview
   * was captured, stored, and then discarded at this handoff.
   */
  readonly operatorContext?: string;
};

export type NextStepGuidanceResult = {
  readonly guidance: string;
  readonly recommendations:
    readonly BusinessFunctionRecommendation[];
};

type UnknownRecord =
  Record<string, unknown>;

/**
 * Purpose: Resolves the model used for /next guidance.
 *
 * Params:
 * - environment: Environment variable source.
 *
 * Returns:
 * - Configured model name or Arturo's existing local default.
 *
 * PURE: No side effects.
 */
export function resolveNextStepModel(
  environment:
    Readonly<Record<string, string | undefined>> =
      process.env
): string {
  return (
    environment.ARTURO_LLM_MODEL ??
    "llama3.2:latest"
  );
}

/**
 * Purpose: Escapes a value for use inside a quoted Arturo command argument.
 *
 * Params:
 * - value: Raw command argument value.
 *
 * Returns:
 * - Escaped command argument value.
 *
 * PURE: No side effects.
 */
export function escapeQuotedCommandValue(
  value: string
): string {
  return value
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /"/g,
      '\\"'
    );
}

/**
 * Purpose: Formats a command for creating one recommended Business Function.
 *
 * Params:
 * - enterpriseName: Owning Enterprise name.
 * - recommendation: Recommended Business Function.
 *
 * Returns:
 * - Ready-to-run /function create command.
 *
 * PURE: No side effects.
 */
export function formatRecommendedFunctionCommand(
  enterpriseName: string,
  recommendation:
    BusinessFunctionRecommendation
): string {
  return [
    `/function create "${escapeQuotedCommandValue(
      recommendation.name
    )}"`,
    `--enterprise "${escapeQuotedCommandValue(
      enterpriseName
    )}"`,
    `--objective "${escapeQuotedCommandValue(
      recommendation.objective
    )}"`,
  ].join(
    " "
  );
}

/**
 * Purpose: Formats existing Business Functions for the LLM prompt.
 *
 * Params:
 * - labels: Existing Business Function labels.
 *
 * Returns:
 * - Numbered list or an explicit empty-state marker.
 *
 * PURE: No side effects.
 */
export function formatExistingBusinessFunctionsForPrompt(
  labels: readonly string[]
): string {
  if (labels.length === 0) {
    return "(none)";
  }

  return labels
    .map(
      (label, index) =>
        `${index + 1}. ${label}`
    )
    .join(
      "\n"
    );
}

/**
 * Purpose: Builds the prompt used to ask an LLM what Business Functions an Enterprise needs.
 *
 * Params:
 * - context: Enterprise name, mission, and existing Business Functions.
 *
 * Returns:
 * - Grounded JSON-only LLM prompt.
 *
 * PURE: No side effects.
 */
export function buildNextStepAdvicePrompt(
  context: NextStepAdviceContext,
  feedback?: string
): string {
  return renderEnterprisePrompt("Business Function Recommendations", {
    ENTERPRISE_NAME: context.enterpriseName,
    MISSION: context.mission || "(no mission recorded)",
    OPERATOR_CONTEXT: context.operatorContext?.trim() || "(nothing recorded)",
    EXISTING_FUNCTIONS: formatExistingBusinessFunctionsForPrompt(
  context.existingBusinessFunctions
),
    FEEDBACK: feedback?.trim() || "(none)"
  });
}

/**
 * Purpose: Builds a single repair request when the model returns invalid /next JSON.
 *
 * Params:
 * - context: Enterprise context from the original request.
 * - invalidResponse: Model response that failed validation.
 * - validationError: Validation failure to correct.
 *
 * Returns:
 * - JSON-only repair prompt containing the failed response and required shape.
 *
 * PURE: No side effects.
 */
export function buildNextStepRepairPrompt(
  context: NextStepAdviceContext,
  invalidResponse: string,
  validationError: string
): string {
  return renderEnterprisePrompt("Business Function Recommendation Repair", {
    VALIDATION_ERROR: validationError,
    ENTERPRISE_NAME: context.enterpriseName,
    MISSION: context.mission || "(no mission recorded)",
    INVALID_RESPONSE: invalidResponse
  });
}

/**
 * Purpose: Removes markdown code fences sometimes added by LLMs.
 *
 * Params:
 * - value: Raw model response.
 *
 * Returns:
 * - Response text with outer code fences removed.
 *
 * PURE: No side effects.
 */
export function stripNextStepMarkdownFences(
  value: string
): string {
  return value
    .replace(
      /^```(?:json)?\s*/i,
      ""
    )
    .replace(
      /\s*```$/i,
      ""
    )
    .trim();
}

/**
 * Purpose: Extracts the outermost JSON object from a model response that may
 * include leading or trailing prose (e.g. "Sure, here is the JSON:\n{...}\n
 * Let me know if that helps!"), which smaller local models sometimes add even
 * when instructed to return JSON only.
 *
 * Params:
 * - value: Response text, already stripped of markdown fences.
 *
 * Returns:
 * - The substring from the first "{" to the last "}", or the original text
 *   unchanged when no such bounds are found.
 *
 * PURE: No side effects.
 */
export function extractJsonObjectSubstring(
  value: string
): string {
  const start =
    value.indexOf("{");
  const end =
    value.lastIndexOf("}");

  if (
    start === -1 ||
    end === -1 ||
    end <= start
  ) {
    return value;
  }

  return value.slice(
    start,
    end + 1
  );
}

/**
 * Purpose: Checks whether a value is a non-array object.
 *
 * Params:
 * - value: Unknown value.
 *
 * Returns:
 * - True when the value is a plain record-like object.
 *
 * PURE: No side effects.
 */
export function isUnknownRecord(
  value: unknown
): value is UnknownRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(
      value
    )
  );
}

/**
 * Purpose: Reads a required non-empty string property.
 *
 * Params:
 * - record: Source object.
 * - property: Property name.
 *
 * Returns:
 * - Trimmed string value.
 *
 * PURE: No side effects.
 *
 * Throws:
 * - When the property is missing, not a string, or empty.
 */
export function readRequiredString(
  record: UnknownRecord,
  property: string
): string {
  const value =
    record[property];

  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(
      `Invalid /next response: ${property} must be a non-empty string.`
    );
  }

  return value.trim();
}

/**
 * Purpose: Reads an optional string property, treating a missing value, a
 * non-string value, or an empty/whitespace-only string as absent rather than
 * an error. Smaller local models sometimes drop a narrative field (such as a
 * recommendation's "reason") without breaking the rest of the JSON shape; this
 * lets that be tolerated without discarding an otherwise-valid recommendation.
 *
 * Params:
 * - record: Source object.
 * - property: Property name.
 *
 * Returns:
 * - Trimmed string value, or undefined when absent.
 *
 * PURE: No side effects.
 */
export function readOptionalString(
  record: UnknownRecord,
  property: string
): string | undefined {
  const value =
    record[property];

  return typeof value === "string" &&
    value.trim().length > 0
    ? value.trim()
    : undefined;
}

export const DEFAULT_RECOMMENDATION_REASON =
  "The model did not explain this recommendation.";

/**
 * Asks only for the missing explanations.
 *
 * A missing reason is tolerated rather than failed, which is the right call —
 * a usable recommendation without an explanation beats no recommendation at
 * all. But a walkthrough got the placeholder on four recommendations out of
 * four, leaving "Why Arturo recommends it" saying nothing anywhere, and that
 * section is the operator's only basis for judging the list. Asked on its own,
 * with the Functions already decided, the model answers.
 *
 * PURE: No side effects.
 */
export function buildRecommendationReasonPrompt(
  context: NextStepAdviceContext,
  unexplained: readonly BusinessFunctionRecommendation[]
): string {
  return renderEnterprisePrompt("Business Function Explanations", {
    ENTERPRISE_NAME: context.enterpriseName,
    MISSION: context.mission || "(no mission recorded)",
    OPERATOR_CONTEXT: context.operatorContext?.trim() || "(nothing recorded)",
    FUNCTIONS_TO_EXPLAIN: JSON.stringify(
      unexplained.map(
        (recommendation) => ({
          name: recommendation.name,
          objective: recommendation.objective,
        })
      ),
      null,
      2
    )
  });
}

/**
 * Fills in reasons from a follow-up response, keeping the original list.
 *
 * Only explanations are taken. The recommendations themselves were already
 * settled, and a second call must not quietly change what is being proposed.
 *
 * PURE: No side effects.
 */
export function mergeRecommendationReasons(
  recommendations: readonly BusinessFunctionRecommendation[],
  response: string
): readonly BusinessFunctionRecommendation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(
      extractJsonObjectSubstring(
        stripNextStepMarkdownFences(
          response
        )
      )
    );
  } catch {
    return recommendations;
  }

  const supplied = new Map<string, string>();
  const entries = isUnknownRecord(parsed) ? parsed.recommendations : undefined;

  if (Array.isArray(entries)) {
    for (const entry of entries) {
      if (!isUnknownRecord(entry)) continue;
      const name = readOptionalString(entry, "name");
      const reason = readOptionalString(entry, "reason");
      if (name && reason) supplied.set(name.toLowerCase(), reason);
    }
  }

  return recommendations.map(
    (recommendation) =>
      recommendation.reason === DEFAULT_RECOMMENDATION_REASON
        ? {
            ...recommendation,
            reason:
              supplied.get(recommendation.name.toLowerCase()) ??
              recommendation.reason,
          }
        : recommendation
  );
}

/**
 * Purpose: Parses and validates one Business Function recommendation.
 *
 * Params:
 * - value: Unknown recommendation value.
 * - index: Recommendation index for error reporting.
 *
 * Returns:
 * - Validated Business Function recommendation.
 *
 * PURE: No side effects.
 */
/**
 * Job titles a Function name should not end in.
 *
 * A Function is an ongoing responsibility the Enterprise owns, not a post
 * somebody holds. CLAUDE.md says it "should never be named after a person", and
 * the prompt asks for "ongoing responsibilities, not people" — and a
 * walkthrough for an after-school club got back Parent Communication Manager,
 * Safeguarding Compliance Specialist, Activity Planning Coordinator, and
 * Membership Database Administrator. All four are people. The distinction
 * matters because Workers are then staffed *to* a Function, and "Parent
 * Communication Manager" staffed with a "Parent Communication Analyst" reads as
 * an org chart rather than a responsibility with someone doing it.
 */
const PERSON_SHAPED_NAME_ENDINGS: ReadonlySet<string> = new Set([
  "administrator",
  "advisor",
  "agent",
  "analyst",
  "assistant",
  "champion",
  "clerk",
  "consultant",
  "coordinator",
  "custodian",
  "director",
  "executive",
  "handler",
  "head",
  "lead",
  "manager",
  "officer",
  "operator",
  "owner",
  "representative",
  "specialist",
  "steward",
  "supervisor",
  "technician",
]);

/**
 * Turns a model-proposed Function name into the responsibility it describes.
 *
 * Drops a trailing job title, and the trailing word "Function" — which is
 * Arturo's own word for the thing, so "Invoice Management Function" reads as a
 * stutter in a list headed Functions. Leaves the name alone when stripping
 * would leave nothing meaningful behind, because a bad name is better than an
 * empty one.
 *
 * PURE: No side effects.
 */
export function normaliseRecommendedFunctionName(
  name: string
): string {
  let words = name.trim().split(/\s+/).filter(Boolean);

  while (
    words.length > 1 &&
    /^functions?$/i.test(words[words.length - 1])
  ) {
    words = words.slice(0, -1);
  }

  const withoutTitle =
    words.length > 1 &&
    PERSON_SHAPED_NAME_ENDINGS.has(
      words[words.length - 1].toLowerCase().replace(/[^a-z]/g, "")
    )
      ? words.slice(0, -1)
      : words;

  return withoutTitle.join(" ") || name.trim();
}

/**
 * Whether the summary only restates the heading above it.
 *
 * The schema described this field as "Brief explanation of Arturo's
 * understanding of the Enterprise", and the model handed that description
 * straight back — a walkthrough was shown "Arturo's understanding: Arturo's
 * understanding of Bright Sparks After School Club." The schema wording is
 * fixed, but a model echoing its own instructions is common enough that the
 * section is better omitted than printed as a tautology.
 *
 * PURE: No side effects.
 */
export function isEchoedSummary(
  summary: string,
  enterpriseName: string
): boolean {
  const stripped = summary
    .toLowerCase()
    .split(enterpriseName.toLowerCase())
    .join(" ")
    // Apostrophes go first, so "arturo's" collapses to "arturos" rather than
    // splitting into two words the pattern below would not recognise.
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z]+/g, " ")
    .trim();

  return (
    stripped.length === 0 ||
    /^(a |an |the )?(brief |short )?(explanation |summary |description )?(of )?(arturos? )?understanding( of)?( the)?( enterprise| business)?$/.test(
      stripped
    )
  );
}

export function parseBusinessFunctionRecommendation(
  value: unknown,
  index: number
): BusinessFunctionRecommendation {
  if (!isUnknownRecord(value)) {
    throw new Error(
      `Invalid /next response: recommendations[${index}] must be an object.`
    );
  }

  return {
    name:
      normaliseRecommendedFunctionName(
        readRequiredString(
          value,
          "name"
        )
      ),
    objective:
      readRequiredString(
        value,
        "objective"
      ),
    reason:
      readOptionalString(
        value,
        "reason"
      ) ??
      DEFAULT_RECOMMENDATION_REASON,
    exampleTasks:
      parseRecommendationExampleTasks(
        (value as UnknownRecord).exampleTasks ??
          (value as UnknownRecord).example_tasks
      ),
  };
}

/**
 * Reads the optional per-Function example tasks. Tolerant by design: a missing
 * or malformed value yields none rather than failing the whole /next response,
 * since these are illustrative and the model may omit them. Keeps at most three
 * non-empty strings.
 *
 * PURE: No side effects.
 */
export function parseRecommendationExampleTasks(
  value: unknown
): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (task): task is string =>
        typeof task === "string" && task.trim().length > 0
    )
    .map((task) => task.trim())
    .slice(0, 3);
}

/**
 * Purpose: Parses optional caveat strings.
 *
 * Params:
 * - value: Unknown caveats value.
 *
 * Returns:
 * - Valid caveat strings.
 *
 * PURE: No side effects.
 */
export function parseNextStepCaveats(
  value: unknown
): readonly string[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(
      "Invalid /next response: caveats must be an array."
    );
  }

  return value.map(
    (caveat, index) => {
      if (
        typeof caveat !== "string" ||
        caveat.trim().length === 0
      ) {
        throw new Error(
          `Invalid /next response: caveats[${index}] must be a non-empty string.`
        );
      }

      return caveat.trim();
    }
  );
}

/**
 * Purpose: Parses and validates an LLM-generated /next response.
 *
 * Params:
 * - value: Raw model response.
 *
 * Returns:
 * - Validated next-step advice.
 *
 * PURE: No side effects.
 */
export function parseNextStepAdvice(
  value: string
): NextStepAdvice {
  let parsed:
    unknown;

  try {
    parsed =
      JSON.parse(
        extractJsonObjectSubstring(
          stripNextStepMarkdownFences(
            value
          )
        )
      );
  } catch {
    throw new Error(
      "Arturo could not understand the model's /next response because it was not valid JSON."
    );
  }

  if (!isUnknownRecord(parsed)) {
    throw new Error(
      "Invalid /next response: expected a JSON object."
    );
  }

  const recommendationsValue =
    parsed.recommendations;

  if (!Array.isArray(recommendationsValue)) {
    throw new Error(
      "Invalid /next response: recommendations must be an array."
    );
  }

  return {
    summary:
      readRequiredString(
        parsed,
        "summary"
      ),
    recommendations:
      recommendationsValue.map(
        parseBusinessFunctionRecommendation
      ),
    recommendedNextAction:
      readRequiredString(
        parsed,
        "recommendedNextAction"
      ),
    caveats:
      parseNextStepCaveats(
        parsed.caveats
      ),
  };
}

/**
 * Purpose: Normalises text for case-insensitive Business Function comparison.
 *
 * Params:
 * - value: Text to normalise.
 *
 * Returns:
 * - Lowercase, whitespace-normalised text.
 *
 * PURE: No side effects.
 */
export function normaliseBusinessFunctionName(
  value: string
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /\s+/g,
      " "
    );
}

/**
 * Purpose: Removes duplicate or already-existing Business Function recommendations.
 *
 * Params:
 * - recommendations: Model-generated recommendations.
 * - existingLabels: Existing Business Function labels.
 *
 * Returns:
 * - Unique recommendations not already represented.
 *
 * PURE: No side effects.
 */
export function filterNewBusinessFunctionRecommendations(
  recommendations:
    readonly BusinessFunctionRecommendation[],
  existingLabels: readonly string[]
): readonly BusinessFunctionRecommendation[] {
  const usedNames =
    new Set(
      existingLabels.map(
        normaliseBusinessFunctionName
      )
    );

  return recommendations.reduce(
    (
      result,
      recommendation
    ) => {
      const name =
        normaliseBusinessFunctionName(
          recommendation.name
        );

      if (
        usedNames.has(
          name
        )
      ) {
        return result;
      }

      usedNames.add(
        name
      );

      return [
        ...result,
        recommendation,
      ];
    },
    [] as readonly BusinessFunctionRecommendation[]
  );
}

/**
 * Purpose: Formats one LLM-generated Business Function recommendation.
 *
 * Params:
 * - recommendation: Business Function recommendation.
 * - index: Zero-based recommendation index.
 *
 * Returns:
 * - Human-readable recommendation block.
 *
 * PURE: No side effects.
 */
export function formatBusinessFunctionRecommendation(
  recommendation:
    BusinessFunctionRecommendation,
  index: number
): string {
  return [
    `${index + 1}. ${recommendation.name}`,
    "",
    "   Objective:",
    `     ${recommendation.objective}`,
    "",
    "   Why Arturo recommends it:",
    `     ${recommendation.reason}`,
  ].join(
    "\n"
  );
}

/**
 * Purpose: Formats existing Business Function labels for user output.
 *
 * Params:
 * - labels: Existing Business Function labels.
 *
 * Returns:
 * - Display lines for current Business Functions.
 *
 * PURE: No side effects.
 */
export function formatCurrentBusinessFunctionLines(
  labels: readonly string[]
): readonly string[] {
  return labels.length === 0
    ? [
        "  None",
      ]
    : labels.map(
        (label) =>
          `  ✓ ${label}`
      );
}

/**
 * Purpose: Formats caveats returned by the Enterprise adviser.
 *
 * Params:
 * - caveats: Advice caveats.
 *
 * Returns:
 * - Caveat output lines.
 *
 * PURE: No side effects.
 */
export function formatNextStepCaveatLines(
  caveats: readonly string[]
): readonly string[] {
  if (caveats.length === 0) {
    return [];
  }

  return [
    "",
    "Important assumptions and uncertainties:",
    ...caveats.map(
      (caveat) =>
        `  - ${caveat}`
    ),
  ];
}

/**
 * Purpose: Formats complete LLM-generated /next guidance.
 *
 * Params:
 * - context: Enterprise context.
 * - advice: Validated model advice.
 *
 * Returns:
 * - Human-readable next-step guidance.
 *
 * PURE: No side effects.
 */
export function formatNextStepAdvice(
  context: NextStepAdviceContext,
  advice: NextStepAdvice
): string {
  const recommendations =
    filterNewBusinessFunctionRecommendations(
      advice.recommendations,
      context.existingBusinessFunctions
    );

  const recommendationLines =
    recommendations.length === 0
      ? [
          "No additional Functions were recommended.",
        ]
      : recommendations.flatMap(
          (
            recommendation,
            index
          ) => [
            formatBusinessFunctionRecommendation(
              recommendation,
              index
            ),
            "",
          ]
        );

  const initiationPromptLines =
    recommendations.length === 0
      ? []
      : [
          "",
          "Would you like to create these Functions?",
          '  Reply "yes" to create all recommended Functions, or "no" to leave them unchanged.',
        ];

  return [
    `Enterprise: ${context.enterpriseName}`,
    "",
    "Mission:",
    `  ${context.mission || "(no mission recorded)"}`,
    "",
    "Current Functions:",
    ...formatCurrentBusinessFunctionLines(
      context.existingBusinessFunctions
    ),
    "",
    ...(isEchoedSummary(advice.summary, context.enterpriseName)
      ? []
      : [
          "Arturo's understanding:",
          `  ${advice.summary}`,
          "",
        ]),
    "Recommended Functions",
    "",
    ...recommendationLines,
    "Recommended next action:",
    `  ${advice.recommendedNextAction}`,
    ...formatNextStepCaveatLines(
      advice.caveats
    ),
    "",
    "These are suggestions — nothing has been created yet.",
    "Not happy with them? Run /model to have a different AI model advise instead.",
    ...initiationPromptLines,
    "",
    "To add staff later, run /staff.",
  ].join(
    "\n"
  );
}

/**
 * Purpose: Generates grounded next-step guidance using the configured LLM.
 *
 * Params:
 * - context: Enterprise name, mission, and existing Business Functions.
 *
 * Returns:
 * - Formatted Business Function guidance.
 *
 * SIDE EFFECT:
 * - Reads LLM configuration from process.env.
 * - Calls the configured LLM provider.
 */
export async function generateNextStepGuidanceResult(
  context: NextStepAdviceContext,
  options: {
    readonly generator?: NextStepGenerator;
    readonly model?: string;
    readonly feedback?: string;
  } = {}
): Promise<NextStepGuidanceResult> {
  const generator =
    options.generator ??
    generateWithConfiguredLlm;
  const model =
    options.model ??
    resolveNextStepModel();
  const firstResult =
    await generator({
      model,
      prompt:
        buildNextStepAdvicePrompt(
          context,
          options.feedback
        ),
    });

  let advice:
    NextStepAdvice;

  try {
    advice =
      parseNextStepAdvice(
        firstResult.response
      );
  } catch (firstError) {
    const firstErrorMessage =
      firstError instanceof Error
        ? firstError.message
        : String(firstError);

    const repairedResult =
      await generator({
        model,
        prompt:
          buildNextStepRepairPrompt(
            context,
            firstResult.response,
            firstErrorMessage
          ),
      });

    try {
      advice =
        parseNextStepAdvice(
          repairedResult.response
        );
    } catch (repairError) {
      const repairErrorMessage =
        repairError instanceof Error
          ? repairError.message
          : String(repairError);

      throw new Error(
        [
          "Arturo could not validate the model's /next response after one automatic repair attempt.",
          `Initial response: ${firstErrorMessage}`,
          `Repaired response: ${repairErrorMessage}`,
        ].join(
          " "
        )
      );
    }
  }

  // One follow-up for explanations the model skipped. It never fails the
  // command: whatever comes back, the recommendations already parsed stand.
  const unexplained = advice.recommendations.filter(
    (recommendation) =>
      recommendation.reason === DEFAULT_RECOMMENDATION_REASON
  );

  if (unexplained.length > 0) {
    try {
      const explained = await generator({
        model,
        prompt: buildRecommendationReasonPrompt(
          context,
          unexplained
        ),
      });
      advice = {
        ...advice,
        recommendations: mergeRecommendationReasons(
          advice.recommendations,
          explained.response
        ),
      };
    } catch {
      // Keep the honest placeholder.
    }
  }

  return {
    guidance:
      formatNextStepAdvice(
        context,
        advice
      ),
    recommendations:
      filterNewBusinessFunctionRecommendations(
        advice.recommendations,
        context.existingBusinessFunctions
      ),
  };
}

/**
 * Purpose: Generates formatted /next guidance for callers that do not need confirmation data.
 *
 * Params:
 * - context: Enterprise name, mission, and existing Business Functions.
 *
 * Returns:
 * - Formatted Business Function guidance.
 *
 * SIDE EFFECT:
 * - Calls the configured LLM provider.
 */
export async function generateNextStepGuidance(
  context: NextStepAdviceContext
): Promise<string> {
  const result =
    await generateNextStepGuidanceResult(
      context
    );

  return result.guidance;
}
