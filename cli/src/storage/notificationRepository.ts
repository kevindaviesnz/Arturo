import type {
  Notification,
} from "../runtime/notificationStore";

import {
  runtimeDb,
} from "./runtimeDatabase";

/**
 * Converts a notification to a SQLite row.
 *
 * @param notification Notification to convert.
 * @returns SQLite-safe notification row.
 *
 * PURE: No side effects.
 */
export function toNotificationRow(
  notification: Notification
) {
  return {
    id: notification.id,
    level: notification.level,
    title: notification.title,
    message: notification.message,
    jobId: notification.jobId ?? null,
    read: notification.read ? 1 : 0,
    createdAt: notification.createdAt,
  };
}

/**
 * Converts a SQLite row to a notification.
 *
 * @param row SQLite notification row.
 * @returns Notification record.
 *
 * PURE: No side effects.
 */
export function fromNotificationRow(
  row: any
): Notification {
  return {
    id: row.id,
    level: row.level,
    title: row.title,
    message: row.message,
    jobId: row.jobId ?? undefined,
    read: Boolean(row.read),
    createdAt: row.createdAt,
  };
}

/**
 * Inserts or replaces a persisted notification.
 *
 * @param notification Notification to persist.
 * @returns void
 *
 * SIDE EFFECT: Writes notification state into SQLite.
 */
export function saveNotification(
  notification: Notification
): void {
  runtimeDb
    .prepare(`
      INSERT OR REPLACE INTO notifications (
        id,
        level,
        title,
        message,
        job_id,
        read,
        created_at
      )
      VALUES (
        @id,
        @level,
        @title,
        @message,
        @jobId,
        @read,
        @createdAt
      )
    `)
    .run(
      toNotificationRow(
        notification
      )
    );
}

/**
 * Loads all persisted notifications newest first.
 *
 * @returns Persisted notifications.
 *
 * SIDE EFFECT: Reads notifications from SQLite.
 */
export function loadNotifications():
  Notification[] {
  const rows =
    runtimeDb
      .prepare(`
        SELECT
          id,
          level,
          title,
          message,
          job_id as jobId,
          read,
          created_at as createdAt
        FROM notifications
        ORDER BY created_at DESC
      `)
      .all();

  return rows.map(
    fromNotificationRow
  );
}

/**
 * Clears all persisted notifications.
 *
 * @returns void
 *
 * SIDE EFFECT: Deletes notification rows from SQLite.
 */
export function clearPersistedNotifications():
  void {
  runtimeDb
    .prepare(
      "DELETE FROM notifications"
    )
    .run();
}
