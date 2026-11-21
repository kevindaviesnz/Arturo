import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createRuntimeDatabase,
  isSafeSqlIdentifier,
  migrateRuntimeDatabase,
  openRuntimeDatabase,
  validateRuntimeColumnDefinition,
  validateRuntimeColumnName,
  validateRuntimeTableName,
} from "./database";

describe("database", () => {
  it("opens an in-memory SQLite database", () => {
    const db =
      openRuntimeDatabase(":memory:");

    expect(db.open).toBe(true);

    db.close();
  });

  it("migrates runtime tables", () => {
    const db =
      openRuntimeDatabase(":memory:");

    migrateRuntimeDatabase(db);

    const rows =
      db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name"
      ).all() as { name: string }[];

    expect(
      rows.map((row) => row.name)
    ).toContain("jobs");

    expect(
      rows.map((row) => row.name)
    ).toContain("notifications");

    expect(
      rows.map((row) => row.name)
    ).toContain(
      "job_completion_event_rules"
    );

    expect(
      rows.map((row) => row.name)
    ).toContain(
      "job_completion_event_emissions"
    );

    expect(
      rows.map((row) => row.name)
    ).toContain(
      "event_schedules"
    );

    db.close();
  });

  it("creates a ready runtime database", () => {
    const db =
      createRuntimeDatabase(":memory:");

    const jobTable =
      db.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'jobs'"
      ).get();

    expect(jobTable).toBeTruthy();

    db.close();
  });

  it("migrates approval-chain governance attribution", () => {
    const db = createRuntimeDatabase(":memory:");
    const columns = db.prepare("PRAGMA table_info(approval_chains)").all() as Array<{ name: string }>;

    expect(columns.map(({ name }) => name)).toContain("governance_policy_id");
    db.close();
  });

  it("adds weekly recurrence columns to an existing Event schedule table", () => {
    const db = openRuntimeDatabase(":memory:");
    db.exec(`
      CREATE TABLE event_schedules (
        id TEXT PRIMARY KEY,
        enterprise_id TEXT NOT NULL,
        source_business_function_id TEXT NOT NULL,
        event_label TEXT NOT NULL,
        hour INTEGER NOT NULL,
        minute INTEGER NOT NULL,
        timezone TEXT NOT NULL,
        search_query TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        next_run_at INTEGER NOT NULL,
        last_run_at INTEGER,
        created_at INTEGER NOT NULL
      );
      INSERT INTO event_schedules (
        id,
        enterprise_id,
        source_business_function_id,
        event_label,
        hour,
        minute,
        timezone,
        enabled,
        next_run_at,
        created_at
      ) VALUES (
        'schedule-old',
        'enterprise-1',
        'enterprise-1:function-1',
        'Daily work due',
        9,
        0,
        'Pacific/Auckland',
        1,
        1,
        1
      );
    `);

    migrateRuntimeDatabase(db);

    const row = db.prepare(
      "SELECT frequency, day_of_week AS dayOfWeek FROM event_schedules WHERE id = ?"
    ).get("schedule-old") as {
      frequency: string;
      dayOfWeek: number | null;
    };
    expect(row).toEqual({
      frequency: "daily",
      dayOfWeek: null,
    });
    db.close();
  });

  it("adds restart-critical Job columns to an existing jobs table", () => {
    const db = openRuntimeDatabase(":memory:");
    db.exec(`
      CREATE TABLE jobs (
        id TEXT PRIMARY KEY,
        task TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );
    `);

    migrateRuntimeDatabase(db);

    const columns = db
      .prepare("PRAGMA table_info(jobs)")
      .all() as Array<{ name: string }>;
    const columnNames =
      columns.map(
        ({ name }) => name
      );

    expect(columnNames).toEqual(
      expect.arrayContaining([
        "review_token",
        "procedure_ref",
        "review_loop",
        "kernel_call_id",
        "raw_output",
        "assigned_at",
        "required_approvals",
        "approval_policy",
        "revision_requested_at",
        "revision_instructions",
        "human_task_revision",
      ])
    );

    db.close();
  });

    it("accepts safe SQL identifiers", () => {
    expect(
      isSafeSqlIdentifier("workflow_plan")
    ).toBe(true);

    expect(
      isSafeSqlIdentifier("jobs")
    ).toBe(true);
  });

  it("rejects unsafe SQL identifiers", () => {
    expect(
      isSafeSqlIdentifier("jobs); DROP TABLE jobs; --")
    ).toBe(false);

    expect(
      isSafeSqlIdentifier("1jobs")
    ).toBe(false);

    expect(
      isSafeSqlIdentifier("job-name")
    ).toBe(false);
  });

  it("validates allowed runtime table names", () => {
    expect(
      validateRuntimeTableName("jobs")
    ).toBe("jobs");

    expect(() =>
      validateRuntimeTableName("users")
    ).toThrow(
      "Unsafe or unsupported runtime table name"
    );

    expect(() =>
      validateRuntimeTableName("jobs); DROP TABLE jobs; --")
    ).toThrow(
      "Unsafe or unsupported runtime table name"
    );
  });

  it("validates allowed runtime column names", () => {
    expect(
      validateRuntimeColumnName("workflow_plan")
    ).toBe("workflow_plan");

    expect(() =>
      validateRuntimeColumnName("password")
    ).toThrow(
      "Unsafe or unsupported runtime column name"
    );

    expect(() =>
      validateRuntimeColumnName("workflow_plan TEXT); DROP TABLE jobs; --")
    ).toThrow(
      "Unsafe or unsupported runtime column name"
    );
  });

  it("validates allowed runtime column definitions", () => {
    expect(
      validateRuntimeColumnDefinition("TEXT")
    ).toBe("TEXT");

    expect(
      validateRuntimeColumnDefinition("INTEGER NOT NULL DEFAULT 0")
    ).toBe("INTEGER NOT NULL DEFAULT 0");

    expect(() =>
      validateRuntimeColumnDefinition("TEXT); DROP TABLE jobs; --")
    ).toThrow(
      "Unsafe or unsupported runtime column definition"
    );
  });
  
});

