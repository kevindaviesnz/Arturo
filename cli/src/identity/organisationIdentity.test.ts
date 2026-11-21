import { beforeEach, describe, expect, it } from "vitest";
import { createRuntimeDatabase, migrateRuntimeDatabase } from "../storage/database";
import { runtimeDb } from "../storage/runtimeDatabase";
import { addWorker, clearWorkers, createHumanWorker, registerAiWorker, removeWorker } from "../control/workers";
import { clearEnterprises, createAndSaveEnterprise } from "../enterprise/enterpriseStore";
import { provisionUser, setEnterpriseMembership, assignWorkerOwnership, issueUserSession, authenticateUserSession, authorizeHumanDecision, listEnterpriseWorkers, revokeUserSession, setUserDisabled, getWorkerOwnership } from "./organisationIdentity";

beforeEach(() => {
  for (const table of ["identity_sessions", "enterprise_worker_memberships", "enterprise_user_memberships", "identity_users"]) runtimeDb.prepare(`DELETE FROM ${table}`).run();
  clearWorkers(); clearEnterprises();
});
describe("organisation identity", () => {
  it("adds identity tables idempotently without inventing identities for legacy workers", () => {
    const db = createRuntimeDatabase(":memory:");
    migrateRuntimeDatabase(db);
    expect(db.prepare("SELECT count(*) AS n FROM identity_users").get()).toEqual({n:0});
    db.close();
  });
  it("separates authentication from a registered Human and derives approval rights from membership", () => {
    const org = createAndSaveEnterprise({name:"Practice"});
    addWorker(createHumanWorker("Alice"));
    const user = provisionUser({issuer:"local",subject:"alice",displayName:"Alice"});
    const session = issueUserSession(user.id);
    expect(authenticateUserSession(session)?.id).toBe(user.id);
    expect(authorizeHumanDecision(user, "Alice", org.id)).toBe(false);
    setEnterpriseMembership({enterpriseId:org.id,userId:user.id,role:"member",status:"active"});
    assignWorkerOwnership({enterpriseId:org.id,workerName:"Alice",userId:user.id});
    expect(authorizeHumanDecision(user, "Alice", org.id)).toBe(false);
    setEnterpriseMembership({enterpriseId:org.id,userId:user.id,role:"reviewer",status:"active"});
    expect(authorizeHumanDecision(user, "Alice", org.id)).toBe(true);
    expect(listEnterpriseWorkers(org.id)[0].userId).toBe(user.id);
    setEnterpriseMembership({enterpriseId:org.id,userId:user.id,role:"reviewer",status:"suspended"});
    expect(authorizeHumanDecision(user, "Alice", org.id)).toBe(false);
    revokeUserSession(session);
    expect(authenticateUserSession(session)).toBeUndefined();
  });
  it("rejects cross-organisation decisions, non-Human identity bindings, expired and forged sessions", () => {
    const a=createAndSaveEnterprise({name:"A"}), b=createAndSaveEnterprise({name:"B"});
    const user=provisionUser({issuer:"local",subject:"alice",displayName:"Alice"});
    setEnterpriseMembership({enterpriseId:a.id,userId:user.id,role:"owner",status:"active"});
    addWorker(createHumanWorker("Alice")); registerAiWorker("Bot");
    expect(() => assignWorkerOwnership({enterpriseId:a.id,workerName:"Bot",userId:user.id})).toThrow(/Human/);
    assignWorkerOwnership({enterpriseId:a.id,workerName:"Alice",userId:user.id});
    expect(authorizeHumanDecision(user,"Alice",b.id)).toBe(false);
    expect(authenticateUserSession(issueUserSession(user.id, 1000, 10),1011)).toBeUndefined();
    expect(authenticateUserSession("alice")).toBeUndefined();
  });
});

it("rejects unknown roles, unresolved scope and disabled Users, and removes stale ownership", () => {
 const org=createAndSaveEnterprise({name:"Practice"});
 const user=provisionUser({issuer:"local",subject:"alice",displayName:"Alice"});
 addWorker(createHumanWorker("Alice"));
 expect(()=>setEnterpriseMembership({enterpriseId:org.id,userId:user.id,role:"hacker" as any,status:"active"})).toThrow();
 setEnterpriseMembership({enterpriseId:org.id,userId:user.id,role:"owner",status:"active"});
 assignWorkerOwnership({enterpriseId:org.id,workerName:"Alice",userId:user.id});
 expect(authorizeHumanDecision(user,"Alice")).toBe(false);
 const token=issueUserSession(user.id);
 setUserDisabled(user.id,true);
 expect(authenticateUserSession(token)).toBeUndefined();
 setUserDisabled(user.id,false);
 expect(authenticateUserSession(token)).toBeUndefined();
 removeWorker("Alice");
 expect(getWorkerOwnership("Alice")).toBeUndefined();
});
