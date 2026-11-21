import { describe, expect, it } from "vitest";
import {
  describeNextSetupStep,
  formatSetupRequiredBody,
  isReadyForWork,
} from "./uiSetupProgress";

const empty = { functionCount: 0, workerCount: 0 };
const named = { enterpriseName: "t & s heating ltd", functionCount: 0, workerCount: 0 };
const unstaffed = { enterpriseName: "t & s heating ltd", functionCount: 1, workerCount: 0 };
const ready = { enterpriseName: "t & s heating ltd", functionCount: 1, workerCount: 2 };

describe("describeNextSetupStep", () => {
  it("starts with guided setup when nothing exists", () => {
    expect(describeNextSetupStep(empty).join("\n")).toContain(
      "/enterprise"
    );
  });

  it("asks for Functions once an Enterprise exists", () => {
    expect(describeNextSetupStep(named).join("\n")).toContain(
      '/next "t & s heating ltd"'
    );
  });

  it("asks for staffing once Functions exist", () => {
    expect(describeNextSetupStep(unstaffed).join("\n")).toContain("/staff");
  });

  it("asks for nothing once the Enterprise is staffed", () => {
    expect(describeNextSetupStep(ready)).toEqual([]);
  });
});

describe("isReadyForWork", () => {
  it.each([
    ["an empty installation", empty],
    ["an Enterprise with no Functions", named],
    ["Functions with no Workers", unstaffed],
  ])("refuses work for %s", (_label, state) => {
    expect(isReadyForWork(state)).toBe(false);
  });

  it("allows work once staffed", () => {
    expect(isReadyForWork(ready)).toBe(true);
  });
});

describe("formatSetupRequiredBody", () => {
  it("says why, what to run, and that nothing happened", () => {
    const body = formatSetupRequiredBody(empty);

    expect(body).toContain("There is no Enterprise yet");
    expect(body).toContain("/enterprise");
    expect(body).toContain("no model was called");
  });

  it("names the Enterprise that is missing Workers", () => {
    expect(formatSetupRequiredBody(unstaffed)).toContain(
      "t & s heating ltd has no Workers yet"
    );
  });
});
