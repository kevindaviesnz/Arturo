import OpenAI from "openai";

import {
  recordLlmTokenUsage,
} from "./llmUsage";

/**
 * Client for OpenAI's GPT models. Mirrors the Anthropic and Gemini clients: a
 * paid, external provider reached only when the operator explicitly selects a
 * GPT model in /model and supplies an OPENAI_API_KEY. Nothing here runs by
 * default — local Ollama remains the default route.
 */

type OpenAiErrorSummary = {
  readonly status?: number;
  readonly type?: string;
};

/** Extracts non-sensitive provider status without echoing raw response bodies. */
export function summarizeOpenAiError(
  error: unknown
): OpenAiErrorSummary {
  if (error instanceof OpenAI.APIError) {
    return {
      status: error.status,
      type:
        typeof (error as { type?: unknown }).type === "string"
          ? (error as { type?: string }).type
          : undefined,
    };
  }

  return {};
}

export function formatOpenAiFailure(
  error: unknown,
  model: string
): Error {
  const summary = summarizeOpenAiError(error);
  const detail =
    summary.status === 429
      ? "The OpenAI account is rate-limited or out of quota. Check usage and limits in the OpenAI dashboard."
      : summary.status === 401 || summary.status === 403
        ? "The OpenAI API key was rejected. Run /model to re-enter a valid key."
        : "OpenAI rejected or failed the request. Check the model name and account status.";

  return new Error(
    [
      `OpenAI request failed for model ${model}.`,
      summary.status ? `HTTP ${summary.status}.` : "",
      detail,
    ].filter(Boolean).join(" ")
  );
}

/**
 * Generates text with a GPT model.
 *
 * SIDE EFFECT:
 * - Reads OPENAI_API_KEY.
 * - Calls the OpenAI API over the network.
 */
export async function generateWithOpenAi(input: {
  readonly model: string;
  readonly prompt: string;
}): Promise<{
  readonly response: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const client = new OpenAI({ apiKey });

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    completion = await client.chat.completions.create({
      model: input.model,
      // max_completion_tokens (not the legacy max_tokens) so both GPT and the
      // reasoning o-series models are accepted; the latter reject max_tokens.
      max_completion_tokens: 16000,
      messages: [
        { role: "user", content: input.prompt },
      ],
    });
  } catch (error) {
    throw formatOpenAiFailure(error, input.model);
  }

  recordLlmTokenUsage(
    completion.usage?.total_tokens ?? 0
  );

  return {
    response: completion.choices[0]?.message?.content ?? "",
  };
}
