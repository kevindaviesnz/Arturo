import { createHash, createHmac, timingSafeEqual, randomBytes, randomUUID } from "node:crypto";
import { runtimeDb } from "../storage/runtimeDatabase";
import { getWorker } from "../control/workers";
import { getEnterprise } from "../enterprise/enterpriseStore";
import { requireNetworkedApprovalSigningSecret } from "../runtime/runtimeSecrets";

export type User = { id: string; issuer: string; subject: string; displayName: string; disabled: boolean };
export type EnterpriseMembership = { enterpriseId: string; userId: string; role: "owner"|"admin"|"member"|"reviewer"; status: "active"|"suspended" };
export type WorkerOwnership = { workerName: string; enterpriseId: string; userId?: string };

export function getUser(id: string): User | undefined {
  const row=runtimeDb.prepare("SELECT id,issuer,subject,display_name AS displayName,disabled FROM identity_users WHERE id=?").get(id) as (Omit<User,"disabled"> & {disabled:number})|undefined;
  return row ? {...row,disabled:row.disabled===1}:undefined;
}
/** Trusted host provisioning only. A subject must already have been verified by the caller's authentication provider. Never expose as a public login endpoint. */
export function provisionUser(input: {issuer:string;subject:string;displayName:string}): User {
  if (!input.issuer.trim() || !input.subject.trim() || !input.displayName.trim()) throw new Error("Identity fields are required");
  const existing=runtimeDb.prepare("SELECT id FROM identity_users WHERE issuer=? AND subject=?").get(input.issuer,input.subject) as {id:string}|undefined;
  const id=existing?.id ?? randomUUID();
  runtimeDb.prepare("INSERT INTO identity_users(id,issuer,subject,display_name) VALUES(?,?,?,?) ON CONFLICT(issuer,subject) DO UPDATE SET display_name=excluded.display_name").run(id,input.issuer,input.subject,input.displayName);
  return getUser(id)!;
}
/** Trusted operator administration; membership is authority, Worker labels and trust flags are not. */
export function setEnterpriseMembership(m: EnterpriseMembership): void {
  if (!["owner","admin","member","reviewer"].includes(m.role) || !["active","suspended"].includes(m.status)) throw new Error("Invalid membership role or status");
  if (!getEnterprise(m.enterpriseId) || !getUser(m.userId)) throw new Error("Unknown Enterprise or User");
  runtimeDb.prepare("INSERT INTO enterprise_user_memberships VALUES(?,?,?,?) ON CONFLICT(enterprise_id,user_id) DO UPDATE SET role=excluded.role,status=excluded.status").run(m.enterpriseId,m.userId,m.role,m.status);
}
export function listEnterpriseMemberships(enterpriseId:string): EnterpriseMembership[] {
  return runtimeDb.prepare("SELECT enterprise_id AS enterpriseId,user_id AS userId,role,status FROM enterprise_user_memberships WHERE enterprise_id=? ORDER BY user_id").all(enterpriseId) as EnterpriseMembership[];
}
export function listEnterpriseWorkers(enterpriseId:string): WorkerOwnership[] {
  return runtimeDb.prepare("SELECT worker_name AS workerName,enterprise_id AS enterpriseId,user_id AS userId FROM enterprise_worker_memberships WHERE enterprise_id=? ORDER BY worker_name").all(enterpriseId) as WorkerOwnership[];
}
export function getWorkerOwnership(workerName:string): WorkerOwnership|undefined {
  return runtimeDb.prepare("SELECT worker_name AS workerName,enterprise_id AS enterpriseId,user_id AS userId FROM enterprise_worker_memberships WHERE worker_name=?").get(workerName) as WorkerOwnership|undefined;
}
export function assignWorkerOwnership(m:WorkerOwnership):void {
  const worker=getWorker(m.workerName);
  if (!worker || !getEnterprise(m.enterpriseId)) throw new Error("Unknown Worker or Enterprise");
  if (m.userId && worker.kind!=="human") throw new Error("Only a Human Worker can bind a User identity");
  if (m.userId && !listEnterpriseMemberships(m.enterpriseId).some(x=>x.userId===m.userId && x.status==="active")) throw new Error("Human User needs active Enterprise membership");
  runtimeDb.prepare("INSERT INTO enterprise_worker_memberships VALUES(?,?,?) ON CONFLICT(worker_name) DO UPDATE SET enterprise_id=excluded.enterprise_id,user_id=excluded.user_id").run(m.workerName,m.enterpriseId,m.userId??null);
}
/** Legacy unowned Workers remain local execution resources; owned Workers cannot cross organisation boundaries. */
export function workerBelongsToEnterprise(workerName:string, enterpriseId:string|undefined):boolean {
  const ownership=getWorkerOwnership(workerName);
  return !ownership || ownership.enterpriseId===enterpriseId;
}
export function authorizeHumanDecision(user:User|undefined, workerName:string, enterpriseId?:string):boolean {
  if (!enterpriseId || !getEnterprise(enterpriseId) || !user || getUser(user.id)?.disabled!==false || getWorker(workerName)?.kind!=="human") return false;
  const ownership=getWorkerOwnership(workerName);
  if (!ownership || ownership.userId!==user.id || (enterpriseId && ownership.enterpriseId!==enterpriseId)) return false;
  return listEnterpriseMemberships(ownership.enterpriseId).some(m=>m.userId===user.id && m.status==="active" && ["owner","admin","reviewer"].includes(m.role));
}
const hash=(token:string)=>createHash("sha256").update(token).digest("hex");
/** Trusted host session issuance after authentication. Raw session secrets are returned once, never persisted. */
export function issueUserSession(userId:string,now=Date.now(),lifetimeMs=8*60*60*1000):string {
  const user=getUser(userId);
  if (!user || user.disabled || !Number.isFinite(lifetimeMs) || lifetimeMs<=0 || lifetimeMs>24*60*60*1000) throw new Error("Invalid User or session lifetime");
  const token=randomBytes(32).toString("base64url");
  runtimeDb.prepare("INSERT INTO identity_sessions VALUES(?,?,?)").run(hash(token),userId,now+lifetimeMs);
  return token;
}
export function authenticateUserSession(token:string|undefined,now=Date.now()):User|undefined {
  if (!token) return undefined;
  const row=runtimeDb.prepare("SELECT user_id AS userId FROM identity_sessions WHERE token_hash=? AND expires_at>?").get(hash(token),now) as {userId:string}|undefined;
  const user=row ? getUser(row.userId):undefined;
  return user?.disabled ? undefined:user;
}
export function revokeUserSession(token:string):void { runtimeDb.prepare("DELETE FROM identity_sessions WHERE token_hash=?").run(hash(token)); }
/** Durable HMAC-bound authentication evidence alongside existing signed Worker approval decisions. */
export function recordAuthenticatedDecision(user:User,workerName:string,targetId:string,action:string):void {
  const record={id:randomUUID(),userId:user.id,workerName,targetId,action,recordedAt:Date.now()};
  const secret=requireNetworkedApprovalSigningSecret(process.env);
  const signature=createHmac("sha256",secret).update(JSON.stringify(record)).digest("hex");
  runtimeDb.prepare("INSERT INTO identity_decision_audit VALUES(?,?,?,?,?,?,?)").run(record.id,record.userId,record.workerName,record.targetId,record.action,record.recordedAt,signature);
}

