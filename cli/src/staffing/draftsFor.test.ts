import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { setUpBusiness } from "../clients/clientCommands";
import { registerAiWorker, clearWorkers } from "../control/workers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";
import { accountFromSession, clearSignIn, redeemInvite, setSignOffRight, turnOnSignIn } from "../identity/companySignIn";
import { addEnterprisePerson } from "../testing/cliTestSetup";
import { runtimeDb } from "../storage/runtimeDatabase";
import { clearDraftsFor, getDraftsFor, refuseDraftsFor, setDraftsFor } from "./draftsFor";

const reset = () => {
  clearDraftsFor();
  clearSignIn();
  clearWorkers();
  clearEnterprises();
  runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
  runtimeDb.prepare("DELETE FROM enterprise_user_memberships").run();
  runtimeDb.prepare("DELETE FROM identity_users").run();
  runtimeDb.prepare("DELETE FROM identity_sessions").run();
};

describe("drafts for, a signed standing permission", () => {
  let enterpriseId: string;

  beforeEach(() => {
    reset();
    expect(setUpBusiness(["Harbour Legal", "--owner", "Amy Wise", "--about", "A law practice"]).created).toBe(true);
    enterpriseId = listEnterprises()[0]!.id;
    registerAiWorker("NDA drafter", "creator");
  });
  afterEach(reset);

  it("is kept in its own store, and is signed off by the person it drafts for when they can sign off", () => {
    const set = setDraftsFor({ enterpriseId, aiWorker: "NDA drafter", draftsFor: "Amy Wise", actor: undefined, as: "Amy Wise" });
    if ("refused" in set) throw new Error(set.refused);
    expect(set.record).toMatchObject({ draftsFor: "Amy Wise", signer: "Amy Wise", setBy: "Amy Wise", on: true });
    expect(getDraftsFor(enterpriseId, "NDA drafter")?.signature).toBeTruthy();
    expect(refuseDraftsFor({ enterpriseId, aiWorker: "NDA drafter" })).toBeUndefined();
  });

  it("makes the owner pick the signer when the person it drafts for cannot sign off", () => {
    expect(addEnterprisePerson({ enterpriseId, name: "Dana Editor", role: "worker" }).added).toBe(true);
    const refused = setDraftsFor({ enterpriseId, aiWorker: "NDA drafter", draftsFor: "Dana Editor", actor: undefined, as: "Amy Wise" });
    expect("refused" in refused).toBe(true);
    const set = setDraftsFor({ enterpriseId, aiWorker: "NDA drafter", draftsFor: "Dana Editor", signer: "Amy Wise", actor: undefined, as: "Amy Wise" });
    if ("refused" in set) throw new Error(set.refused);
    expect(set.record).toMatchObject({ draftsFor: "Dana Editor", signer: "Amy Wise" });
  });

  it("ends when the person who set it loses the sign-off right", () => {
    const turned = turnOnSignIn({ enterpriseId, owner: "Amy Wise" });
    if ("refused" in turned) throw new Error(turned.refused);
    const joined = redeemInvite({ code: turned.code, password: "a long enough password" });
    if ("refused" in joined) throw new Error(joined.refused);
    const actor = accountFromSession(joined.token);
    if (!actor) throw new Error("owner session was not created");

    expect(addEnterprisePerson({ enterpriseId, name: "Sam Okonjo", role: "approver" }).added).toBe(true);
    const granted = setSignOffRight({ enterpriseId, person: "Sam Okonjo", canSignOff: true, actor });
    if ("refused" in granted) throw new Error(granted.refused);
    const set = setDraftsFor({ enterpriseId, aiWorker: "NDA drafter", draftsFor: "Amy Wise", actor, as: "Sam Okonjo" });
    if ("refused" in set) throw new Error(set.refused);

    const revoked = setSignOffRight({ enterpriseId, person: "Sam Okonjo", canSignOff: false, actor });
    if ("refused" in revoked) throw new Error(revoked.refused);
    expect(getDraftsFor(enterpriseId, "NDA drafter")).toBeUndefined();
    expect(refuseDraftsFor({ enterpriseId, aiWorker: "NDA drafter" })?.code).toBe("permission_withdrawn");
  });
});
