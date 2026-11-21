import Database from "better-sqlite3";
import fs from "node:fs";
import nodePath from "node:path";

export type RuntimeDatabase =
  Database.Database;

const allowedRuntimeTableNames =
  new Set([
    "jobs",
    "approval_chains",
    "notifications",
    "workers",
    "operational_memory",
    "human_tasks",
    "event_schedules",
    "policy_rules",
    "work_records",
  ]);


const allowedRuntimeColumnNames =
  new Set([
    "workflow_definition",
    "archetype",
    "system",
    "availability",
    "human_mode",
    "refinement",
    "workflow_plan",
    "enterprise_id",
    "business_function_id",
    "source_task_id",
    "source_human_task_id",
    "requested_by",
    "client_id",
    "work_id",
    "cancelled_at",
    "matter_number",
    "handover_job_id",
    "follow_up_depth",
    "web_search_query",
    "governance_policy_id",
    "completed_by",
    "input_artefact_refs",
    "artefact_approval_dependencies",
    "output_artefact_refs",
    "integrity_signature",
    "owning_job_id",
    "scheduled_occurrence_at",
    "task_id",
    "frequency",
    "day_of_week",
    "requirements_signature",
    "required_approvals",
    "review_token",
    "procedure_ref",
    "review_loop",
    "kernel_call_id",
    "raw_output",
    "assigned_at",
    "approval_policy",
    "revision_requested_at",
    "revision_instructions",
    "human_task_revision",
  ]);

const allowedRuntimeColumnDefinitions =
  new Set([
    "TEXT",
    "TEXT NOT NULL DEFAULT 'daily'",
    "INTEGER",
    "INTEGER NOT NULL DEFAULT 0",
  ]);

/**
 * Checks whether a string is a safe SQL identifier.
 *
 * @param value Candidate SQL identifier.
 * @returns True when the value contains only identifier-safe characters.
 *
 * PURE: No side effects.
 */
export function isSafeSqlIdentifier(
  value: string
): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(
    value
  );
}

/**
 * Validates a runtime table name before SQL interpolation.
 *
 * @param tableName Table name to validate.
 * @returns Valid table name.
 *
 * PURE: No side effects.
 */
export function validateRuntimeTableName(
  tableName: string
): string {
  if (
    !isSafeSqlIdentifier(
      tableName
    ) ||
    !allowedRuntimeTableNames.has(
      tableName
    )
  ) {
    throw new Error(
      `Unsafe or unsupported runtime table name: ${tableName}`
    );
  }

  return tableName;
}

/**
 * Validates a runtime column name before SQL interpolation.
 *
 * @param columnName Column name to validate.
 * @returns Valid column name.
 *
 * PURE: No side effects.
 */
export function validateRuntimeColumnName(
  columnName: string
): string {
  if (
    !isSafeSqlIdentifier(
      columnName
    ) ||
    !allowedRuntimeColumnNames.has(
      columnName
    )
  ) {
    throw new Error(
      `Unsafe or unsupported runtime column name: ${columnName}`
    );
  }

  return columnName;
}

/**
 * Validates a runtime column definition before SQL interpolation.
 *
 * @param columnDefinition Column definition to validate.
 * @returns Valid column definition.
 *
 * PURE: No side effects.
 */
export function validateRuntimeColumnDefinition(
  columnDefinition: string
): string {
  if (
    !allowedRuntimeColumnDefinitions.has(
      columnDefinition
    )
  ) {
    throw new Error(
      `Unsafe or unsupported runtime column definition: ${columnDefinition}`
    );
  }

  return columnDefinition;
}

/**
 * Opens a SQLite database.
 *
 * @param path Database file path.
 * @returns SQLite database connection.
 *
 * SIDE EFFECT: Opens or creates a SQLite database file.
 */
export function openRuntimeDatabase(
  path: string
): RuntimeDatabase {
  // The path may now sit under ARTURO_DATA_DIRECTORY, which the operator can
  // point anywhere; better-sqlite3 will not create the parent for us.
  if (path !== ":memory:") {
    fs.mkdirSync(
      nodePath.dirname(path),
      { recursive: true, mode: 0o700 }
    );
  }
  const db = new Database(path);
  if (path !== ":memory:") {
    fs.chmodSync(path, 0o600);
  }
  return db;
}

/**
 * Lists column names for a SQLite table.
 *
 * @param db SQLite database connection.
 * @param tableName Table name.
 * @returns Column names.
 *
 * SIDE EFFECT: Reads SQLite schema metadata.
 */
