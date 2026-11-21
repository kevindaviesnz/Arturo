import type {
  RuntimeEventInput,
} from "../runtime/runtimeEventLog";

export type OrganisationalEventPayload =
  Record<string, string | number | boolean>;

export type OrganisationalEventInput = {
  readonly label: string;
  readonly enterpriseName: string;
  readonly sourceBusinessFunction: string;
  readonly payload?: OrganisationalEventPayload;
};

export type OrganisationalEventReaction = {
  readonly observedEventLabel: string;
  readonly observedSourceBusinessFunction?: string;
  readonly observingBusinessFunction: string;
  readonly publishedEventLabel?: string;
};

/**
 * Purpose: Converts an organisational Event label into a stable Event type.
 *
 * Params:
 * - label: Organisational Event label.
 *
 * Returns:
 * - Stable runtime Event type.
 *
 * PURE: No side effects.
 */
export function organisationalEventType(
  label: string
): string {
  return `business.${label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")}`;
}

/**
 * Purpose: Formats an organisational Event message.
 *
 * Params:
 * - input: Organisational Event input.
 *
 * Returns:
 * - Human-readable Event message.
 *
 * PURE: No side effects.
 */
export function formatOrganisationalEventMessage(
  input: OrganisationalEventInput
): string {
  return [
    input.label,
    `source: ${input.sourceBusinessFunction}`,
    `enterprise: ${input.enterpriseName}`,
  ].join(" — ");
}

/**
 * Purpose: Converts an organisational Event into a runtime Event input.
 *
 * Params:
 * - input: Organisational Event input.
 * - id: Runtime Event id.
 * - timestamp: Event timestamp.
 *
 * Returns:
 * - Runtime Event input.
 *
 * PURE: No side effects.
 */
export function createOrganisationalRuntimeEventInput(
  input: OrganisationalEventInput,
  id: string,
  timestamp: number
): RuntimeEventInput {
  return {
    id,
    type: organisationalEventType(
      input.label
    ),
    level: "success",
    message: formatOrganisationalEventMessage(
      input
    ),
    timestamp,
    payload: {
      enterpriseName:
        input.enterpriseName,
      sourceBusinessFunction:
        input.sourceBusinessFunction,
      fact:
        input.label,
      ...(input.payload ?? {}),
    },
  };
}

/**
 * Purpose: Checks whether a reaction observes a published organisational Event.
 *
 * Params:
 * - reaction: Reaction rule.
 * - input: Published organisational Event.
 *
 * Returns:
 * - True when the reaction applies.
 *
 * PURE: No side effects.
 */
export function reactionMatchesEvent(
  reaction: OrganisationalEventReaction,
  input: OrganisationalEventInput
): boolean {
  const labelMatches =
    reaction.observedEventLabel === input.label;

  const sourceMatches =
    !reaction.observedSourceBusinessFunction ||
    reaction.observedSourceBusinessFunction ===
      input.sourceBusinessFunction;

  return labelMatches && sourceMatches;
}

/**
 * Purpose: Creates a reaction Event from a matching reaction rule.
 *
 * Params:
 * - reaction: Matching reaction rule.
 * - input: Original published Event.
 *
 * Returns:
 * - Follow-up organisational Event or undefined.
 *
 * PURE: No side effects.
 */
export function createReactionEvent(
  reaction: OrganisationalEventReaction,
  input: OrganisationalEventInput
): OrganisationalEventInput | undefined {
  if (!reaction.publishedEventLabel) {
    return undefined;
  }

  return {
    label:
      reaction.publishedEventLabel,
    enterpriseName:
      input.enterpriseName,
    sourceBusinessFunction:
      reaction.observingBusinessFunction,
    payload:
      input.payload,
  };
}

/**
 * Purpose: Creates organisational Events produced by reaction rules.
 *
 * Params:
 * - input: Published organisational Event.
 * - reactions: Available reaction rules.
 *
 * Returns:
 * - Follow-up organisational Events.
 *
 * PURE: No side effects.
 */
export function createOrganisationalEventReactions(
  input: OrganisationalEventInput,
  reactions: readonly OrganisationalEventReaction[]
): readonly OrganisationalEventInput[] {
  return reactions
    .filter(
      (reaction) =>
        reactionMatchesEvent(
          reaction,
          input
        )
    )
    .map(
      (reaction) =>
        createReactionEvent(
          reaction,
          input
        )
    )
    .filter(
      (
        event
      ): event is OrganisationalEventInput =>
        event !== undefined
    );
}

/**
 * Purpose: Creates the Chapter 17 default retailer reaction rules.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Default organisational Event reaction rules.
 *
 * PURE: No side effects.
 */
export function createDefaultOrganisationalEventReactions():
  readonly OrganisationalEventReaction[] {
  return [
    {
      observedEventLabel:
        "Order Accepted",
      observedSourceBusinessFunction:
        "Order Processing",
      observingBusinessFunction:
        "Inventory",
      publishedEventLabel:
        "Stock Reserved",
    },
  ];
}