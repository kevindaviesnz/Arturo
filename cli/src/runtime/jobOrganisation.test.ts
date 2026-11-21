import { beforeEach, describe, expect, it } from "vitest";
import { createEnterprise } from "../enterprise/enterprise";
import { clearPersistedEnterprises, saveEnterprise } from "../storage/enterpriseRepository";
import { clearBusinessFunctionDefinitions, createAndSaveBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { clearBusinessFunctions } from "../business/businessFunctionRuntimeStore";
import { clearPolicyRules, savePolicyRules } from "../storage/policyRepository";
import { evaluateJobGovernance } from "./jobGovernance";
import type { Job } from "./jobQueue";

const job: Job = { id: "scoped-job", task: "Organisational work", status: "queued", createdAt: 1, requiredCapabilities: ["research"] };

beforeEach(() => {
  clearPersistedEnterprises();
  clearBusinessFunctionDefinitions();
  clearBusinessFunctions();
  clearPolicyRules();
  saveEnterprise(createEnterprise({ id: "one", name: "One" }));
  saveEnterprise(createEnterprise({ id: "two", name: "Two" }));
  savePolicyRules([
    { id: "one-deny", description: "One denies research", effect: "deny", match: { capabilityId: "research" }, scope: { type: "organization", id: "one" } },
    { id: "two-allow", description: "Two permits research", effect: "allow", match: { capabilityId: "research" }, scope: { type: "organization", id: "two" } },
  ]);
});

describe("Job organisational governance", () => {
  it("uses explicit Enterprise ownership when multiple Enterprises exist", () => {
    expect(evaluateJobGovernance({ ...job, enterpriseId: "two" })).toMatchObject({ effect: "allow", matchedRuleId: "two-allow" });
    expect(evaluateJobGovernance({ ...job, enterpriseId: "one" })).toMatchObject({ effect: "deny", matchedRuleId: "one-deny" });
  });

  it("denies conflicting Enterprise and Business Function ownership", () => {
    createAndSaveBusinessFunctionDefinition({ id: "one:intake", enterpriseId: "one", label: "Intake" });
    expect(evaluateJobGovernance({ ...job, enterpriseId: "two", businessFunctionId: "one:intake" })).toMatchObject({ effect: "deny", matchedRuleId: "organisation-scope-conflict" });
  });

  it("keeps legacy Function ownership and ambiguous scope fail-closed", () => {
    createAndSaveBusinessFunctionDefinition({ id: "two:intake", enterpriseId: "two", label: "Intake" });
    expect(evaluateJobGovernance({ ...job, businessFunctionId: "two:intake" })).toMatchObject({ effect: "allow", matchedRuleId: "two-allow" });
    expect(evaluateJobGovernance(job)).toMatchObject({ effect: "deny" });
  });
});
