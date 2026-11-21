/**
 * A curated list of well-known models Arturo can run, shown by /model so a
 * first-time user can pick from real options instead of having to know a model
 * name. It is not exhaustive — /model always also lets the operator type an
 * exact model name of their own.
 *
 * Only providers Arturo has a working client for appear here: local models
 * through Ollama (free, private, downloadable), and Anthropic Claude, OpenAI
 * GPT, and Google Gemini (all paid, all need an API key).
 */

export type CatalogModel = {
  readonly provider: "ollama" | "gemini" | "anthropic" | "openai";
  /** Exact model id passed to the provider. */
  readonly model: string;
  /** Friendly, plain-language one-liner shown to the operator. */
  readonly note: string;
  /** Rough size guidance for a downloadable local model. */
  readonly sizeHint?: string;
  /**
   * The download size in GB, for deciding whether the machine can run it.
   * `sizeHint` is prose for the operator; this is the number the precheck in
   * `modelFit.ts` compares against physical memory.
   */
  readonly approximateGb?: number;
};

/** Free models that run on this computer through Ollama. */
export const LOCAL_CATALOG: readonly CatalogModel[] = [
  { provider: "ollama", model: "llama3.2", note: "Small and fast — a good default for most machines.", sizeHint: "about 2 GB", approximateGb: 2 },
  { provider: "ollama", model: "qwen2.5", note: "Strong all-rounder, good at structured answers.", sizeHint: "about 5 GB", approximateGb: 5 },
  { provider: "ollama", model: "mistral", note: "Fast and capable general-purpose model.", sizeHint: "about 4 GB", approximateGb: 4 },
  { provider: "ollama", model: "gemma2", note: "Google's compact open model.", sizeHint: "about 5 GB", approximateGb: 5 },
  { provider: "ollama", model: "llama3.3", note: "Large and high-quality — needs a powerful computer.", sizeHint: "about 40 GB", approximateGb: 40 },
];

/**
 * Paid models that run on an external service and need an API key. Model names
 * on paid providers change over time; the operator can always type an exact
 * name instead of picking one of these.
 */
export const CLOUD_CATALOG: readonly CatalogModel[] = [
  { provider: "anthropic", model: "claude-haiku-4-5", note: "Anthropic Claude — fast and inexpensive. Needs an Anthropic API key." },
  { provider: "anthropic", model: "claude-sonnet-5", note: "Anthropic Claude — strong all-rounder, mid price. Needs an Anthropic API key." },
  { provider: "anthropic", model: "claude-opus-4-8", note: "Anthropic Claude — highest quality, costs more. Needs an Anthropic API key." },
  { provider: "openai", model: "gpt-4o-mini", note: "OpenAI GPT — fast and inexpensive. Needs an OpenAI API key." },
  { provider: "openai", model: "gpt-4o", note: "OpenAI GPT — strong all-rounder, mid price. Needs an OpenAI API key." },
  { provider: "gemini", model: "gemini-2.5-flash", note: "Google Gemini — fast and inexpensive. Needs a Google API key." },
  { provider: "gemini", model: "gemini-2.5-pro", note: "Google Gemini — highest quality, costs more. Needs a Google API key." },
];

/** The environment variable that holds a provider's API key. */
export function apiKeyEnvVar(
  provider: CatalogModel["provider"]
): string | undefined {
  if (provider === "gemini") return "GEMINI_API_KEY";
  if (provider === "anthropic") return "ANTHROPIC_API_KEY";
  if (provider === "openai") return "OPENAI_API_KEY";
  return undefined;
}

/** Human-facing provider name. */
export function providerLabel(
  provider: CatalogModel["provider"]
): string {
  if (provider === "gemini") return "Google Gemini";
  if (provider === "anthropic") return "Anthropic Claude";
  if (provider === "openai") return "OpenAI GPT";
  return "Ollama (local)";
}

/** Where an operator gets an API key for a provider. */
export function apiKeyHelpUrl(
  provider: CatalogModel["provider"]
): string | undefined {
  if (provider === "gemini") return "https://aistudio.google.com/apikey";
  if (provider === "anthropic") return "https://console.anthropic.com/settings/keys";
  if (provider === "openai") return "https://platform.openai.com/api-keys";
  return undefined;
}
