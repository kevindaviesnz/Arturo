import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { listEnterpriseMemberships } from "./organisationIdentity";
import { addEnterprisePerson } from "../testing/cliTestSetup";
import {
  accountFromSession,
  clearSignIn,
  listPeople,
  maySignOff,
  redeemInvite,
  setSignOffRight,
  turnOnSignIn,
} from "./companySignIn";
import { runtimeDb } from "../storage/runtimeDatabase";

const reset = () => {
  clearSignIn();
  clearWorkers();
  clearEnterprises();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
  runtimeDb.prepare("DELETE FROM enterprise_user_memberships").run();
  runtimeDb.prepare("DELETE FROM identity_users").run();
  runtimeDb.prepare("DELETE FROM identity_sessions").run();
};

describe("setSignOffRight creates the account (Tama / staff-step overlap)", () => {
  let enterpriseId: string;

  beforeEach(() => {
    reset();
    expect(setUpBusiness(["Harbour Legal", "--owner", "Amy Wise", "--about", "A law practice"]).created).toBe(true);
    enterpriseId = listEnterprises()[0]!.id;
  });
  afterEach(reset);

  it("creates the person's account in the same signed step, and the staff list reads canSignOff from the grant", () => {
    const turned = turnOnSignIn({ enterpriseId, owner: "Amy Wise" });
    if ("refused" in turned) throw new Error(turned.refused);
    const joined = redeemInvite({ code: turned.code, password: "a long enough password" });
    if ("refused" in joined) throw new Error(joined.refused);
    const actor = accountFromSession(joined.token);
    if (!actor) throw new Error("owner session was not created");

    expect(addEnterprisePerson({ enterpriseId, name: "Dana Editor", role: "worker" }).added).toBe(true);
    expect(maySignOff(enterpriseId, "Dana Editor")).toBe(false);
    expect(listPeople(enterpriseId).find((person) => person.name === "Dana Editor")?.canSignOff).toBe(false);
    expect(listEnterpriseMemberships(enterpriseId).some((row) => listPeople(enterpriseId).some((person) => person.name === "Dana Editor" && person.role))).toBe(false);

    const granted = setSignOffRight({ enterpriseId, person: "Dana Editor", canSignOff: true, actor });
    if ("refused" in granted) throw new Error(granted.refused);

    expect(maySignOff(enterpriseId, "Dana Editor")).toBe(true);
    const dana = listPeople(enterpriseId).find((person) => person.name === "Dana Editor");
    expect(dana?.canSignOff).toBe(true);
    expect(dana?.role).toBeTruthy();
    const memberships = listEnterpriseMemberships(enterpriseId);
    expect(memberships.some((row) => row.role === "member" || row.role === "owner")).toBe(true);
  });
});
