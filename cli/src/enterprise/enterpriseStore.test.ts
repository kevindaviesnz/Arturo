import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  attachEnterpriseBusinessFunction,
  clearEnterprises,
  createAndSaveEnterprise,
  getEnterprise,
  listEnterprises,
  updateEnterpriseStatus,
} from "./enterpriseStore";

beforeEach(() => {
  clearEnterprises();
});

describe("enterpriseStore", () => {
  it("creates and stores an enterprise", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Daily Intelligence",
        mission: "Operate an AI-native news business.",
        now: 1000,
      });

    expect(enterprise.id).toBe("enterprise-1");

    expect(getEnterprise("enterprise-1")).toEqual(enterprise);

    expect(listEnterprises()).toEqual([
      enterprise,
    ]);
  });

  it("updates enterprise status", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Daily Intelligence",
        mission: "Operate an AI-native news business.",
        now: 1000,
      });

    const updated =
      updateEnterpriseStatus(
        enterprise.id,
        "running"
      );

    expect(updated?.status).toBe("running");
    expect(getEnterprise(enterprise.id)?.status).toBe("running");
  });

  it("returns undefined when updating a missing enterprise status", () => {
    expect(
      updateEnterpriseStatus(
        "missing",
        "running"
      )
    ).toBeUndefined();
  });

  it("attaches a business function", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Daily Intelligence",
        mission: "Operate an AI-native news business.",
        now: 1000,
      });

    const updated =
      attachEnterpriseBusinessFunction(
        enterprise.id,
        "news-discovery"
      );

    expect(updated?.businessFunctionIds).toEqual([
      "news-discovery",
    ]);

    expect(
      getEnterprise(
        enterprise.id
      )?.businessFunctionIds
    ).toEqual([
      "news-discovery",
    ]);
  });

  it("returns undefined when attaching a function to a missing enterprise", () => {
    expect(
      attachEnterpriseBusinessFunction(
        "missing",
        "news-discovery"
      )
    ).toBeUndefined();
  });
});