/** Disabling an account revokes sessions so re-enabling cannot resurrect credentials. */
export function setUserDisabled(id:string,disabled:boolean):User {
 if (!getUser(id) || typeof disabled!=="boolean") throw new Error("Unknown User or invalid disabled status");
 runtimeDb.transaction(()=>{
  runtimeDb.prepare("UPDATE identity_users SET disabled=? WHERE id=?").run(disabled?1:0,id);
  if(disabled) runtimeDb.prepare("DELETE FROM identity_sessions WHERE user_id=?").run(id);
 })();
 return getUser(id)!;
}
export type AuthenticatedDecisionAudit={id:string;userId:string;workerName:string;targetId:string;action:string;recordedAt:number;signature:string};
export function listAuthenticatedDecisionAudit(targetId:string):AuthenticatedDecisionAudit[] {
 return runtimeDb.prepare("SELECT id,user_id AS userId,worker_name AS workerName,target_id AS targetId,action,recorded_at AS recordedAt,signature FROM identity_decision_audit WHERE target_id=? ORDER BY recorded_at,id").all(targetId) as AuthenticatedDecisionAudit[];
}
export function verifyAuthenticatedDecisionAudit(record:AuthenticatedDecisionAudit):boolean {
 const payload={id:record.id,userId:record.userId,workerName:record.workerName,targetId:record.targetId,action:record.action,recordedAt:record.recordedAt};
 const expected=createHmac("sha256",requireNetworkedApprovalSigningSecret(process.env)).update(JSON.stringify(payload)).digest();
 const actual=Buffer.from(record.signature,"hex");
 return expected.length===actual.length && timingSafeEqual(expected,actual);
}

/** Single-use exchange, preserving the administrator's original expiry. */
export function exchangeUserSession(token:string,now=Date.now()):{token:string;expiresAt:number}|undefined {
 return runtimeDb.transaction(()=>{
  if (!authenticateUserSession(token,now)) return undefined;
  const row=runtimeDb.prepare("SELECT user_id AS userId,expires_at AS expiresAt FROM identity_sessions WHERE token_hash=?").get(hash(token)) as {userId:string;expiresAt:number};
  const replacement=randomBytes(32).toString("base64url");
  runtimeDb.prepare("DELETE FROM identity_sessions WHERE token_hash=?").run(hash(token));
  runtimeDb.prepare("INSERT INTO identity_sessions VALUES(?,?,?)").run(hash(replacement),row.userId,row.expiresAt);
  return {token:replacement,expiresAt:row.expiresAt};
 })();
}
