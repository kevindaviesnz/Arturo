import {
  recordLlmTokenUsage,
} from "./llmUsage";

const DEFAULT_OLLAMA_GENERATE_URL =
  "http://127.0.0.1:11434/api/generate";

export type OllamaGenerateParams = {
  model: string;
  prompt: string;
};

export type OllamaGenerateResult = {
  response: string;
};

/** Removes credentials and query parameters from an endpoint shown in errors. */
export function formatSafeOllamaUrl(
  value: string
): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.host}${url.pathname}`;
  } catch {
    return "(invalid configured URL)";
  }
}

/**
 * Gets the Ollama generate endpoint URL.
 *
 * @returns Ollama generate endpoint URL.
 *
 * SIDE EFFECT:
 * - Reads process.env.
 */
export function getOllamaGenerateUrl(): string {
  return (
    process.env.OLLAMA_URL ??
    process.env.OLLAMA_GENERATE_URL ??
    DEFAULT_OLLAMA_GENERATE_URL
  );
}

/**
 * Generates text using local Ollama.
 *
 * @param params Model and prompt.
 * @returns Generated response text.
 *
 * SIDE EFFECT:
 * - Performs HTTP request to the configured Ollama server.
 */
export async function generateWithOllama(
  params: OllamaGenerateParams
): Promise<OllamaGenerateResult> {
  const ollamaUrl =
    getOllamaGenerateUrl();

  let response: Response;
  try {
    response =
      await fetch(
        ollamaUrl,
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            model:
              params.model,
            prompt:
              params.prompt,
            stream:
              false,
          }),
        }
      );
  } catch {
    // A connection failure here almost always means the local model server
    // isn't running. "fetch failed" means nothing to a first-time user, so
    // translate it into plain words that name the cause and the fix. Every
    // model-backed command inherits this message.
    throw new Error(
      "Arturo could not reach the local AI model. The model server (Ollama) may not be running. Run /model to check it, start it, or set one up — then try again."
    );
  }

  if (!response.ok) {
    const responseBody =
      await response.text();

    throw new Error(
      [
        "Ollama request failed.",
        `HTTP Status: ${response.status}`,
        `URL: ${formatSafeOllamaUrl(ollamaUrl)}`,
        `Model: ${params.model}`,
        `Response: ${responseBody.slice(0, 500)}`,
      ].join(" ")
    );
  }

  const json =
    await response.json() as {
      readonly response?: string;
      readonly prompt_eval_count?: number;
      readonly eval_count?: number;
    };

  recordLlmTokenUsage(
    (json.prompt_eval_count ?? 0) +
    (json.eval_count ?? 0)
  );

  return {
    response:
      json.response ?? "",
  };
}
