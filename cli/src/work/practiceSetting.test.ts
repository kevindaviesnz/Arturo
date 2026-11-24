import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setUpBusiness } from "../clients/clientCommands";
import { clearClients } from "../clients/clientStore";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { runtimeDb } from "../storage/runtimeDatabase";
import {
  clearPracticeSettings,
  getPracticeSetting,
  isTypedWorkRequired,
  saveSignedPracticeSetting,
} from "./practiceSetting";

const reset = () => {
  clearPracticeSettings();
  clearClients();
  clearEnterprises();
  runtimeDb.prepare("DELETE FROM identity_users").run();
  runtimeDb.prepare("DELETE FROM identity_sessions").run();
  runtimeDb.prepare("DELETE FROM enterprise_user_memberships").run();
};

describe("the signed setting 'AI work must belong to a typed piece of work'", () => {
  let enterpriseId: string;

  beforeEach(() => {
    reset();
    setUpBusiness(["Harbour Legal", "--owner", "Amy Wise", "--about", "Sole law practice"]);
    enterpriseId = listEnterprises()[0]!.id;
    clearPracticeSettings();
  });
  afterEach(reset);

  it("a missing record is off", () => {
    expect(getPracticeSetting(enterpriseId)).toMatchObject({ state: "none", lawPractice: false, typedWorkRequired: false });
    expect(isTypedWorkRequired(enterpriseId)).toBe(false);
  });

  it("an existing law-practice record without the field still verifies and counts as on (migration)", () => {
    const saved = saveSignedPracticeSetting({ enterpriseId, lawPractice: true, customMatterTypes: [], version: 1, changedBy: "Amy Wise", at: 1 });
    expect(saved.typedWorkRequired).toBeUndefined();
    expect(getPracticeSetting(enterpriseId)).toMatchObject({ state: "verified", lawPractice: true, typedWorkRequired: true });
  });

  it("an existing non-law record without the field still verifies and counts as off", () => {
    saveSignedPracticeSetting({ enterpriseId, lawPractice: false, customMatterTypes: [], version: 1, changedBy: "Amy Wise", at: 1 });
    expect(getPracticeSetting(enterpriseId)).toMatchObject({ state: "verified", lawPractice: false, typedWorkRequired: false });
  });

  it("an unverified record counts as on", () => {
    saveSignedPracticeSetting({ enterpriseId, lawPractice: false, typedWorkRequired: false, customMatterTypes: [], version: 1, changedBy: "Amy Wise", at: 1 });
    runtimeDb.prepare("UPDATE practice_settings SET record_json = replace(record_json, '\"lawPractice\":false', '\"lawPractice\":true')").run();
    expect(getPracticeSetting(enterpriseId)).toMatchObject({ state: "unverified", lawPractice: true, typedWorkRequired: true });
  });

  it("a signed field of false stays off even at a law practice, and a signed field of true stays on when it is not", () => {
    saveSignedPracticeSetting({ enterpriseId, lawPractice: true, typedWorkRequired: false, customMatterTypes: [], version: 1, changedBy: "Amy Wise", at: 1 });
    expect(getPracticeSetting(enterpriseId)).toMatchObject({ state: "verified", lawPractice: true, typedWorkRequired: false });
    saveSignedPracticeSetting({ enterpriseId, lawPractice: false, typedWorkRequired: true, customMatterTypes: [], version: 1, changedBy: "Amy Wise", at: 2 });
    expect(getPracticeSetting(enterpriseId)).toMatchObject({ state: "verified", lawPractice: false, typedWorkRequired: true });
  });
});
