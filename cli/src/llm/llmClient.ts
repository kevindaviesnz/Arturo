import {
  generateWithGemini,
} from "./geminiClient";

import {
  generateWithOllama,
} from "./ollamaClient";
import {
  getModelRoutingStatus,
  reservePaidEscalation,
  type PaidEscalationReason,
} from "./modelRouting";

import {
  getSelectedModel,
} from "./modelSelection";

import {
  generateWithAnthropic,
} from "./anthropicClient";

import {
  generateWithOpenAi,
} from "./openaiClient";

import {
  CLOUD_CATALOG,
} from "./modelCatalog";

export type LlmProvider =
  | "ollama"
  | "gemini";

/**
 * Purpose: Resolves the active LLM provider.
 *
 * Params:
 * - value: Optional provider override.
 *
 * Returns:
 * - Supported LLM provider.
 *
 * PURE: No side effects.
 */
export function resolveLlmProvider(
  value: string | undefined
): LlmProvider {
  return value === "gemini"
    ? "gemini"
    : "ollama";
}

/**
 * Purpose: Generates text using the configured LLM provider.
 *
 * Params:
 * - model: Model name for the selected provider.
 * - prompt: Prompt text.
 *
 * Returns:
 * - Generated response text.
 *
 * SIDE EFFECT:
 * - May call Ollama locally.
 * - May call Gemini API over the network.
 */
export async function generateWithConfiguredLlm(input: {
  readonly model: string;
  readonly prompt: string;
}): Promise<{
  readonly response: string;
}> {
  // An operator who explicitly picked a paid model through /model, and supplied
  // its API key there, gets it directly. This is a deliberate primary choice,
  // not an automatic fallback, so it is not bound by the escalation budget
  // (which exists to cap *automatic* paid use). It is still never a default —
  // only ever an informed opt-in made in /model with the cost stated.
  const selected = getSelectedModel();
  if (selected?.provider === "gemini") {
    return generateWithGemini({
      model: selected.model,
      prompt: input.prompt,
    });
  }
  if (selected?.provider === "anthropic") {
    return generateWithAnthropic({
      model: selected.model,
      prompt: input.prompt,
    });
  }
  if (selected?.provider === "openai") {
    return generateWithOpenAi({
      model: selected.model,
      prompt: input.prompt,
    });
  }

  const routing = getModelRoutingStatus();
  if (routing.mode === "local-first") {
    return generateWithOllama({
      model: routing.localModel,
      prompt: input.prompt,
    });
  }

  const provider =
    resolveLlmProvider(
      process.env.ARTURO_LLM_PROVIDER
    );

  return provider === "gemini"
    ? generateWithGemini(input)
    : generateWithOllama(input);
}

/**
 * The provider the next generateWithConfiguredLlm call goes to, by the same
 * order it uses: a paid model picked in /model, then local-first routing,
 * then ARTURO_LLM_PROVIDER. Recorded in the work send log before the call.
 *
 * SIDE EFFECT: Reads the selected model and the process environment.
 */
export function resolveConfiguredProvider(): { readonly provider: string; readonly routingMode: "single" | "local-first" } {
  const selected = getSelectedModel();
  const routing = getModelRoutingStatus();
  if (selected?.provider === "gemini" || selected?.provider === "anthropic" || selected?.provider === "openai") {
    return { provider: selected.provider, routingMode: routing.mode };
  }
  if (routing.mode === "local-first") return { provider: "ollama", routingMode: routing.mode };
  return { provider: resolveLlmProvider(process.env.ARTURO_LLM_PROVIDER), routingMode: routing.mode };
}

/**
 * Performs one explicitly justified paid escalation after local work failed a
 * deterministic gate. The session budget is reserved before network I/O.
 */
export async function generateWithPaidEscalation(input: {
  readonly prompt: string;
  readonly reason: PaidEscalationReason;
  readonly model?: string;
}): Promise<{ readonly response: string }> {
  const before = getModelRoutingStatus();
  reservePaidEscalation(input.reason);
  try {
    return await generateWithGemini({
      model: input.model ?? before.paidModel!,
      prompt: input.prompt,
    });
  } catch (error) {
    throw new Error(
      [
        error instanceof Error
          ? error.message
          : "External model request failed.",
        describeUnknownEscalationModel(
          input.model ?? before.paidModel
        ),
        "The external-call allowance was reserved before the request and remains consumed.",
      ]
        .filter(Boolean)
        .join(" ")
    );
  }
}

/**
 * Names a configured model Arturo has never heard of, when one fails.
 *
 * A provider answers a model it does not have with whatever status it likes —
 * 503 UNAVAILABLE, in the case that sent three scenario runs looking for an
 * outage that was not happening. "Check provider status and configuration" is
 * true and useless; the configuration is the part worth pointing at, because
 * Arturo already knows the id is not one of its own.
 *
 * Only ever a hint. The catalog is a curated list, not an allowlist — a model
 * newer than this build is legitimate, so this never refuses the call.
 */
function describeUnknownEscalationModel(
  model: string | undefined
): string {
  if (!model) return "";
  const known = CLOUD_CATALOG.filter(
    (entry) => entry.provider === "gemini"
  ).map(
    (entry) => entry.model
  );
  if (known.includes(model)) return "";
  return `"${model}" is not a model Arturo knows about — check ARTURO_PAID_ESCALATION_MODEL and ARTURO_MODEL_PROFILES_JSON. Known Gemini models: ${known.join(", ")}.`;
}

/** Generates with a caller-resolved approved profile. */
export async function generateWithModelProfile(input: {
  readonly provider: LlmProvider;
  readonly model: string;
  readonly prompt: string;
}): Promise<{ readonly response: string }> {
  if (input.provider === "gemini") {
    return generateWithPaidEscalation({
      prompt: input.prompt,
      model: input.model,
      reason: "human-authorized-quality-review",
    });
  }

  return generateWithOllama({
    model: input.model,
    prompt: input.prompt,
  });
}
