import {
  clearRuntimeSetting,
  loadRuntimeSetting,
  saveRuntimeSetting,
} from "../storage/settingsRepository";

/**
 * The operator's persisted model choice, made through /model.
 *
 * One rule above all: Arturo never routes to a paid model by default. A paid
 * selection can only exist here because the operator explicitly picked it and
 * confirmed the cost, and even then every call still goes through the
 * fail-closed, budget-capped escalation path. Clearing the selection returns
 * to the local default.
 */

const SELECTED_PROVIDER_KEY = "model.selected.provider";
const SELECTED_MODEL_KEY = "model.selected.model";

export type ModelSelection = {
  readonly provider: "ollama" | "gemini" | "anthropic" | "openai";
  readonly model: string;
};

/**
 * Reads the persisted selection, if the operator has made one.
 *
 * SIDE EFFECT: Reads the runtime settings store.
 */
export function getSelectedModel(): ModelSelection | undefined {
  const provider = loadRuntimeSetting(SELECTED_PROVIDER_KEY);
  const model = loadRuntimeSetting(SELECTED_MODEL_KEY)?.trim();

  if (
    (provider !== "ollama" &&
      provider !== "gemini" &&
      provider !== "anthropic" &&
      provider !== "openai") ||
    !model
  ) {
    return undefined;
  }

  return {
    provider,
    model,
  };
}

/**
 * Persists the operator's model choice.
 *
 * SIDE EFFECT: Writes the runtime settings store.
 */
export function setSelectedModel(
  selection: ModelSelection
): void {
  saveRuntimeSetting(SELECTED_PROVIDER_KEY, selection.provider);
  saveRuntimeSetting(SELECTED_MODEL_KEY, selection.model);
}

/**
 * Clears the selection, returning Arturo to the local default.
 *
 * SIDE EFFECT: Writes the runtime settings store.
 */
export function clearSelectedModel(): void {
  clearRuntimeSetting(SELECTED_PROVIDER_KEY);
  clearRuntimeSetting(SELECTED_MODEL_KEY);
}

/**
 * The model that will actually be called right now.
 *
 * The model is chosen in exactly one place — /model — and the choice holds
 * until it is run again. Nothing else may name a different model: a Worker
 * record or a capability attestation that names a model which was never called
 * is worse than no record at all, because it looks like provenance.
 *
 * SIDE EFFECT: Reads the runtime settings store and the environment.
 */
export function getEffectiveModelName(): string {
  return (
    getSelectedModel()?.model ??
    process.env.ARTURO_LLM_MODEL ??
    "llama3.2:latest"
  );
}
