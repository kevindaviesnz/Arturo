import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  BusinessFunctionId,
} from "../business/businessFunction";

import {
  addEnterpriseBusinessFunction,
  createEnterprise,
  setEnterpriseDescription,
  setEnterpriseMission,
  setEnterpriseStatus,
} from "./enterprise";

const newsDiscoveryId =
  "news-discovery" as BusinessFunctionId;

const editorialReviewId =
  "editorial-review" as BusinessFunctionId;

describe("enterprise", () => {
  it("creates an active enterprise", () => {
    expect(
      createEnterprise({
        id: "enterprise-1",
        name: "Daily Intelligence",
        mission: "Operate an AI-native news business.",
        businessFunctionIds: [
          newsDiscoveryId,
        ],
        now: 1000,
      })
    ).toEqual({
      id: "enterprise-1",
      name: "Daily Intelligence",
      mission: "Operate an AI-native news business.",
      description: undefined,
      status: "active",
      businessFunctionIds: [
        newsDiscoveryId,
      ],
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  it("creates an enterprise with empty mission when mission is omitted", () => {
    expect(
      createEnterprise({
        id: "enterprise-1",
        name: "Coffee Reminder",
        now: 1000,
      })
    ).toEqual({
      id: "enterprise-1",
      name: "Coffee Reminder",
      mission: "",
      description: undefined,
      status: "active",
      businessFunctionIds: [],
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  it("creates an enterprise with a description", () => {
    expect(
      createEnterprise({
        id: "enterprise-1",
        name: "Coffee Reminder",
        mission: "Promote healthy coffee habits.",
        description: "Helps users manage caffeine habits.",
        now: 1000,
      })
    ).toEqual({
      id: "enterprise-1",
      name: "Coffee Reminder",
      mission: "Promote healthy coffee habits.",
      description: "Helps users manage caffeine habits.",
      status: "active",
      businessFunctionIds: [],
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  it("updates enterprise status", () => {
    const enterprise =
      createEnterprise({
        id: "enterprise-1",
        name: "Daily Intelligence",
        mission: "Operate an AI-native news business.",
        now: 1000,
      });

    expect(
      setEnterpriseStatus(
        enterprise,
        "paused",
        2000
      )
    ).toEqual({
      ...enterprise,
      status: "paused",
      updatedAt: 2000,
    });
  });

  it("updates enterprise mission", () => {
    const enterprise =
      createEnterprise({
        id: "enterprise-1",
        name: "Daily Intelligence",
        mission: "Operate an AI-native news business.",
        now: 1000,
      });

    expect(
      setEnterpriseMission(
        enterprise,
        "Operate a governed AI-native intelligence business.",
        2000
      )
    ).toEqual({
      ...enterprise,
      mission: "Operate a governed AI-native intelligence business.",
      updatedAt: 2000,
    });
  });

  it("updates enterprise description", () => {
    const enterprise =
      createEnterprise({
        id: "enterprise-1",
        name: "Coffee Reminder",
        mission: "Promote healthy coffee habits.",
        now: 1000,
      });

    expect(
      setEnterpriseDescription(
        enterprise,
        "Reminds the user to make coffee at sensible times of day.",
        2000
      )
    ).toEqual({
      ...enterprise,
      description: "Reminds the user to make coffee at sensible times of day.",
      updatedAt: 2000,
    });
  });

  it("adds a business function id", () => {
    const enterprise =
      createEnterprise({
        id: "enterprise-1",
        name: "Daily Intelligence",
        mission: "Operate an AI-native news business.",
        businessFunctionIds: [
          newsDiscoveryId,
        ],
        now: 1000,
      });

    expect(
      addEnterpriseBusinessFunction(
        enterprise,
        editorialReviewId,
        2000
      )
    ).toEqual({
      ...enterprise,
      businessFunctionIds: [
        newsDiscoveryId,
        editorialReviewId,
      ],
      updatedAt: 2000,
    });
  });

  it("does not add duplicate business function ids", () => {
    const enterprise =
      createEnterprise({
        id: "enterprise-1",
        name: "Daily Intelligence",
        mission: "Operate an AI-native news business.",
        businessFunctionIds: [
          newsDiscoveryId,
        ],
        now: 1000,
      });

    expect(
      addEnterpriseBusinessFunction(
        enterprise,
        newsDiscoveryId,
        2000
      )
    ).toBe(
      enterprise
    );
  });
});