import type {
  EventScheduleDayOfWeek,
  EventScheduleFrequency,
  EventScheduleOccurrence,
  EventScheduleOccurrenceStatus,
  EventSchedule,
} from "../scheduling/eventSchedule";

import {
  runtimeDb,
} from "./runtimeDatabase";

type EventScheduleRow = {
  readonly id: string;
  readonly enterpriseId: string;
  readonly owningJobId: string;
  readonly taskId: string;
  readonly taskLabel: string;
  readonly frequency: EventScheduleFrequency;
  readonly dayOfWeek: number | null;
  readonly hour: number;
  readonly minute: number;
  readonly timezone: string;
  readonly searchQuery:
    string |
    null;
  readonly enabled: number;
  readonly nextRunAt: number;
  readonly lastRunAt:
    number |
    null;
  readonly createdAt: number;
};

type EventScheduleOccurrenceRow = {
  readonly id: string;
  readonly scheduleId: string;
  readonly taskId: string | null;
  readonly scheduledFor: number;
  readonly status: EventScheduleOccurrenceStatus;
  readonly reason: string | null;
  readonly worker: string | null;
  readonly recordedAt: number;
};

function rowToEventSchedule(
  row:
    EventScheduleRow
): EventSchedule {
  return {
    id:
      row.id,
    enterpriseId:
      row.enterpriseId,
    owningJobId:
      row.owningJobId,
    taskId:
      row.taskId,
    taskLabel:
      row.taskLabel,
    frequency:
      row.frequency,
    dayOfWeek:
      row.dayOfWeek === null
        ? undefined
        : row.dayOfWeek as EventScheduleDayOfWeek,
    hour:
      row.hour,
    minute:
      row.minute,
    timezone:
      row.timezone,
    searchQuery:
      row.searchQuery ??
      undefined,
    enabled:
      row.enabled ===
      1,
    nextRunAt:
      row.nextRunAt,
    lastRunAt:
      row.lastRunAt ??
      undefined,
    createdAt:
      row.createdAt,
  };
}

function rowToEventScheduleOccurrence(
  row: EventScheduleOccurrenceRow
): EventScheduleOccurrence {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    taskId: row.taskId ?? undefined,
    scheduledFor: row.scheduledFor,
    status: row.status,
    reason: row.reason ?? undefined,
    worker: row.worker ?? undefined,
    recordedAt: row.recordedAt,
  };
}

/** Saves one persistent Event schedule. */
export function savePersistedEventSchedule(
  schedule:
    EventSchedule
): void {
  runtimeDb.prepare(`
    INSERT OR REPLACE INTO event_schedules (
      id,
      enterprise_id,
      source_business_function_id,
      task_id,
      event_label,
      frequency,
      day_of_week,
      hour,
      minute,
      timezone,
      search_query,
      enabled,
      next_run_at,
      last_run_at,
      created_at
    ) VALUES (
      @id,
      @enterpriseId,
      @owningJobId,
      @taskId,
      @taskLabel,
      @frequency,
      @dayOfWeek,
      @hour,
      @minute,
      @timezone,
      @searchQuery,
      @enabled,
      @nextRunAt,
      @lastRunAt,
      @createdAt
    )
  `).run({
    ...schedule,
    searchQuery:
      schedule.searchQuery ??
      null,
    dayOfWeek:
      schedule.dayOfWeek ??
      null,
    enabled:
      schedule.enabled
        ? 1
        : 0,
    lastRunAt:
      schedule.lastRunAt ??
      null,
  });
}

/** Lists persistent Event schedules in creation order. */
export function loadPersistedEventSchedules():
  readonly EventSchedule[] {
  const rows =
    runtimeDb.prepare(`
      SELECT
        id,
        enterprise_id AS enterpriseId,
        source_business_function_id AS owningJobId,
        task_id AS taskId,
        event_label AS taskLabel,
        frequency,
        day_of_week AS dayOfWeek,
        hour,
        minute,
        timezone,
        search_query AS searchQuery,
        enabled,
        next_run_at AS nextRunAt,
        last_run_at AS lastRunAt,
        created_at AS createdAt
      FROM event_schedules
      WHERE task_id IS NOT NULL
      ORDER BY created_at ASC, id ASC
    `).all() as
      EventScheduleRow[];

  return rows.map(
    rowToEventSchedule
  );
}

/** Reads one persistent Event schedule by exact ID. */
export function loadPersistedEventSchedule(
  id: string
): EventSchedule |
  undefined {
  const row =
    runtimeDb.prepare(`
      SELECT
        id,
        enterprise_id AS enterpriseId,
        source_business_function_id AS owningJobId,
        task_id AS taskId,
        event_label AS taskLabel,
        frequency,
        day_of_week AS dayOfWeek,
        hour,
        minute,
        timezone,
        search_query AS searchQuery,
        enabled,
        next_run_at AS nextRunAt,
        last_run_at AS lastRunAt,
        created_at AS createdAt
      FROM event_schedules
      WHERE id = ? AND task_id IS NOT NULL
    `).get(
      id
    ) as
      EventScheduleRow |
      undefined;

  return row
    ? rowToEventSchedule(
        row
      )
    : undefined;
}

/** Saves one immutable scheduled-occurrence record. */
export function savePersistedEventScheduleOccurrence(
  occurrence: EventScheduleOccurrence
): void {
  runtimeDb.prepare(`
    INSERT INTO event_schedule_occurrences (
      id,
      schedule_id,
      task_id,
      scheduled_for,
      status,
      reason,
      worker,
      recorded_at
    ) VALUES (
      @id,
      @scheduleId,
      @taskId,
      @scheduledFor,
      @status,
      @reason,
      @worker,
      @recordedAt
    )
  `).run({
    ...occurrence,
    taskId: occurrence.taskId ?? null,
    reason: occurrence.reason ?? null,
    worker: occurrence.worker ?? null,
  });
}

/** Lists the durable occurrence history for one Event schedule. */
export function loadPersistedEventScheduleOccurrences(
  scheduleId: string
): readonly EventScheduleOccurrence[] {
  const rows =
    runtimeDb.prepare(`
      SELECT
        id,
        schedule_id AS scheduleId,
        task_id AS taskId,
        scheduled_for AS scheduledFor,
        status,
        reason,
        worker,
        recorded_at AS recordedAt
      FROM event_schedule_occurrences
      WHERE schedule_id = ?
      ORDER BY scheduled_for ASC, recorded_at ASC, id ASC
    `).all(scheduleId) as EventScheduleOccurrenceRow[];

  return rows.map(
    rowToEventScheduleOccurrence
  );
}

/** Deletes one Event schedule while preserving already-published Events. */
export function deletePersistedEventSchedule(
  id: string
): boolean {
  return runtimeDb
    .prepare(
      "DELETE FROM event_schedules WHERE id = ?"
    )
    .run(
      id
    ).changes >
    0;
}

/** Clears every Event schedule. */
export function clearPersistedEventSchedules():
  void {
  runtimeDb
    .prepare(
      "DELETE FROM event_schedules"
    )
    .run();
  runtimeDb
    .prepare(
      "DELETE FROM event_schedule_occurrences"
    )
    .run();
}
