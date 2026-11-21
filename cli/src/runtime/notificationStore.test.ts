import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  addNotification,
  clearNotifications,
  createNotificationRecord,
  getNotification,
  listNotifications,
  markNotificationRead,
} from "./notificationStore";

beforeEach(() => {
  clearNotifications();
});

describe("createNotificationRecord", () => {
  it("creates an unread notification record", () => {
    expect(
      createNotificationRecord(
        "success",
        "Done",
        "Job completed",
        "job-1",
        1,
        "note-1"
      )
    ).toEqual({
      id: "note-1",
      level: "success",
      title: "Done",
      message: "Job completed",
      jobId: "job-1",
      read: false,
      createdAt: 1,
    });
  });
});

describe("notificationStore", () => {
  it("adds notifications newest first", () => {
    const first =
      addNotification(
        "info",
        "One",
        "First"
      );

    const second =
      addNotification(
        "success",
        "Two",
        "Second"
      );

    expect(
      listNotifications().map(
        (item) => item.id
      )
    ).toEqual([
      second.id,
      first.id,
    ]);
  });

  it("gets a notification by id", () => {
    const notification =
      addNotification(
        "success",
        "Done",
        "Job completed"
      );

    expect(
      getNotification(
        notification.id
      )
    ).toEqual(notification);
  });

  it("marks a notification read", () => {
    const notification =
      addNotification(
        "success",
        "Done",
        "Job completed"
      );

    const updated =
      markNotificationRead(
        notification.id
      );

    expect(updated.read).toBe(true);

    expect(
      getNotification(
        notification.id
      )?.read
    ).toBe(true);
  });

  it("clears notifications", () => {
    addNotification(
      "info",
      "One",
      "First"
    );

    clearNotifications();

    expect(
      listNotifications()
    ).toEqual([]);
  });
});
