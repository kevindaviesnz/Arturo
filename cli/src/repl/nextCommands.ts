import {
  listEnterprises,
} from "../enterprise/enterpriseStore";

import type {
  Enterprise,
} from "../enterprise/enterprise";

import {
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";

import {
  generateNextStepGuidanceResult,
} from "../guidance/nextStepAdvisor";

import type {
  NextStepGuidanceResult,
} from "../guidance/nextStepAdvisor";
import {
  generateWithModelProfile,
} from "../llm/llmClient";
import {
  normalizeModelChoice,
  resolveModelProfile,
  type ModelProfile,
} from "../llm/modelProfiles";
import {
  getModelRoutingStatus,
} from "../llm/modelRouting";

export type NextCommandOptions = {
  readonly enterpriseReference?: string;
  readonly modelAlias?: string;
  readonly compareAliases: readonly string[];
  readonly feedback?: string;
};

export function parseNextCommandOptions(
  args: readonly string[]
): NextCommandOptions {
  const references: string[] = [];
  let modelAlias: string | undefined;
  let feedback: string | undefined;
  let compareAliases: readonly string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (
      argument !== "--model" &&
      argument !== "--retry" &&
      argument !== "--compare" &&
      argument !== "--feedback"
    ) {
      if (argument.startsWith("--")) {
        throw new Error(`Unknown /next option: ${argument}`);
      }
      references.push(argument);
      continue;
    }

    const value = args[index + 1]?.trim();
    if (!value || value.startsWith("--")) {
      throw new Error(`${argument} requires a value.`);
    }
    index += 1;

    if (argument === "--feedback") {
      feedback = value;
    } else if (argument === "--compare") {
      compareAliases = value
        .split(",")
        .map(
          normalizeModelChoice
        )
        .filter(Boolean);
    } else {
      if (modelAlias) {
        throw new Error("Use only one of --model or --retry.");
      }
      modelAlias =
        normalizeModelChoice(
          value
        );
    }
  }

  if (compareAliases.length > 0 && modelAlias) {
    throw new Error("--compare cannot be combined with --model or --retry.");
  }
  if (
    args.includes("--compare") &&
    compareAliases.length < 2
  ) {
    throw new Error("--compare requires at least two comma-separated model choices.");
  }
  if (
    new Set(
      compareAliases.map((alias) => alias.toLowerCase())
    ).size !== compareAliases.length
  ) {
    throw new Error("--compare model choices must be unique.");
  }

  return {
    enterpriseReference:
      references.join(" ").trim() || undefined,
    modelAlias,
    compareAliases,
    feedback,
  };
}

export type EnterpriseResolution =
  | {
      readonly ok: true;
      readonly enterprise: Enterprise;
    }
  | {
      readonly ok: false;
      readonly message: string;
    };

/**
 * Purpose: Resolves the Enterprise that /next should inspect.
 *
 * Params:
 * - args: Optional Enterprise name or id command arguments.
 * - enterprises: Available Enterprises.
 *
 * Returns:
 * - Resolved Enterprise or explanatory error.
 *
 * PURE: No side effects.
 */
export function resolveNextEnterprise(
  args: readonly string[],
  enterprises: readonly Enterprise[]
): EnterpriseResolution {
  const reference =
    args
      .join(
        " "
      )
      .trim();

  if (reference) {
    const normalisedReference =
      reference.toLowerCase();

    const enterprise =
      enterprises.find(
        (candidate) =>
          candidate.id === reference ||
          candidate.name
            .trim()
            .toLowerCase() ===
            normalisedReference
      );

    return enterprise
      ? {
          ok: true,
          enterprise,
        }
      : {
          ok: false,
          message:
            `enterprise not found: ${reference}`,
        };
  }

  if (enterprises.length === 0) {
    return {
      ok: false,
      message: [
        "No Enterprise exists yet.",
        "",
        "Create one first:",
        "",
        '  /enterprise create "<name>" --mission "<mission>"',
      ].join(
        "\n"
      ),
    };
  }

  if (enterprises.length === 1) {
    return {
      ok: true,
      enterprise:
        enterprises[0],
    };
  }

  return {
    ok: false,
    message: [
      "More than one Enterprise exists.",
      "",
      "Choose which Enterprise Arturo should inspect:",
      "",
      ...enterprises.map(
        (enterprise) =>
          `  /next "${enterprise.name}"`
      ),
    ].join(
      "\n"
    ),
  };
}

/**
 * Purpose: Generates /next guidance using persisted Enterprise state and the configured AI model.
 *
 * Params:
 * - enterprise: Enterprise to inspect.
 *
 * Returns:
 * - AI-generated, mission-aware next-step guidance.
 *
 * SIDE EFFECT:
 * - Reads Business Function definition state.
 * - Calls the configured LLM provider.
 * - Does not mutate Enterprise state.
 */
export async function createNextGuidanceForEnterprise(
  enterprise: Enterprise
): Promise<string> {
  const result =
    await createNextGuidanceResultForEnterprise(
      enterprise
    );

  return result.guidance;
}

