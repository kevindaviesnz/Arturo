/** Resolves the model used by every configured LLM call. */
export function resolveConfiguredLlmModel(
  environment: Readonly<Record<string, string | undefined>> = process.env
): string {
  return environment.ARTURO_LLM_MODEL?.trim() || "llama3.2:latest";
}