/**
 * A staffing rule written before approval tracked consequence matches every
 * Task in its Function, because an absent match field is a wildcard. Left
 * alone those rules keep gating drafting and analysis, so an operator would
 * upgrade, see no change, and conclude the fix did not work.
 */
describe("narrowing staffing approval rules already in the database", () => {
  function seedRule(db: ReturnType<typeof openRuntimeDatabase>, id: string, matchJson: string): void {
    db.prepare(
      "INSERT INTO policy_rules (id, description, match_json, effect, position) VALUES (?, ?, ?, ?, ?)"
    ).run(id, "seeded", matchJson, "require-approval", 0);
  }

  function matchOf(db: ReturnType<typeof openRuntimeDatabase>, id: string): Record<string, unknown> {
    const row = db.prepare("SELECT match_json FROM policy_rules WHERE id = ?").get(id) as
      | { match_json: string }
      | undefined;
    return JSON.parse(row?.match_json ?? "{}");
  }

  it("narrows an old staffing rule to work with an outside effect", () => {
    const db = openRuntimeDatabase(":memory:");
    migrateRuntimeDatabase(db);
    seedRule(db, "staffing-approval:e-1:invoicing", JSON.stringify({ businessFunctionId: "e-1:invoicing" }));

    migrateRuntimeDatabase(db);

    expect(matchOf(db, "staffing-approval:e-1:invoicing")).toEqual({
      businessFunctionId: "e-1:invoicing",
      consequentialOnly: true,
    });
    db.close();
  });

  it("leaves a rule the operator wrote alone", () => {
    const db = openRuntimeDatabase(":memory:");
    migrateRuntimeDatabase(db);
    seedRule(db, "policy-mine", JSON.stringify({ businessFunctionId: "e-1:invoicing" }));

    migrateRuntimeDatabase(db);

    expect(matchOf(db, "policy-mine")).toEqual({
      businessFunctionId: "e-1:invoicing",
    });
    db.close();
  });

  it("does not overwrite a staffing rule that already says false", () => {
    const db = openRuntimeDatabase(":memory:");
    migrateRuntimeDatabase(db);
    seedRule(
      db,
      "staffing-approval:e-1:scheduling",
      JSON.stringify({ businessFunctionId: "e-1:scheduling", consequentialOnly: false })
    );

    migrateRuntimeDatabase(db);

    expect(matchOf(db, "staffing-approval:e-1:scheduling")).toMatchObject({
      consequentialOnly: false,
    });
    db.close();
  });
});
