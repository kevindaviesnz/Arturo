import type {
  WorkerCapability,
} from "../control/workers";

export const JOB_COMPLETION_EVENT_TRIGGER =
  "job.completed" as const;

export type JobCompletionEventRule = {
  readonly id: string;
  readonly enterpriseId: string;
  readonly sourceBusinessFunctionId: string;
  readonly triggerType:
    typeof JOB_COMPLETION_EVENT_TRIGGER;
  readonly requiredCapability?:
    WorkerCapability;
  readonly publishedEventLabel:
    string;
  readonly enabled:
    boolean;
  readonly createdAt:
    number;
};

export type CreateJobCompletionEventRuleInput = {
  readonly enterpriseId:
    string;
  readonly sourceBusinessFunctionId:
    string;
  readonly triggerType?:
    typeof JOB_COMPLETION_EVENT_TRIGGER;
  readonly requiredCapability?:
    WorkerCapability;
  readonly publishedEventLabel:
    string;
  readonly now?:
    number;
};

/** Creates one deterministic post-Job Event rule after validating its fields. */
export function createJobCompletionEventRule(
  input:
    CreateJobCompletionEventRuleInput
): JobCompletionEventRule {
  const enterpriseId =
    input.enterpriseId
      .trim();
  const sourceBusinessFunctionId =
    input
      .sourceBusinessFunctionId
      .trim();
  const publishedEventLabel =
    input
      .publishedEventLabel
      .replace(
        /\s+/g,
        " "
      )
      .trim();
  const triggerType =
    input.triggerType ??
    JOB_COMPLETION_EVENT_TRIGGER;

  if (!enterpriseId) {
    throw new Error(
      "An Enterprise is required for an Event rule."
    );
  }
  if (!sourceBusinessFunctionId) {
    throw new Error(
      "A source Function is required for an Event rule."
    );
  }
  if (
    triggerType !==
    JOB_COMPLETION_EVENT_TRIGGER
  ) {
    throw new Error(
      "Event rules currently support only --when task.completed."
    );
  }
  if (!publishedEventLabel) {
    throw new Error(
      "The published Event label must be non-empty."
    );
  }
  if (
    publishedEventLabel
      .length >
    200
  ) {
    throw new Error(
      "The published Event label must not exceed 200 characters."
    );
  }

  return {
    id:
      `event-rule-${crypto.randomUUID()}`,
    enterpriseId,
    sourceBusinessFunctionId,
    triggerType,
    requiredCapability:
      input
        .requiredCapability,
    publishedEventLabel,
    enabled:
      true,
    createdAt:
      input.now ??
      Date.now(),
  };
}