export function listTableColumns(
  db: RuntimeDatabase,
  tableName: string
): string[] {
  const safeTableName =
    validateRuntimeTableName(
      tableName
    );

  const rows =
    db
      .prepare(
        `PRAGMA table_info(${safeTableName})`
      )
      .all() as Array<{
      name: string;
    }>;

  return rows.map(
    (row) => row.name
  );
}

/**
 * Checks whether a SQLite table has a column.
 *
 * @param db SQLite database connection.
 * @param tableName Table name.
 * @param columnName Column name.
 * @returns True when the column exists.
 *
 * SIDE EFFECT: Reads SQLite schema metadata.
 */
export function tableHasColumn(
  db: RuntimeDatabase,
  tableName: string,
  columnName: string
): boolean {
  return listTableColumns(
    db,
    tableName
  ).includes(columnName);
}

/**
 * Adds a column to a SQLite table if it does not already exist.
 *
 * @param db SQLite database connection.
 * @param tableName Table name.
 * @param columnName Column name.
 * @param columnDefinition SQL column definition.
 * @returns void
 *
 * SIDE EFFECT: Reads and mutates SQLite schema.
 */
export function addColumnIfMissing(
  db: RuntimeDatabase,
  tableName: string,
  columnName: string,
  columnDefinition: string
): void {
  const safeTableName =
    validateRuntimeTableName(
      tableName
    );

  const safeColumnName =
    validateRuntimeColumnName(
      columnName
    );

  const safeColumnDefinition =
    validateRuntimeColumnDefinition(
      columnDefinition
    );

  if (
    tableHasColumn(
      db,
      safeTableName,
      safeColumnName
    )
  ) {
    return;
  }

  db
    .prepare(
      `ALTER TABLE ${safeTableName} ADD COLUMN ${safeColumnName} ${safeColumnDefinition}`
    )
    .run();
}

/**
 * Applies runtime database schema.
 *
 * @param db SQLite database connection.
 * @returns void
 *
 * SIDE EFFECT: Creates and migrates tables in the SQLite database.
 */
