import {
  getNotification,
  listNotifications,
  markNotificationRead,
} from "../runtime/notificationStore";

/**
 * Handles the /notifications command.
 *
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads notification store.
 * - Writes CLI output.
 */
export function handleNotificationsCommand(): void {
  const notifications =
    listNotifications();

  if (!notifications.length) {
    console.log(
      "(no notifications)"
    );

    return;
  }

  for (const notification of notifications) {
    console.log(
      `${notification.id} ${notification.read ? "read" : "unread"} ${notification.level} ${notification.title}`
    );
  }
}

/**
 * Handles the /notification command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Reads and mutates notification store.
 * - Writes CLI output.
 */
export function handleNotificationCommand(
  args: readonly string[]
): void {
  const id =
    args[0];

  if (!id) {
    console.log(
      "Usage: /notification <id>"
    );

    return;
  }

  const notification =
    getNotification(
      id
    );

  if (!notification) {
    console.log(
      `notification not found: ${id}`
    );

    return;
  }

  const updated =
    markNotificationRead(
      id
    );

  console.log(
    JSON.stringify(
      updated,
      null,
      2
    )
  );
}