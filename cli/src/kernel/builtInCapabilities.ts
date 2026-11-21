import {
  createCapabilityDefinition,
} from "./capabilityDefinition";

import {
  createCapabilityRegistry,
} from "./capabilityRegistry";

import {
  createCapabilitySchema,
  createObjectCapabilitySchema,
} from "./capabilitySchema";

import {
  webhookCapabilityDefinition,
} from "../integrations/webhookCapabilityDefinition";

/**
 * How long a Worker's model is given to research or write before the Task is
 * failed.
 *
 * It was thirty seconds. A local model asked for three design briefs from an
 * 11 KB document was cut off with "Capability writing timed out after
 * 30000ms", and so would any writing Task of real length have been: review,
 * summarising and analysis carry no limit at all, so the same request worded
 * as a review ran to completion. Ten minutes still ends a model that has hung,
 * and leaves room for the second attempt the integrity checks may ask for.
 */
export const MODEL_WORK_TIMEOUT_MS = 10 * 60 * 1000;

export const builtInCapabilities = [
  createCapabilityDefinition({
    id: "research",
    description:
      "Researches a topic and returns notes.",
    riskLevel: "low",
    requiresApproval: false,
    timeoutMs: MODEL_WORK_TIMEOUT_MS,
    version: "1.0.0",
    inputSchema:
      createCapabilitySchema("string"),
    outputSchema:
      createCapabilitySchema("string"),
  }),

  createCapabilityDefinition({
    id: "writing",
    description:
      "Writes or rewrites content from provided input.",
    riskLevel: "low",
    requiresApproval: false,
    timeoutMs: MODEL_WORK_TIMEOUT_MS,
    version: "1.0.0",
    inputSchema:
      createCapabilitySchema("any"),
    outputSchema:
      createCapabilitySchema("any"),
  }),

  createCapabilityDefinition({
    id: "human-review",
    description:
      "Pauses execution until a human reviews and approves or rejects the input.",
    riskLevel: "medium",
    requiresApproval: true,
    timeoutMs: 0,
    version: "1.0.0",
    inputSchema:
      createCapabilitySchema("any"),
    outputSchema:
      createCapabilitySchema("any"),
  }),

  createCapabilityDefinition({
    id: "email.send",
    description:
      "Sends an email to one or more recipients.",
    riskLevel: "high",
    requiresApproval: true,
    timeoutMs: 30000,
    version: "1.0.0",
    inputSchema:
      createObjectCapabilitySchema({
        to:
          createCapabilitySchema(
            "string"
          ),
        subject:
          createCapabilitySchema(
            "string"
          ),
        body:
          createCapabilitySchema(
            "string"
          ),
      }),
    outputSchema:
      createCapabilitySchema("any"),
  }),

  createCapabilityDefinition({
    id: "shell.exec",
    description:
      "Executes a shell command.",
    riskLevel: "critical",
    requiresApproval: true,
    timeoutMs: 30000,
    version: "1.0.0",
    inputSchema:
      createCapabilitySchema("string"),
    outputSchema:
      createCapabilitySchema("any"),
  }),

  createCapabilityDefinition({
    id: "file.delete",
    description:
      "Deletes a file from disk.",
    riskLevel: "critical",
    requiresApproval: true,
    timeoutMs: 30000,
    version: "1.0.0",
    inputSchema:
      createCapabilitySchema("string"),
    outputSchema:
      createCapabilitySchema("any"),
  }),

  createCapabilityDefinition({
    id: "http.get",
    description:
      "Performs an HTTPS GET request and returns parsed JSON.",
    riskLevel: "medium",
    requiresApproval: true,
    timeoutMs: 5000,
    version: "1.0.0",
    inputSchema:
      createObjectCapabilitySchema({
        url:
          createCapabilitySchema(
            "string"
          ),
        timeoutMs:
          createCapabilitySchema(
            "number"
          ),
      }),
    outputSchema:
      createCapabilitySchema("any"),
  }),

  webhookCapabilityDefinition,
];

export const builtInCapabilityRegistry =
  createCapabilityRegistry(
    builtInCapabilities
  );