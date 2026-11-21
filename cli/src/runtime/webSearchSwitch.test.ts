import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearEnterprises, createAndSaveEnterprise } from "../enterprise/enterpriseStore";
import type { Account } from "../identity/companySignIn";
import type { WebSearchConfiguration } from "../integrations/webSearchConfig";
import { runtimeDb } from "../storage/runtimeDatabase";
import { clearPracticeSettings, saveSignedPracticeSetting } from "../work/practiceSetting";
import { clearApprovalChains } from "./approvalChainStore";
import { approveJobInChain, createJobApprovalChain } from "./approvalRuntime";
import { WEB_SEARCH_QUERY_MAX_CHARS, WEB_SEARCH_REASON_MAX_CHARS } from "./chainLimits";
import { clearJobs, enqueueJob } from "./jobQueue";
import { listRuntimeEventStore } from "./runtimeEventStore";
import {
  WEB_SEARCH_REFUSAL_CODES,
  WEB_SEARCH_REFUSAL_WORDING,
  clearWebSearchSwitches,
  describeWebSearchSwitch,
  readWebSearchSwitch,
  refuseWebSearchFor,
  refuseWebStep,
  refuseWebStepRequest,
  turnWebSearchOff,
  turnWebSearchOn,
} from "./webSearchSwitch";

const config = (provider: "brave" | "searxng" | "disabled", ready = true): WebSearchConfiguration => ({
  provider,
  ready,
  endpoint: "https://search.example.com",
  apiKey: "test-key",
  maxResults: 3,
  maxCallsPerSession: 2,
  timeoutMs: 5_000,
  allowedDomains: [],
  blockedDomains: [],
}) as WebSearchConfiguration;
const BRAVE = config("brave");

const AT = Date.UTC(2026, 10, 17, 1, 30); // 17 Nov 2026, 2:30 pm NZDT

function clearAll(): void {
  clearWebSearchSwitches();
  clearApprovalChains();
  clearJobs();
  clearPracticeSettings();
  clearWorkers();
  clearEnterprises();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
}

function signer(name: string, enterpriseId: string): Account {
  addWorker(createHumanWorker(name, "guardian"));
  runtimeDb.prepare("INSERT INTO enterprise_worker_memberships VALUES(?,?,NULL)").run(name, enterpriseId);
  return { userId: `user-${name}`, workerName: name, displayName: name, roles: new Map([[enterpriseId, "owner"]]) } as Account;
}