export function migrateRuntimeDatabase(
  db: RuntimeDatabase
): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS identity_users (
      id TEXT PRIMARY KEY, issuer TEXT NOT NULL, subject TEXT NOT NULL,
      display_name TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0,
      UNIQUE(issuer, subject)
    );
    CREATE TABLE IF NOT EXISTS enterprise_user_memberships (
      enterprise_id TEXT NOT NULL, user_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner','admin','member','reviewer')),
      status TEXT NOT NULL CHECK(status IN ('active','suspended')),
      PRIMARY KEY(enterprise_id,user_id)
    );
    CREATE TABLE IF NOT EXISTS enterprise_worker_memberships (
      worker_name TEXT PRIMARY KEY, enterprise_id TEXT NOT NULL, user_id TEXT
    );
    CREATE TABLE IF NOT EXISTS identity_sessions (
      token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS identity_decision_audit (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, worker_name TEXT NOT NULL,
      target_id TEXT NOT NULL, action TEXT NOT NULL, recorded_at INTEGER NOT NULL,
      signature TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      task TEXT NOT NULL,
      worker TEXT,
      status TEXT NOT NULL,
      output TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER,
      approval_requested_at INTEGER,
      approved_at INTEGER,
      rejected_at INTEGER,
      failed_at INTEGER,
      required_capabilities TEXT,
      selected_worker TEXT,
      routing_reason TEXT,
      workflow_run_id TEXT,
      workflow_name TEXT,
      workflow_step_index INTEGER,
      workflow_step_count INTEGER,
      workflow_base_task TEXT,
      workflow_capabilities TEXT,
      workflow_plan TEXT,
      enterprise_id TEXT,
      business_function_id TEXT,
      source_task_id TEXT,
      source_human_task_id TEXT,
      requested_by TEXT,
      client_id TEXT,
      work_id TEXT,
      cancelled_at INTEGER,
      follow_up_depth INTEGER,
      owning_job_id TEXT,
      scheduled_occurrence_at INTEGER,
      web_search_query TEXT,
      input_artefact_refs TEXT,
      artefact_approval_dependencies TEXT,
      review_token TEXT,
      procedure_ref TEXT,
      review_loop TEXT,
      kernel_call_id TEXT,
      raw_output TEXT,
      assigned_at INTEGER,
      required_approvals INTEGER,
      approval_policy TEXT,
      revision_requested_at INTEGER,
      revision_instructions TEXT,
      human_task_revision TEXT
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      job_id TEXT,
      read INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workers (
      name TEXT PRIMARY KEY,
      display_name TEXT,
      email TEXT,
      kind TEXT,
      model TEXT,
      trust INTEGER NOT NULL,
      capabilities TEXT NOT NULL DEFAULT '[]',
      archetype TEXT,
      refinement TEXT,
      system INTEGER NOT NULL DEFAULT 0,
      availability TEXT
    );

    CREATE TABLE IF NOT EXISTS enterprises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mission TEXT,
      description TEXT,
      status TEXT NOT NULL,
      business_function_ids TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS business_function_definitions (
      id TEXT PRIMARY KEY,
      enterprise_id TEXT NOT NULL,
      label TEXT NOT NULL,
      objective TEXT,
      description TEXT,
      execution_mode TEXT,
      required_archetypes TEXT NOT NULL DEFAULT '[]',
      inputs TEXT NOT NULL DEFAULT '[]',
      outputs TEXT NOT NULL DEFAULT '[]',
      success_criteria TEXT NOT NULL DEFAULT '[]',
      policies TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL,
      runtime_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS business_function_runtimes (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      objective TEXT NOT NULL,
      owner_worker TEXT NOT NULL,
      state TEXT NOT NULL,
      job_ids TEXT NOT NULL DEFAULT '[]',
      refinements TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS business_function_staffing (
      business_function_id TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      role TEXT NOT NULL,
      human_approval_required INTEGER NOT NULL DEFAULT 0,
      rationale TEXT NOT NULL,
      PRIMARY KEY (business_function_id, worker_name, role)
    );

    CREATE TABLE IF NOT EXISTS operational_memory (
      id TEXT PRIMARY KEY,
      scope_id TEXT NOT NULL,
      content TEXT NOT NULL,
      source TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS policy_rules (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      effect TEXT NOT NULL,
      match_json TEXT NOT NULL DEFAULT '{}',
      scope_type TEXT,
      scope_id TEXT,
      position INTEGER NOT NULL,
      required_approvals INTEGER,
      integrity_signature TEXT
    );

    CREATE TABLE IF NOT EXISTS job_completion_event_rules (
      id TEXT PRIMARY KEY,
      enterprise_id TEXT NOT NULL,
      source_business_function_id TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      required_capability TEXT,
      published_event_label TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS job_completion_event_emissions (
      rule_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      event_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (rule_id, job_id)
    );

    CREATE TABLE IF NOT EXISTS event_schedules (
      id TEXT PRIMARY KEY,
      enterprise_id TEXT NOT NULL,
      source_business_function_id TEXT NOT NULL,
      task_id TEXT,
      event_label TEXT NOT NULL,
      frequency TEXT NOT NULL DEFAULT 'daily',
      day_of_week INTEGER,
      hour INTEGER NOT NULL,
      minute INTEGER NOT NULL,
      timezone TEXT NOT NULL,
      search_query TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      next_run_at INTEGER NOT NULL,
      last_run_at INTEGER,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS event_schedule_occurrences (
      id TEXT PRIMARY KEY,
      schedule_id TEXT NOT NULL,
      task_id TEXT,
      scheduled_for INTEGER NOT NULL,
      status TEXT NOT NULL,
      reason TEXT,
      worker TEXT,
      recorded_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watched_folders (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watched_folder_files (
      folder_id TEXT NOT NULL,
      file_key TEXT NOT NULL,
      taken_at INTEGER NOT NULL,
      record_json TEXT NOT NULL,
      PRIMARY KEY (folder_id, file_key)
    );

    CREATE TABLE IF NOT EXISTS client_records (
      id TEXT PRIMARY KEY,
      enterprise_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS client_terms (
      enterprise_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS client_desks (
      enterprise_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    -- Named work (work/workStore.ts): matters, books, deals. Each record is
    -- signed; the change and send logs are append-only and hash-chained or
    -- signed per entry.
    CREATE TABLE IF NOT EXISTS work_records (
      id TEXT PRIMARY KEY,
      enterprise_id TEXT NOT NULL,
      parent_work_id TEXT,
      created_at INTEGER NOT NULL,
      -- Copied from the signed record so the database itself refuses a second
      -- open matter with the same number (indexOpenMatterNumbers).
      matter_number TEXT,
      cancelled_at INTEGER,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS practice_settings (
      enterprise_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS web_search_switches (
      enterprise_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS work_changes (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      enterprise_id TEXT NOT NULL,
      work_id TEXT,
      at INTEGER NOT NULL,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS work_sends (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      work_id TEXT NOT NULL,
      at INTEGER NOT NULL,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS assistant_conversations (
      id TEXT PRIMARY KEY,
      enterprise_id TEXT NOT NULL,
      person TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hand_offs (
      function_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS function_checks (
      function_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS function_origins (
      function_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pass_on_rules (
      function_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pass_on_requests (
      job_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pass_on_deliveries (
      source_job_id TEXT PRIMARY KEY,
      next_job_id TEXT,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS company_sign_in (
      enterprise_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sign_in_passwords (
      user_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sign_in_invites (
      code_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sign_off_grants (
      enterprise_id TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      record_json TEXT NOT NULL,
      PRIMARY KEY (enterprise_id, worker_name)
    );

    CREATE TABLE IF NOT EXISTS authority_changes (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS route_chains (
      start_job_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS next_actions (
      id TEXT PRIMARY KEY,
      source_job_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      state TEXT NOT NULL,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_sends (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      purpose TEXT NOT NULL,
      at INTEGER NOT NULL,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS hand_off_deliveries (
      function_id TEXT NOT NULL,
      job_id TEXT NOT NULL,
      record_json TEXT NOT NULL,
      PRIMARY KEY (function_id, job_id)
    );

    CREATE TABLE IF NOT EXISTS result_set_asides (
      job_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS result_sign_offs (
      job_id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approval_chains (
      job_id TEXT PRIMARY KEY,
      required_approvals INTEGER NOT NULL,
      decisions_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL,
      policy_json TEXT,
      governance_policy_id TEXT,
      requirements_signature TEXT
    );

    CREATE TABLE IF NOT EXISTS worker_chat_messages (
      id TEXT PRIMARY KEY,
      worker_name TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS delegations (
      id TEXT PRIMARY KEY,
      from_business_function TEXT NOT NULL,
      to_business_function TEXT NOT NULL,
      work TEXT NOT NULL,
      status TEXT NOT NULL,
      job_id TEXT,
      worker_name TEXT,
      required_capabilities TEXT NOT NULL DEFAULT '[]',
      result TEXT,
      error TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS human_tasks (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL,
      title TEXT NOT NULL,
      owner TEXT,
      purpose TEXT,
      instructions TEXT NOT NULL,
      completion_evidence TEXT,
      workflow_run_id TEXT,
      source_job_id TEXT,
      handover_job_id TEXT,
      from_worker TEXT,
      to_worker TEXT,
      input_summary TEXT,
      input_artifact TEXT,
      input_artefact_refs TEXT NOT NULL DEFAULT '[]',
      output_artefact_refs TEXT NOT NULL DEFAULT '[]',
      requested_action TEXT,
      acceptance_criteria TEXT NOT NULL DEFAULT '[]',
      revision_instructions TEXT,
      notes TEXT,
      block_reason TEXT,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      completed_by TEXT,
      blocked_at INTEGER,
      revision_requested_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS artefacts (
      id TEXT PRIMARY KEY,
      enterprise_id TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS artefact_versions (
      artefact_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      uri TEXT NOT NULL,
      local_path TEXT,
      media_type TEXT NOT NULL,
      sha256 TEXT,
      size_bytes INTEGER,
      created_by TEXT NOT NULL,
      source_job_id TEXT,
      source_human_task_id TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL,
      review_status TEXT NOT NULL,
      review_task_id TEXT,
      reviewer TEXT,
      reviewed_at INTEGER,
      review_notes TEXT,
      review_signature TEXT,
      PRIMARY KEY (artefact_id, version),
      FOREIGN KEY (artefact_id) REFERENCES artefacts(id)
    );

    CREATE TABLE IF NOT EXISTS runtime_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

  `);

  addColumnIfMissing(db, "workers", "workflow_definition", "TEXT");

  addColumnIfMissing(
    db,
    "workers",
    "archetype",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "human_tasks",
    "completed_by",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "human_tasks",
    "handover_job_id",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "human_tasks",
    "input_artefact_refs",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "human_tasks",
    "output_artefact_refs",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "workers",
    "system",
    "INTEGER NOT NULL DEFAULT 0"
  );

  addColumnIfMissing(
    db,
    "workers",
    "availability",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "workers",
    "human_mode",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "workers",
    "refinement",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "workflow_plan",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "web_search_query",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "enterprise_id",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "business_function_id",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "owning_job_id",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "scheduled_occurrence_at",
    "INTEGER"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "artefact_approval_dependencies",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "input_artefact_refs",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "source_task_id",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "source_human_task_id",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "requested_by",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "client_id",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "work_id",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "cancelled_at",
    "INTEGER"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "follow_up_depth",
    "INTEGER"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "review_token",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "procedure_ref",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "review_loop",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "kernel_call_id",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "raw_output",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "assigned_at",
    "INTEGER"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "required_approvals",
    "INTEGER"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "approval_policy",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "revision_requested_at",
    "INTEGER"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "revision_instructions",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "jobs",
    "human_task_revision",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "approval_chains",
    "governance_policy_id",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "approval_chains",
    "requirements_signature",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "policy_rules",
    "required_approvals",
    "INTEGER"
  );

  addColumnIfMissing(
    db,
    "policy_rules",
    "integrity_signature",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "event_schedules",
    "task_id",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "event_schedules",
    "frequency",
    "TEXT NOT NULL DEFAULT 'daily'"
  );

  addColumnIfMissing(
    db,
    "event_schedules",
    "day_of_week",
    "INTEGER"
  );

  addColumnIfMissing(
    db,
    "work_records",
    "matter_number",
    "TEXT"
  );

  addColumnIfMissing(
    db,
    "work_records",
    "cancelled_at",
    "INTEGER"
  );

  indexOpenMatterNumbers(db);

  narrowStaffingApprovalRulesToConsequentialWork(db);
}

/**
 * A matter number is unique among a business's work that hasn't been
 * cancelled (Grace, addendum 1). workChanges.ts checks it before writing; this
 * partial unique index makes the database refuse it too, so two openings at
 * once can't both win. Rows written before the columns existed are filled in
 * from their record first. Re-running is a no-op.
 *
 * SIDE EFFECT: Updates work_records and creates an index.
 */
function indexOpenMatterNumbers(
  db: RuntimeDatabase
): void {
  db.prepare(`
    UPDATE work_records
    SET matter_number = json_extract(record_json, '$.matterNumber'),
        cancelled_at = json_extract(record_json, '$.cancelledAt')
    WHERE matter_number IS NULL AND json_extract(record_json, '$.matterNumber') IS NOT NULL
  `).run();
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS work_records_open_matter_number
    ON work_records (enterprise_id, matter_number COLLATE NOCASE)
    WHERE matter_number IS NOT NULL AND cancelled_at IS NULL
  `);
}

/**
 * Narrows staffing approval rules written before approval tracked consequence.
 *
 * `/staff` used to write `{"businessFunctionId": "..."}`, which matches every
 * Task in the Function because an absent match field is a wildcard. Those rules
 * are already in operators' databases, and left alone they would keep gating
 * drafting and analysis — the operator would upgrade, see no change, and
 * reasonably conclude the fix did not work.
 *
 * Bounded by the `staffing-approval:` id prefix so it cannot touch a rule the
 * operator wrote, and skips any signed or already-narrowed rule, so re-running
 * is a no-op and integrity-checked rows are not rewritten behind the signer.
 *
 * Raw SQL rather than loadPolicyRules/savePolicyRules: those go through the
 * runtimeDb singleton, which is mid-open here, and savePolicyRules
 * delete-and-reinserts every rule, rewriting the `position` that decides
 * evaluation order.
 *
 * SIDE EFFECT: Updates stored policy rules.
 */
function narrowStaffingApprovalRulesToConsequentialWork(
  db: RuntimeDatabase
): void {
  db.prepare(`
    UPDATE policy_rules
       SET match_json = json_set(match_json, '$.consequentialOnly', json('true'))
     WHERE id LIKE 'staffing-approval:%'
       AND integrity_signature IS NULL
       AND json_valid(match_json)
       AND json_extract(match_json, '$.consequentialOnly') IS NULL
  `).run();
}

/**
 * Opens and migrates the runtime database.
 *
 * @param path Database file path.
 * @returns Ready SQLite database connection.
 *
 * SIDE EFFECT: Opens/creates database file and applies schema.
 */
export function createRuntimeDatabase(
  path: string
): RuntimeDatabase {
  const db =
    openRuntimeDatabase(path);

  migrateRuntimeDatabase(db);

  return db;
}
