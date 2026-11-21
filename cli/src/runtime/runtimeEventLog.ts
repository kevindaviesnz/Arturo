export type RuntimeEventLevel =
  | "info"
  | "success"
  | "warn"
  | "error";

export type RuntimeEventRecord = {
  sequence: number;
  id: string;
  type: string;
  level: RuntimeEventLevel;
  message: string;
  timestamp: number;
  payload?: unknown;
};

export type RuntimeEventLog = {
  nextSequence: number;
  events: RuntimeEventRecord[];
};

export type RuntimeEventInput = {
  id: string;
  type: string;
  level: RuntimeEventLevel;
  message: string;
  timestamp: number;
  payload?: unknown;
};

/**
 * Creates an empty runtime event log.
 *
 * @returns Empty runtime event log.
 *
 * PURE: No side effects.
 */
export function createRuntimeEventLog():
  RuntimeEventLog {
  return {
    nextSequence: 1,
    events: [],
  };
}

/**
 * Creates a runtime event record from input and sequence.
 *
 * @param sequence Event sequence number.
 * @param input Event input data.
 * @returns Runtime event record.
 *
 * PURE: No side effects.
 */
export function createRuntimeEventRecord(
  sequence: number,
  input: RuntimeEventInput
): RuntimeEventRecord {
  return {
    sequence,
    id: input.id,
    type: input.type,
    level: input.level,
    message: input.message,
    timestamp: input.timestamp,
    payload: input.payload,
  };
}

/**
 * Appends an event to a runtime event log.
 *
 * @param log Existing runtime event log.
 * @param input Event input data.
 * @returns New runtime event log with appended event.
 *
 * PURE: No side effects.
 */
export function appendRuntimeEvent(
  log: RuntimeEventLog,
  input: RuntimeEventInput
): RuntimeEventLog {
  const event =
    createRuntimeEventRecord(
      log.nextSequence,
      input
    );

  return {
    nextSequence:
      log.nextSequence + 1,
    events: [
      ...log.events,
      event,
    ],
  };
}

/**
 * Lists runtime events in sequence order.
 *
 * @param log Runtime event log.
 * @returns Runtime event records.
 *
 * PURE: No side effects.
 */
export function listRuntimeEvents(
  log: RuntimeEventLog
): RuntimeEventRecord[] {
  return [
    ...log.events,
  ];
}

/**
 * Gets the latest event from a runtime event log.
 *
 * @param log Runtime event log.
 * @returns Latest event or undefined.
 *
 * PURE: No side effects.
 */
export function getLatestRuntimeEvent(
  log: RuntimeEventLog
): RuntimeEventRecord | undefined {
  return log.events[
    log.events.length - 1
  ];
}

/**
 * Serializes runtime event log.
 *
 * @param log Runtime event log.
 * @returns Serialized JSON string.
 *
 * PURE: No side effects.
 */
export function serializeRuntimeEventLog(
  log: RuntimeEventLog
): string {
  return JSON.stringify(
    log,
    null,
    2
  );
}

/**
 * Parses serialized runtime event log.
 *
 * @param value Serialized runtime event log JSON.
 * @returns Parsed runtime event log.
 *
 * PURE: No side effects.
 */
export function parseRuntimeEventLog(
  value: string
): RuntimeEventLog {
  return JSON.parse(
    value
  );
}