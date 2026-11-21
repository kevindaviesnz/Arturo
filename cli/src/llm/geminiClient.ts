import {
  GoogleGenAI,
} from "@google/genai";

import {
  recordLlmTokenUsage,
} from "./llmUsage";

type GeminiErrorSummary = {
  readonly code?: number;
  readonly status?: string;
};

/** Extracts non-sensitive provider status without echoing raw response bodies. */
export function summarizeGeminiError(
  error: unknown
): GeminiErrorSummary {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  try {
    const parsed = JSON.parse(message) as {
      readonly error?: {
        readonly code?: unknown;
        readonly status?: unknown;
      };
    };
    return {
      code:
        typeof parsed.error?.code === "number"
          ? parsed.error.code
          : undefined,
      status:
        typeof parsed.error?.status === "string"
          ? parsed.error.status
          : undefined,
    };
  } catch {
    const codeMatch =
      message.match(/\b(4\d\d|5\d\d)\b/);
    const statusMatch =
      message.match(
        /\b(RESOURCE_EXHAUSTED|PERMISSION_DENIED|UNAUTHENTICATED|INVALID_ARGUMENT|NOT_FOUND|INTERNAL|UNAVAILABLE)\b/
      );
    return {
      code:
        codeMatch
          ? Number(codeMatch[1])
          : undefined,
      status:
        statusMatch?.[1],
    };
  }
}

export function formatGeminiFailure(
  error: unknown,
  model: string
): Error {
  const summary =
    summarizeGeminiError(error);
  const detail =
    summary.code === 429 ||
    summary.status === "RESOURCE_EXHAUSTED"
      ? "Provider quota is unavailable or exhausted. Check the active project and model limits in Google AI Studio."
      : summary.code === 401 ||
          summary.code === 403 ||
          summary.status === "PERMISSION_DENIED" ||
          summary.status === "UNAUTHENTICATED"
        ? "Provider authentication or permission was rejected. Check the API key and project access."
        : "The provider rejected or failed the request. Check provider status and configuration.";

  return new Error(
    [
      `Gemini request failed for model ${model}.`,
      summary.code
        ? `HTTP ${summary.code}.`
        : "",
      summary.status
        ? `Status: ${summary.status}.`
        : "",
      detail,
    ].filter(Boolean).join(" ")
  );
}

/**
 * Purpose: Generates text with Gemini.
 *
 * Params:
 * - model: Gemini model name.
 * - prompt: Prompt text.
 *
 * Returns:
 * - Generated response text.
 *
 * SIDE EFFECT:
 * - Reads GEMINI_API_KEY.
 * - Calls Gemini API over the network.
 */
export async function generateWithGemini(input: {
  readonly model: string;
  readonly prompt: string;
}): Promise<{
  readonly response: string;
}> {
  const apiKey =
    process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set"
    );
  }

  const ai =
    new GoogleGenAI({
      apiKey,
    });

  let result;
  try {
    result =
      await ai.models.generateContent({
        model: input.model,
        contents: input.prompt,
      });
  } catch (error) {
    throw formatGeminiFailure(
      error,
      input.model
    );
  }

  recordLlmTokenUsage(
    result.usageMetadata
      ?.totalTokenCount
  );

  return {
    response:
      result.text ?? "",
  };
}
