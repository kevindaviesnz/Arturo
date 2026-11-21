import {
  getModelRoutingStatus,
} from "./modelRouting";

export type ModelProfile = {
  readonly alias: string;
  readonly provider: "ollama" | "gemini";
  readonly model: string;
  readonly paid: boolean;
};

type UnknownProfile = {
  readonly provider?: unknown;
  readonly model?: unknown;
};

function readConfiguredProfiles(
  environment: Readonly<Record<string, string | undefined>>
): readonly ModelProfile[] {
  const raw =
    environment.ARTURO_MODEL_PROFILES_JSON?.trim();

  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      "ARTURO_MODEL_PROFILES_JSON must be a JSON object keyed by approved model alias."
    );
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    Array.isArray(parsed)
  ) {
    throw new Error(
      "ARTURO_MODEL_PROFILES_JSON must be a JSON object keyed by approved model alias."
    );
  }

  return Object.entries(parsed).map(
    ([alias, value]) => {
      if (!/^[a-z0-9][a-z0-9-]*$/i.test(alias)) {
        throw new Error(
          `Invalid model alias "${alias}". Use letters, numbers, and hyphens only.`
        );
      }

      const profile = value as UnknownProfile;
      const provider = profile?.provider;
      const model = profile?.model;

      if (
        provider !== "ollama" &&
        provider !== "gemini"
      ) {
        throw new Error(
          `Model alias "${alias}" has unsupported provider. Allowed providers: ollama, gemini.`
        );
      }

      if (
        typeof model !== "string" ||
        model.trim().length === 0
      ) {
        throw new Error(
          `Model alias "${alias}" must specify a non-empty model.`
        );
      }

      return {
        alias: alias.toLowerCase(),
        provider,
        model: model.trim(),
        paid: provider === "gemini",
      };
    }
  );
}

/** Returns the local default, configured paid default, and approved aliases. */
export function listModelProfiles(
  environment: Readonly<Record<string, string | undefined>> = process.env
): readonly ModelProfile[] {
  const routing = getModelRoutingStatus();
  const defaults: ModelProfile[] = [
    {
      alias: "local-default",
      provider: "ollama",
      model:
        environment.ARTURO_LLM_MODEL ??
        routing.localModel,
      paid: false,
    },
  ];

  if (environment.ARTURO_PAID_ESCALATION_MODEL?.trim()) {
    defaults.push({
      alias: "premium-default",
      provider: "gemini",
      model:
        environment.ARTURO_PAID_ESCALATION_MODEL.trim(),
      paid: true,
    });
  }

  const profiles = [
    ...defaults,
    ...readConfiguredProfiles(environment),
  ];
  const aliases = new Set<string>();

  return profiles.filter((profile) => {
    if (aliases.has(profile.alias)) {
      throw new Error(
        `Duplicate approved model alias: ${profile.alias}`
      );
    }
    aliases.add(profile.alias);
    return true;
  });
}

/** Maps the two friendly model choices to their stable approved aliases. */
export function normalizeModelChoice(
  value: string
): string {
  const normalised =
    value.trim().toLowerCase();

  if (normalised === "local") {
    return "local-default";
  }

  if (normalised === "premium") {
    return "premium-default";
  }

  return normalised;
}

/**
 * Resolves a friendly choice, approved alias, or configured model name.
 * A model name is accepted only when it already belongs to an approved route.
 */
export function resolveModelProfile(
  choice: string,
  environment: Readonly<Record<string, string | undefined>> = process.env
): ModelProfile {
  const profiles =
    listModelProfiles(
      environment
    );
  const normalised =
    normalizeModelChoice(
      choice
    );
  const aliasMatch =
    profiles.find(
      (candidate) =>
        candidate.alias === normalised
    );

  if (aliasMatch) {
    return aliasMatch;
  }

  const modelMatches =
    profiles.filter(
      (candidate) =>
        candidate.model.toLowerCase() === normalised
    );

  if (modelMatches.length > 0) {
    const routes =
      new Set(
        modelMatches.map(
          (profile) =>
            `${profile.provider}/${profile.model.toLowerCase()}`
        )
      );

    if (routes.size === 1) {
      return modelMatches[0];
    }

    throw new Error(
      `Ambiguous configured model name: ${choice}. Use an approved alias to select its provider.`
    );
  }

  const friendly = [
    "local",
    ...(profiles.some(
      (profile) =>
        profile.alias === "premium-default"
    )
      ? [
          "premium",
        ]
      : []),
  ];
  const available =
    [
      ...friendly,
      ...profiles.map(
        (candidate) =>
          candidate.alias
      ),
      ...new Set(
        profiles.map(
          (candidate) =>
            candidate.model
        )
      ),
    ].join(", ");
  throw new Error(
    `Unknown model choice: ${choice}. Available choices: ${available || "none"}`
  );
}
