import {
  createEventSchedule,
  type EventScheduleOccurrence,
  type EventScheduleOccurrenceStatus,
  type CreateEventScheduleInput,
  type EventSchedule,
} from "./eventSchedule";

import {
  clearPersistedEventSchedules,
  deletePersistedEventSchedule,
  loadPersistedEventSchedule,
  loadPersistedEventScheduleOccurrences,
  loadPersistedEventSchedules,
  savePersistedEventScheduleOccurrence,
  savePersistedEventSchedule,
} from "../storage/eventScheduleRepository";

/** Adds one unique recurring Task schedule. */
export function addEventSchedule(
  input:
    CreateEventScheduleInput
): EventSchedule {
  const schedule =
    createEventSchedule(
      input
    );
  const duplicate =
    listEventSchedules()
      .find(
        (existing) =>
          existing.enabled &&
          existing.enterpriseId ===
            schedule.enterpriseId &&
          existing.owningJobId ===
            schedule.owningJobId &&
          existing.taskLabel
            .toLowerCase() ===
            schedule.taskLabel
              .toLowerCase() &&
          existing.frequency ===
            schedule.frequency &&
          existing.dayOfWeek ===
            schedule.dayOfWeek &&
          existing.hour ===
            schedule.hour &&
          existing.minute ===
            schedule.minute &&
          existing.timezone ===
            schedule.timezone
      );
  if (duplicate) {
    throw new Error(
      `An equivalent Task schedule already exists: ${duplicate.id}`
    );
  }

  savePersistedEventSchedule(
    schedule
  );
  return schedule;
}

/** Lists all recurring Task schedules. */
export function listEventSchedules():
  readonly EventSchedule[] {
  return loadPersistedEventSchedules();
}

/** Reads one recurring Task schedule by exact ID. */
export function getEventSchedule(
  id: string
): EventSchedule |
  undefined {
  return loadPersistedEventSchedule(
    id
  );
}

/** Replaces one existing recurring Task schedule. */
export function replaceEventSchedule(
  schedule:
    EventSchedule
): EventSchedule {
  if (
    !getEventSchedule(
      schedule.id
    )
  ) {
    throw new Error(
      `Task schedule not found: ${schedule.id}`
    );
  }
  savePersistedEventSchedule(
    schedule
  );
  return schedule;
}

/** Records one immutable result for a scheduled occurrence. */
export function recordEventScheduleOccurrence(
  input: {
    readonly scheduleId: string;
    readonly taskId?: string;
    readonly scheduledFor: number;
    readonly status: EventScheduleOccurrenceStatus;
    readonly reason?: string;
    readonly worker?: string;
    readonly now?: number;
    readonly id?: string;
  }
): EventScheduleOccurrence {
  const occurrence: EventScheduleOccurrence = {
    id: input.id ?? crypto.randomUUID(),
    scheduleId: input.scheduleId,
    taskId: input.taskId,
    scheduledFor: input.scheduledFor,
    status: input.status,
    reason: input.reason,
    worker: input.worker,
    recordedAt: input.now ?? Date.now(),
  };
  savePersistedEventScheduleOccurrence(
    occurrence
  );
  return occurrence;
}

/** Lists recorded queues and skips for one recurring Task schedule. */
export function listEventScheduleOccurrences(
  scheduleId: string
): readonly EventScheduleOccurrence[] {
  return loadPersistedEventScheduleOccurrences(
    scheduleId
  );
}

/** Removes one Task schedule without deleting prior occurrence history. */
export function removeEventSchedule(
  id: string
): EventSchedule |
  undefined {
  const schedule =
    getEventSchedule(
      id
    );
  if (!schedule) {
    return undefined;
  }
  deletePersistedEventSchedule(
    id
  );
  return schedule;
}

/** Clears every Task schedule. */
export function clearEventSchedules():
  void {
  clearPersistedEventSchedules();
}
