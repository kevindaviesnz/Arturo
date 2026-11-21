import {
  clearPersistedNotifications,
  loadNotifications,
  saveNotification,
} from "../storage/notificationRepository";

export type NotificationLevel =
  | "info"
  | "success"
  | "warn"
  | "error";

export type Notification = {
  id: string;

  level: NotificationLevel;

  title: string;

  message: string;

  jobId?: string;

  read: boolean;

  createdAt: number;
};

let notifications: Notification[] =
  loadNotifications();

/**
 * Creates an immutable notification record.
 *
 * @param level Notification severity.
 * @param title Short notification title.
 * @param message Full notification message.
 * @param jobId Optional related job id.
 * @param now Creation timestamp.
 * @param id Notification id.
 * @returns Notification record.
 *
 * PURE: No side effects.
 */
export function createNotificationRecord(
  level: NotificationLevel,
  title: string,
  message: string,
  jobId: string | undefined,
  now: number,
  id: string
): Notification {
  return {
    id,
    level,
    title,
    message,
    jobId,
    read: false,
    createdAt: now,
  };
}

/**
 * Adds a notification to the inbox.
 *
 * @param level Notification severity.
 * @param title Short notification title.
 * @param message Full notification message.
 * @param jobId Optional related job id.
 * @returns Created notification.
 *
 * SIDE EFFECT: Mutates the in-memory notification inbox.
 */
export function addNotification(
  level: NotificationLevel,
  title: string,
  message: string,
  jobId?: string
): Notification {
  const notification =
    createNotificationRecord(
      level,
      title,
      message,
      jobId,
      Date.now(),
      crypto.randomUUID()
    );

  notifications = [
    notification,
    ...notifications,
  ];

  saveNotification(notification);

  return notification;
}

/**
 * Lists notifications newest first.
 *
 * @returns Notification list.
 *
 * SIDE EFFECT: Reads from the in-memory notification inbox.
 */
export function listNotifications():
  Notification[] {
  return [...notifications];
}

/**
 * Gets a notification by id.
 *
 * @param id Notification id.
 * @returns Notification or undefined.
 *
 * SIDE EFFECT: Reads from the in-memory notification inbox.
 */
export function getNotification(
  id: string
): Notification | undefined {
  return notifications.find(
    (notification) =>
      notification.id === id
  );
}

/**
 * Marks a notification as read.
 *
 * @param id Notification id.
 * @returns Updated notification.
 *
 * SIDE EFFECT: Mutates the in-memory notification inbox.
 */
export function markNotificationRead(
  id: string
): Notification {
  const notification =
    getNotification(id);

  if (!notification) {
    throw new Error(
      `Notification not found: ${id}`
    );
  }

  const updated = {
    ...notification,
    read: true,
  };

  notifications =
    notifications.map((item) =>
      item.id === id
        ? updated
        : item
    );

  saveNotification(updated);

  return updated;
}

/**
 * Clears all notifications.
 *
 * @returns void
 *
 * SIDE EFFECT: Mutates the in-memory notification inbox.
 */
export function clearNotifications():
  void {
  notifications = [];
  clearPersistedNotifications();
}
