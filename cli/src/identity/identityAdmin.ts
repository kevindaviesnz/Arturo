import "dotenv/config";
import {
  provisionUser, setEnterpriseMembership, assignWorkerOwnership,
  listEnterpriseMemberships, listEnterpriseWorkers, issueUserSession,
  type EnterpriseMembership, setUserDisabled,
} from "./organisationIdentity";
import { issueInvite, listAuthorityChanges, listPeople, turnOnSignIn, verifyAuthorityLog } from "./companySignIn";
import { listEnterprises } from "../enterprise/enterpriseStore";

/** A business by its id or its name. SIDE EFFECT: Reads businesses. */
function businessId(nameOrId: string): string {
  const wanted = nameOrId.trim().toLowerCase();
  const found = listEnterprises().find((one) => one.id.toLowerCase() === wanted || one.name.toLowerCase() === wanted);
  if (!found) throw new Error(`No business called ${nameOrId}. Businesses: ${listEnterprises().map((one) => one.name).join(", ") || "none"}.`);
  return found.id;
}

const usage = `Arturo identity administration (trusted host only)
user <verified-issuer> <verified-subject> <display-name>
member <enterprise-id> <user-id> <owner|admin|member|reviewer> [active|suspended]
worker <enterprise-id> <worker-name> [human-user-id]
session <user-id> [minutes: 1..1440, default 480]
show <enterprise-id>
disable <user-id> <true|false>
signin-on "<business>" "<owner's name>"      turn sign-in on for the company page; prints the owner's invite code
invite "<business>" "<person's name>"        a new invite code for a person (also for a forgotten password)
people "<business>"                          who can sign in, by the name they sign in with
(<business> is its name or id)
authority-log <enterprise-id>                who changed who may sign in, sign off or manage, and whether the log is intact

Provision accounts only after independently verifying the person's identity.
A Worker name or email is not authentication. Sessions are secrets: deliver them
privately to the verified person for the review server's /session sign-in page.
Run with the same ARTURO_DATA_DIRECTORY as the runtime.`;

/** Local administrator entrypoint, never exposed as a network request handler. */
export function runIdentityAdmin(args: readonly string[]): string {
  const [command, ...values] = args;
  if (!command || command === "help" || command === "--help") return usage;
  const arity = (min: number, max = min) => {
    if (values.length < min || values.length > max || values.some(value => !value.trim())) throw new Error(`Usage: ${usage}`);
  };
  const json = (value: unknown) => JSON.stringify(value, null, 2);
  switch (command) {
    case "user": {
      arity(3);
      return json(provisionUser({issuer: values[0], subject: values[1], displayName: values[2]}));
    }
    case "member": {
      arity(3, 4);
      const role = values[2];
      const status = values[3] ?? "active";
      if (role !== "owner" && role !== "admin" && role !== "member" && role !== "reviewer") throw new Error("Invalid membership role");
      if (status !== "active" && status !== "suspended") throw new Error("Invalid membership status");
      const membership: EnterpriseMembership = {enterpriseId: values[0], userId: values[1], role, status};
      setEnterpriseMembership(membership);
      return json(membership);
    }
    case "worker": {
      arity(2, 3);
      const ownership = {enterpriseId: values[0], workerName: values[1], userId: values[2]};
      assignWorkerOwnership(ownership);
      return json(ownership);
    }
    case "session": {
      arity(1, 2);
      const minutes = values[1] === undefined ? 480 : Number(values[1]);
      if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440) throw new Error("Session duration must be 1..1440 minutes");
      return json({token: issueUserSession(values[0], Date.now(), minutes * 60_000), expiresInMinutes: minutes});
    }
    case "disable": {
      arity(2);
      if (values[1] !== "true" && values[1] !== "false") throw new Error("Disable value must be true or false");
      setUserDisabled(values[0], values[1] === "true");
      return json({userId: values[0], disabled: values[1] === "true"});
    }
    case "show": {
      arity(1);
      return json({enterpriseId: values[0], memberships: listEnterpriseMemberships(values[0]), workers: listEnterpriseWorkers(values[0])});
    }
    case "signin-on": {
      arity(2);
      const outcome = turnOnSignIn({enterpriseId: businessId(values[0]), owner: values[1]});
      if ("refused" in outcome) throw new Error(outcome.refused);
      return `Sign-in is on. ${outcome.owner}'s invite code, valid for three days: ${outcome.code}\nOpen the company page, choose "I have an invite code", and choose a password.`;
    }
    case "invite": {
      arity(2);
      const outcome = issueInvite({enterpriseId: businessId(values[0]), person: values[1], actor: undefined});
      if ("refused" in outcome) throw new Error(outcome.refused);
      return `${outcome.person}'s invite code, valid for three days: ${outcome.code}\nOn the sign-in page choose "First time, or a new code?", enter it and choose a password. Sign in afterwards with the name "${outcome.person}".`;
    }
    case "people": {
      arity(1);
      const enterpriseId = businessId(values[0]);
      return listPeople(enterpriseId).map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}${p.canSignOff ? ", can sign off" : ""}${p.status === "suspended" ? ", suspended" : p.hasPassword ? ", has a password" : p.invited ? ", invited" : ", not invited yet"}`).join("\n") || "Nobody works there yet.";
    }
    case "authority-log": {
      arity(1);
      const broken = verifyAuthorityLog();
      return json({intact: broken === -1, ...(broken === -1 ? {} : {firstBrokenEntry: broken}), changes: listAuthorityChanges(values[0]).map(({signature: _s, prevSha256: _p, ...entry}) => entry)});
    }
    default: throw new Error(`Unknown identity command: ${command}`);
  }
}

if (require.main === module) {
  try { console.log(runIdentityAdmin(process.argv.slice(2))); }
  catch (error) { console.error(error instanceof Error ? error.message : "Identity administration failed"); process.exitCode = 1; }
}
