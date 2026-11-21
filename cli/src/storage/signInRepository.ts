import type { AuthorityChange, CompanySignIn, SignInInvite, SignInPassword, SignOffGrant } from "../identity/companySignIn";
import { runtimeDb } from "./runtimeDatabase";

const one = <T>(sql: string, ...args: unknown[]): T | undefined => {
  const row = runtimeDb.prepare(sql).get(...args) as { recordJson: string } | undefined;
  return row ? (JSON.parse(row.recordJson) as T) : undefined;
};
const all = <T>(sql: string, ...args: unknown[]): T[] =>
  (runtimeDb.prepare(sql).all(...args) as Array<{ recordJson: string }>).map((row) => JSON.parse(row.recordJson) as T);

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadCompanySignIns(): CompanySignIn[] {
  return all<CompanySignIn>("SELECT record_json AS recordJson FROM company_sign_in ORDER BY enterprise_id");
}

/** SIDE EFFECT: Inserts one row; a business turns sign-in on once. */
export function insertCompanySignIn(record: CompanySignIn): boolean {
  return runtimeDb.prepare("INSERT OR IGNORE INTO company_sign_in (enterprise_id, record_json) VALUES (?, ?)").run(record.enterpriseId, JSON.stringify(record)).changes === 1;
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadSignInPassword(userId: string): SignInPassword | undefined {
  return one<SignInPassword>("SELECT record_json AS recordJson FROM sign_in_passwords WHERE user_id = ?", userId);
}

/** SIDE EFFECT: Inserts or replaces one row. */
export function saveSignInPassword(record: SignInPassword): void {
  runtimeDb.prepare("INSERT OR REPLACE INTO sign_in_passwords (user_id, record_json) VALUES (?, ?)").run(record.userId, JSON.stringify(record));
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadSignInInvite(codeHash: string): SignInInvite | undefined {
  return one<SignInInvite>("SELECT record_json AS recordJson FROM sign_in_invites WHERE code_hash = ?", codeHash);
}

/** SIDE EFFECT: Replaces every earlier invite for the same person with this one. */
export function replaceSignInInvite(codeHash: string, record: SignInInvite): void {
  runtimeDb.transaction(() => {
    runtimeDb.prepare("DELETE FROM sign_in_invites WHERE user_id = ?").run(record.userId);
    runtimeDb.prepare("INSERT INTO sign_in_invites (code_hash, user_id, record_json) VALUES (?, ?, ?)").run(codeHash, record.userId, JSON.stringify(record));
  })();
}

/** SIDE EFFECT: Deletes one invite; true only for the first caller. */
export function consumeSignInInvite(codeHash: string): boolean {
  return runtimeDb.prepare("DELETE FROM sign_in_invites WHERE code_hash = ?").run(codeHash).changes === 1;
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadSignOffGrant(enterpriseId: string, workerName: string): SignOffGrant | undefined {
  return one<SignOffGrant>("SELECT record_json AS recordJson FROM sign_off_grants WHERE enterprise_id = ? AND worker_name = ?", enterpriseId, workerName);
}

/** SIDE EFFECT: Inserts or replaces one row. */
export function saveSignOffGrant(record: SignOffGrant): void {
  runtimeDb.prepare("INSERT OR REPLACE INTO sign_off_grants (enterprise_id, worker_name, record_json) VALUES (?, ?, ?)").run(record.enterpriseId, record.workerName, JSON.stringify(record));
}

/** SIDE EFFECT: Appends one row. */
export function appendAuthorityChange(record: AuthorityChange): void {
  runtimeDb.prepare("INSERT INTO authority_changes (record_json) VALUES (?)").run(JSON.stringify(record));
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadAuthorityChanges(): AuthorityChange[] {
  return all<AuthorityChange>("SELECT record_json AS recordJson FROM authority_changes ORDER BY seq");
}

/** SIDE EFFECT: Deletes every sign-in record (tests and /reset). */
export function clearPersistedSignIn(): void {
  for (const table of ["company_sign_in", "sign_in_passwords", "sign_in_invites", "sign_off_grants", "authority_changes"]) {
    runtimeDb.prepare(`DELETE FROM ${table}`).run();
  }
}
