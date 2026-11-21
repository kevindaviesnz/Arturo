import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearPersistedNotifications,
  fromNotificationRow,
  loadNotifications,
  saveNotification,
  toNotificationRow,
} from "./notificationRepository";

import type {
  Notification,
} from "../runtime/notificationStore";

beforeEach(() => {
  clearPersistedNotifications();
});

describe("toNotificationRow", () => {
  it("converts optional fields and boolean values for SQLite", () => {
    const notification: Notification = {
      id: "note-1",
      level: "success",
      title: "Done",
      message: "Job completed",
      jobId: undefined,
      read: true,
      createdAt: 1,
    };

    expect(
      toNotificationRow(notification)
    ).toEqual({
      id: "note-1",
      level: "success",
      title: "Done",
      message: "Job completed",
      jobId: null,
      read: 1,
      createdAt: 1,
    });
  });
});

describe("fromNotificationRow", () => {
  it("converts SQLite rows back to notifications", () => {
    expect(
      fromNotificationRow({
        id: "note-1",
        level: "success",
        title: "Done",
        message: "Job completed",
        jobId: null,
        read: 0,
        createdAt: 1,
      })
    ).toEqual({
      id: "note-1",
      level: "success",
      title: "Done",
      message: "Job completed",
      jobId: undefined,
      read: false,
      createdAt: 1,
    });
  });
});

describe("notificationRepository", () => {
  it("saves and loads notifications", () => {
    saveNotification({
      id: "note-1",
      level: "success",
      title: "Done",
      message: "Job completed",
      jobId: "job-1",
      read: false,
      createdAt: 1,
    });

    expect(
      loadNotifications()
    ).toEqual([
      {
        id: "note-1",
        level: "success",
        title: "Done",
        message: "Job completed",
        jobId: "job-1",
        read: false,
        createdAt: 1,
      },
    ]);
  });

  it("clears persisted notifications", () => {
    saveNotification({
      id: "note-1",
      level: "info",
      title: "One",
      message: "First",
      read: false,
      createdAt: 1,
    });

    clearPersistedNotifications();

    expect(
      loadNotifications()
    ).toEqual([]);
  });
});
