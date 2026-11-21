import Anthropic from "@anthropic-ai/sdk";

import {
  recordLlmTokenUsage,
} from "./llmUsage";

/**
 * Client for Anthropic's Claude models. Mirrors the Gemini client: it is a
 * paid, external provider, reached only when the operator explicitly selects a
 * Claude model in /model and supplies an ANTHROPIC_API_KEY. Nothing here runs
 * by default — local Ollama remains the default route.
 */

type AnthropicErrorSummary = {
  readonly status?: number;
  readonly type?: string;
};

/** Extracts non-sensitive provider status without echoing raw response bodies. */
export function summarizeAnthropicError(
  error: unknown
): AnthropicErrorSummary {
  if (error instanceof Anthropic.APIError) {
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

export function formatAnthropicFailure(
  error: unknown,
  model: string
): Error {
  const summary = summarizeAnthropicError(error);
  const detail =
    summary.status === 429
      ? "The Claude account is rate-limited or out of quota. Check usage and limits in the Anthropic console."
      : summary.status === 401 || summary.status === 403
        ? "The Anthropic API key was rejected. Run /model to re-enter a valid key."
        : "Claude rejected or failed the request. Check the model name and account status.";

  return new Error(
    [
      `Claude request failed for model ${model}.`,
      summary.status ? `HTTP ${summary.status}.` : "",
      detail,
    ].filter(Boolean).join(" ")
  );
}

/**
 * Generates text with a Claude model.
 *
 * SIDE EFFECT:
 * - Reads ANTHROPIC_API_KEY.
 * - Calls the Anthropic API over the network.
 */
export async function generateWithAnthropic(input: {
  readonly model: string;
  readonly prompt: string;
}): Promise<{
  readonly response: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic({ apiKey });

  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model: input.model,
      max_tokens: 16000,
      messages: [
        { role: "user", content: input.prompt },
      ],
    });
  } catch (error) {
    throw formatAnthropicFailure(error, input.model);
  }

  recordLlmTokenUsage(
    (message.usage.input_tokens ?? 0) +
    (message.usage.output_tokens ?? 0)
  );

  // Content is a list of blocks; concatenate the text blocks.
  const text = message.content
    .filter(
      (block): block is Anthropic.TextBlock => block.type === "text"
    )
    .map((block) => block.text)
    .join("");

  return { response: text };
}
