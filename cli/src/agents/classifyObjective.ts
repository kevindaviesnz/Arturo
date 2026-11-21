import { buildEnterpriseRepairPrompt } from "../prompts/enterprisePrompt";
import {
  generateWithOllama,
} from "../llm/ollamaClient";

import {
  buildObjectiveClassificationPrompt,
} from "./buildObjectiveClassificationPrompt";

import type {
  ObjectiveClassification,
} from "./objective";

import {
  parseObjectiveClassification,
} from "./objectiveValidation";
import { resolveConfiguredLlmModel } from "../config/llmConfig";

/**
 * Purpose: Classifies a user request into an Arturo objective.
 *
 * Params:
 * - request: Raw user request.
 *
 * Returns:
 * - Objective classification.
 *
 * SIDE EFFECT:
 * - Calls Ollama and validates its structured response.
 */
export async function classifyObjective(
  request: string
): Promise<ObjectiveClassification> {
  const model =
    resolveConfiguredLlmModel();
  const prompt =
    buildObjectiveClassificationPrompt(
      request
    );

  let response =
    (
      await generateWithOllama({
        model,
        prompt,
      })
    ).response;
  let lastError: unknown;

  // A local model produces malformed structured output intermittently, and this
  // is the first step of /ask — so one bad reply used to end the whole workflow
  // with a raw schema error and nothing created. The staffing planner already
  // solved this by showing the model its own invalid response and asking for a
  // correction; the same loop belongs here.
  for (
    let attempt = 0;
    attempt <= 2;
    attempt += 1
  ) {
    try {
      return parseObjectiveClassification(
        response
      );
    } catch (error: unknown) {
      lastError = error;
      if (attempt === 2) break;

      response =
        (
          await generateWithOllama({
            model,
            prompt: buildEnterpriseRepairPrompt(prompt, response, error instanceof Error ? error.message : String(error)),
          })
        ).response;
    }
  }

  // What reaches the operator. The schema wording is kept at the end for a
  // developer, but it is no longer the whole message: "reason must be a string"
  // told the person who typed /ask nothing they could act on.
  throw new Error(
    [
      `Arturo could not work out what "${request}" is asking for.`,
      "",
      "Describe the outcome you want in a sentence — for example",
      '"Find suppliers of organic cotton fabric" — rather than naming a Worker',
      "or a Function.",
      "",
      `(The model's reply did not match the expected shape after 3 attempts: ${
        lastError instanceof Error
          ? lastError.message
          : String(lastError)
      })`,
    ].join("\n")
  );
}