/**
 * Purpose: Generates /next guidance and retains validated recommendations for confirmation.
 *
 * Params:
 * - enterprise: Enterprise to inspect.
 *
 * Returns:
 * - Formatted guidance and the validated recommendations represented by it.
 *
 * SIDE EFFECT:
 * - Reads Business Function definition state.
 * - Calls the configured LLM provider.
 */
export async function createNextGuidanceResultForEnterprise(
  enterprise: Enterprise,
  options: {
    readonly modelProfile?: ModelProfile;
    readonly feedback?: string;
  } = {}
): Promise<NextStepGuidanceResult> {
  const definitions =
    listBusinessFunctionDefinitionsByEnterprise(
      enterprise.id
    );

  const context = {
    enterpriseName: enterprise.name,
    mission:
      enterprise.mission ||
      enterprise.description ||
      "",
    // The description holds what the operator said during guided setup. It was
    // only ever read as a fallback mission, so once a mission existed — which
    // guided setup always produces — their own account of the business was
    // never sent, and the recommendations ignored the problems they named.
    operatorContext:
      enterprise.mission
        ? enterprise.description
        : undefined,
    existingBusinessFunctions:
      definitions.map((definition) => definition.label),
  };
  const profile = options.modelProfile;

  return generateNextStepGuidanceResult(
    context,
    profile
      ? {
          model: profile.model,
          feedback: options.feedback,
          generator: ({ prompt }) =>
            generateWithModelProfile({
              provider: profile.provider,
              model: profile.model,
              prompt,
            }),
        }
      : {
          feedback: options.feedback,
        }
  );
}

export async function createComparedNextGuidanceForEnterprise(
  enterprise: Enterprise,
  aliases: readonly string[],
  feedback?: string
): Promise<string> {
  const profiles =
    aliases.map((alias) =>
      resolveModelProfile(alias)
    );
  const minimumPaidCalls =
    profiles.filter((profile) => profile.paid).length;
  const routing = getModelRoutingStatus();

  if (
    minimumPaidCalls > 0 &&
    (
      !routing.configured ||
      routing.paidCallsRemaining < minimumPaidCalls
    )
  ) {
    throw new Error(
      [
        "Model comparison was not started because its minimum paid-call requirement exceeds the available configured budget.",
        `Required: ${minimumPaidCalls}.`,
        `Remaining: ${routing.paidCallsRemaining}.`,
        routing.configurationError
          ? `Configuration: ${routing.configurationError}.`
          : "",
      ].filter(Boolean).join(" ")
    );
  }

  const sections: string[] = [
    "Model comparison",
    "",
    "Read-only comparison. No recommendation set is awaiting confirmation.",
  ];

  for (const profile of profiles) {
    const result =
      await createNextGuidanceResultForEnterprise(
        enterprise,
        {
          modelProfile: profile,
          feedback,
        }
      );
    sections.push(
      "",
      `===== ${profile.alias} · ${profile.provider}/${profile.model} =====`,
      "",
      result.guidance.replace(
        /\nWould you like to create these Functions\?\n  Reply "yes" to create all recommended Functions, or "no" to leave them unchanged\./,
        ""
      )
    );
  }

  sections.push(
    "",
    "To choose one result, rerun /next with --model <choice>. Review it, then answer yes or no."
  );
  return sections.join("\n");
}

/**
 * Purpose: Handles the /next command.
 *
 * Params:
 * - args: Optional Enterprise name or id.
 *
 * Returns:
 * - Promise resolving after guidance is displayed.
 *
 * SIDE EFFECT:
 * - Reads Enterprise state.
 * - Reads Business Function definition state.
 * - Calls the configured LLM provider.
 * - Writes terminal output.
 * - Does not mutate Enterprise state.
 */
export async function handleNextCommand(
  args: readonly string[]
): Promise<void> {
  let options: NextCommandOptions;
  try {
    options = parseNextCommandOptions(args);
  } catch (error) {
    console.log(
      error instanceof Error
        ? error.message
        : String(error)
    );
    return;
  }

  const resolution =
    resolveNextEnterprise(
      options.enterpriseReference
        ? [options.enterpriseReference]
        : [],
      listEnterprises()
    );

  if (!resolution.ok) {
    console.log(
      resolution.message
    );

    return;
  }

  console.log(
    "Arturo is examining the Enterprise mission and current Functions..."
  );

  const guidance =
    options.compareAliases.length > 0
      ? await createComparedNextGuidanceForEnterprise(
          resolution.enterprise,
          options.compareAliases,
          options.feedback
        )
      : (
          await createNextGuidanceResultForEnterprise(
            resolution.enterprise,
            {
              modelProfile:
                options.modelAlias
                  ? resolveModelProfile(
                      options.modelAlias
                    )
                  : undefined,
              feedback:
                options.feedback,
            }
          )
        ).guidance;

  console.log(
    guidance
  );
}
