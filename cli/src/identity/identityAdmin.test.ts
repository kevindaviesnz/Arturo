import { beforeEach, describe, expect, it } from "vitest";
import { runtimeDb } from "../storage/runtimeDatabase";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearEnterprises, createAndSaveEnterprise } from "../enterprise/enterpriseStore";
import { authenticateUserSession, authorizeHumanDecision } from "./organisationIdentity";
import { runIdentityAdmin } from "./identityAdmin";

beforeEach(() => {
  for (const table of ["identity_sessions", "enterprise_worker_memberships", "enterprise_user_memberships", "identity_users"]) runtimeDb.prepare(`DELETE FROM ${table}`).run();
  clearWorkers(); clearEnterprises();
});

describe("trusted host identity administration", () => {
  it("provisions a separate account, grants organisation authority and issues a bounded session", () => {
    const enterprise = createAndSaveEnterprise({ name: "Practice" });
    addWorker(createHumanWorker("Alice"));
    const user = JSON.parse(runIdentityAdmin(["user", "local-verified", "alice", "Alice"]));
    runIdentityAdmin(["member", enterprise.id, user.id, "reviewer"]);
    runIdentityAdmin(["worker", enterprise.id, "Alice", user.id]);
    const session = JSON.parse(runIdentityAdmin(["session", user.id, "15"]));
    const authenticated = authenticateUserSession(session.token);
    expect(authenticated?.id).toBe(user.id);
    expect(authorizeHumanDecision(authenticated, "Alice", enterprise.id)).toBe(true);
    expect(JSON.parse(runIdentityAdmin(["show", enterprise.id])).workers[0].workerName).toBe("Alice");
    runIdentityAdmin(["disable", user.id, "true"]);
    expect(authenticateUserSession(session.token)).toBeUndefined();
  });

  it("refuses malformed authority, absent arguments, unknown commands and excessive sessions", () => {
    expect(() => runIdentityAdmin(["member", "org", "user", "god"])).toThrow(/role/);
    expect(() => runIdentityAdmin(["worker", "org"])).toThrow(/Usage/);
    expect(() => runIdentityAdmin(["session", "user", "1441"])).toThrow(/duration/);
    expect(() => runIdentityAdmin(["oops"])).toThrow(/Unknown/);
    expect(runIdentityAdmin(["help"])).toContain("trusted host");
  });
});