describe("web search, per business (S4, W1–W6)", () => {
  beforeEach(clearAll);
  afterEach(clearAll);

  it("has fixed wording for every refusal code", () => {
    for (const code of WEB_SEARCH_REFUSAL_CODES) expect(WEB_SEARCH_REFUSAL_WORDING[code]({}).length).toBeGreaterThan(0);
  });

  it("is off until a business turns it on: the computer's search provider alone never enables it (W3)", () => {
    const business = createAndSaveEnterprise({ name: "Threadline", mission: "Clothes." });
    expect(readWebSearchSwitch(business.id)).toEqual({ state: "none" });
    expect(refuseWebSearchFor(business.id, BRAVE)).toMatchObject({ code: "web_search_off" });
    expect(describeWebSearchSwitch(business.id)).toBe("Web search is off.");
  });

  it("refuses turning on without a signed-in account (the terminal, or sign-in off), before anything is written (W1)", () => {
    const business = createAndSaveEnterprise({ name: "Threadline", mission: "Clothes." });
    expect(turnWebSearchOn({ enterpriseId: business.id, reason: "Trend research.", configuration: BRAVE })).toMatchObject({ code: "web_search_sign_in_needed" });
    expect(readWebSearchSwitch(business.id).state).toBe("none");
  });

  it("refuses someone from another business, or who can't sign off, or with no reason or one too long, or with no provider set up", () => {
    const business = createAndSaveEnterprise({ name: "Threadline", mission: "Clothes." });
    const other = createAndSaveEnterprise({ name: "Other Co", mission: "Other." });
    const amy = signer("Amy Wise", business.id);
    const stranger = signer("Sol Other", other.id);
    expect(turnWebSearchOn({ enterpriseId: business.id, reason: "x", actor: stranger, configuration: BRAVE })).toMatchObject({ code: "web_search_not_your_business" });
    const noRights = { ...stranger, workerName: "Nobody", roles: new Map([[business.id, "owner"]]) } as Account;
    expect(turnWebSearchOn({ enterpriseId: business.id, reason: "x", actor: noRights, configuration: BRAVE })).toMatchObject({ code: "web_search_cannot_sign_off" });
    expect(turnWebSearchOn({ enterpriseId: business.id, reason: "   ", actor: amy, configuration: BRAVE })).toMatchObject({ code: "web_search_reason_needed" });
    expect(turnWebSearchOn({ enterpriseId: business.id, reason: "x".repeat(WEB_SEARCH_REASON_MAX_CHARS + 1), actor: amy, configuration: BRAVE })).toMatchObject({ code: "web_search_reason_too_long" });
    expect(turnWebSearchOn({ enterpriseId: business.id, reason: "Trends.", actor: amy, configuration: config("disabled", false) })).toMatchObject({ code: "web_search_not_set_up" });
    expect(readWebSearchSwitch(business.id).state).toBe("none");
  });

  it("turns on with a signed record binding the business, account, time, reason and provider, shown as one line (W1, W2)", () => {
    const business = createAndSaveEnterprise({ name: "Threadline", mission: "Clothes." });
    const amy = signer("Amy Wise", business.id);
    const on = turnWebSearchOn({ enterpriseId: business.id, reason: "Trend research.", actor: amy, now: AT, configuration: BRAVE });
    expect(on).toMatchObject({ record: { enterpriseId: business.id, on: true, by: "Amy Wise", byUserId: "user-Amy Wise", at: AT, reason: "Trend research.", searchProvider: "brave" } });
    expect("message" in on && on.message).toContain("may include client or product names");
    expect(refuseWebSearchFor(business.id, BRAVE)).toBeUndefined();
    expect(describeWebSearchSwitch(business.id)).toMatch(/^Web search turned on by Amy Wise, .*17 Nov.*2026/);
    expect(turnWebSearchOn({ enterpriseId: business.id, reason: "Again.", actor: amy, configuration: BRAVE })).toMatchObject({ code: "web_search_already_on" });
    expect(listRuntimeEventStore().some((event) => event.type === "runtime.web_search.turned_on")).toBe(true);
  });

  it("counts a record that doesn't verify as off (W3)", () => {
    const business = createAndSaveEnterprise({ name: "Threadline", mission: "Clothes." });
    turnWebSearchOn({ enterpriseId: business.id, reason: "Trends.", actor: signer("Amy Wise", business.id), configuration: BRAVE });
    const row = runtimeDb.prepare("SELECT record_json FROM web_search_switches WHERE enterprise_id = ?").get(business.id) as { record_json: string };
    const tampered = { ...JSON.parse(row.record_json), searchProvider: "searxng" };
    runtimeDb.prepare("UPDATE web_search_switches SET record_json = ? WHERE enterprise_id = ?").run(JSON.stringify(tampered), business.id);
    expect(readWebSearchSwitch(business.id)).toEqual({ state: "unverified" });
    expect(refuseWebSearchFor(business.id, config("searxng"))).toMatchObject({ code: "web_search_unverified" });
    expect(describeWebSearchSwitch(business.id)).toContain("could not verify");
  });

  it("stops when the search provider changes (W3)", () => {
    const business = createAndSaveEnterprise({ name: "Threadline", mission: "Clothes." });
    turnWebSearchOn({ enterpriseId: business.id, reason: "Trends.", actor: signer("Amy Wise", business.id), configuration: BRAVE });
    expect(refuseWebSearchFor(business.id, config("searxng"))).toMatchObject({ code: "web_search_provider_changed", message: expect.stringContaining("turned on for brave") });
    expect(refuseWebSearchFor(business.id, config("disabled", false))).toMatchObject({ code: "web_search_not_set_up" });
  });

  it("lapses when the person who turned it on can no longer sign off (W4)", () => {
    const business = createAndSaveEnterprise({ name: "Threadline", mission: "Clothes." });
    turnWebSearchOn({ enterpriseId: business.id, reason: "Trends.", actor: signer("Amy Wise", business.id), configuration: BRAVE });
    runtimeDb.prepare("DELETE FROM enterprise_worker_memberships WHERE worker_name = ?").run("Amy Wise");
    expect(refuseWebSearchFor(business.id, BRAVE)).toMatchObject({ code: "web_search_lapsed", message: expect.stringContaining("Amy Wise") });
  });

  it("lets anyone who can sign off turn it off with an optional note, and shows the switch-off record (W4)", () => {
    const business = createAndSaveEnterprise({ name: "Threadline", mission: "Clothes." });
    turnWebSearchOn({ enterpriseId: business.id, reason: "Trends.", actor: signer("Amy Wise", business.id), configuration: BRAVE });
    signer("Ben Hale", business.id);
    expect(turnWebSearchOff({ enterpriseId: business.id, as: "Nobody" })).toMatchObject({ code: "web_search_cannot_sign_off" });
    expect(turnWebSearchOff({ enterpriseId: business.id, as: "Ben Hale", note: "x".repeat(WEB_SEARCH_REASON_MAX_CHARS + 1) })).toMatchObject({ code: "web_search_note_too_long" });
    expect(turnWebSearchOff({ enterpriseId: business.id, as: "Ben Hale", note: "Client names went out.", now: AT })).toMatchObject({ record: { on: false, by: "Ben Hale", note: "Client names went out." } });
    expect(refuseWebSearchFor(business.id, BRAVE)).toMatchObject({ code: "web_search_off" });
    expect(describeWebSearchSwitch(business.id)).toMatch(/^Web search is off\. Turned off by Ben Hale, .*: "Client names went out\."$/);
    expect(turnWebSearchOff({ enterpriseId: business.id, as: "Ben Hale" })).toMatchObject({ code: "web_search_already_off" });
  });

  it("refuses a web step request with no words, words too long, no business, or matter work at a law practice (S4, W5)", () => {
    const business = createAndSaveEnterprise({ name: "Wise Law", mission: "Law." });
    turnWebSearchOn({ enterpriseId: business.id, reason: "Research.", actor: signer("Amy Wise", business.id), configuration: BRAVE });
    expect(refuseWebStepRequest({ enterpriseId: business.id, words: "  " }, BRAVE)).toMatchObject({ code: "web_search_no_words" });
    expect(refuseWebStepRequest({ enterpriseId: business.id, words: "x".repeat(WEB_SEARCH_QUERY_MAX_CHARS + 1) }, BRAVE)).toMatchObject({ code: "web_search_words_too_long" });
    expect(refuseWebStepRequest({ words: "rates" }, BRAVE)).toMatchObject({ code: "web_search_no_business" });
    expect(refuseWebStepRequest({ enterpriseId: business.id, words: "rates" }, BRAVE)).toBeUndefined();
    saveSignedPracticeSetting({ enterpriseId: business.id, lawPractice: true, customMatterTypes: [], version: 1, changedBy: "Amy Wise", at: AT });
    expect(refuseWebStepRequest({ enterpriseId: business.id, workId: "matter-1", words: "rates" }, BRAVE)).toMatchObject({ code: "web_search_on_matter" });
    expect(refuseWebStepRequest({ enterpriseId: business.id, words: "rates" }, BRAVE)).toBeUndefined();
  });

  it("needs each web step's own signed go-ahead (S4, W6)", () => {
    const business = createAndSaveEnterprise({ name: "Threadline", mission: "Clothes." });
    turnWebSearchOn({ enterpriseId: business.id, reason: "Trends.", actor: signer("Amy Wise", business.id), configuration: BRAVE });
    const job = enqueueJob("Summarise trends.", undefined, { enterpriseId: business.id, webSearchQuery: "outerwear trends" });
    expect(refuseWebStep(job, BRAVE)).toMatchObject({ code: "web_search_no_go_ahead", message: expect.stringContaining(job.id) });
    createJobApprovalChain(job.id, 1);
    expect(refuseWebStep(job, BRAVE)).toMatchObject({ code: "web_search_no_go_ahead" });
    approveJobInChain(job.id, "Amy Wise");
    expect(refuseWebStep(job, BRAVE)).toBeUndefined();
    turnWebSearchOff({ enterpriseId: business.id, as: "Amy Wise" });
    expect(refuseWebStep(job, BRAVE)).toMatchObject({ code: "web_search_off" });
  });
});
