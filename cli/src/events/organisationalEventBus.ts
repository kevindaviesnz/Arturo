import {
  appendRuntimeEventToStore,
} from "../runtime/runtimeEventStore";

import type {
  RuntimeEventRecord,
} from "../runtime/runtimeEventLog";

import {
  createOrganisationalEventReactions,
  createOrganisationalRuntimeEventInput,
  type OrganisationalEventInput,
  type OrganisationalEventReaction,
} from "./organisationalEvent";

import {
  evaluateSignalForRunningRuntimes,
  type RuntimeSignalEvaluation,
  type RuntimeSignalReasoner,
} from "../runtime/businessFunctionRuntimeEvaluator";

/**
 * Purpose: Appends one organisational Event to the runtime Event store.
 *
 * Params:
 * - input: Organisational Event input.
 *
 * Returns:
 * - Appended runtime Event record.
 *
 * SIDE EFFECT:
 * - Mutates and persists the runtime Event store.
 */
export function appendOrganisationalEvent(
  input: OrganisationalEventInput
): RuntimeEventRecord {
  return appendRuntimeEventToStore(
    createOrganisationalRuntimeEventInput(
      input,
      crypto.randomUUID(),
      Date.now()
    )
  );
}

/**
 * Purpose: Publishes an organisational Event and matching independent reactions.
 *
 * Params:
 * - input: Organisational Event input.
 * - reactions: Available reaction rules.
 *
 * Returns:
 * - Published Event followed by generated reaction Events.
 *
 * SIDE EFFECT:
 * - Mutates and persists the runtime Event store.
 */
export function publishOrganisationalEventWithReactions(
  input: OrganisationalEventInput,
  reactions: readonly OrganisationalEventReaction[]
): readonly RuntimeEventRecord[] {
  const published =
    appendOrganisationalEvent(
      input
    );

  const reactionRecords =
    createOrganisationalEventReactions(
      input,
      reactions
    ).map(
      appendOrganisationalEvent
    );

  return [
    published,
    ...reactionRecords,
  ];
}

/**
 * Purpose: Publishes an organisational Event without scenario-specific reactions.
 *
 * Params:
 * - input: Organisational Event input.
 *
 * Returns:
 * - Published Event followed by generated reaction Events.
 *
 * SIDE EFFECT:
 * - Mutates and persists the runtime Event store.
 */
export function publishOrganisationalEvent(
  input: OrganisationalEventInput
): readonly RuntimeEventRecord[] {
  return publishOrganisationalEventWithReactions(
    input,
    []
  );
}

export type OrganisationalEventPublication = {
  readonly records: readonly RuntimeEventRecord[];
  readonly evaluations: readonly RuntimeSignalEvaluation[];
};

/**
 * Publishes an organisational signal and lets every running Runtime in the
 * Enterprise evaluate it against its Objective.
 */
export async function publishOrganisationalEventToRuntimes(
  input: OrganisationalEventInput,
  reasoner?: RuntimeSignalReasoner,
  targetRuntimeIds?: readonly string[]
): Promise<OrganisationalEventPublication> {
  const records = publishOrganisationalEvent(input);
  const evaluations = await evaluateSignalForRunningRuntimes(
    input,
    records[0].id,
    reasoner,
    targetRuntimeIds
  );

  return {
    records,
    evaluations,
  };
}
