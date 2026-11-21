import type {
  JobCompletionEventRule,
} from "../events/jobCompletionEventRule";

import {
  runtimeDb,
} from "./runtimeDatabase";

type JobCompletionEventRuleRow = {
  readonly id: string;
  readonly enterpriseId: string;
  readonly sourceBusinessFunctionId: string;
  readonly triggerType: string;
  readonly requiredCapability:
    string |
    null;
  readonly publishedEventLabel: string;
  readonly enabled: number;
  readonly createdAt: number;
};

/** Persists one post-Job Event rule. */
export function savePersistedJobCompletionEventRule(
  rule:
    JobCompletionEventRule
): void {
  runtimeDb.prepare(`
    INSERT OR REPLACE INTO job_completion_event_rules (
      id,
      enterprise_id,
      source_business_function_id,
      trigger_type,
      required_capability,
      published_event_label,
      enabled,
      created_at
    ) VALUES (
      @id,
      @enterpriseId,
      @sourceBusinessFunctionId,
      @triggerType,
      @requiredCapability,
      @publishedEventLabel,
      @enabled,
      @createdAt
    )
  `).run({
    ...rule,
    requiredCapability:
      rule.requiredCapability ??
      null,
    enabled:
      rule.enabled
        ? 1
        : 0,
  });
}

/** Loads post-Job Event rules in creation order. */
export function loadPersistedJobCompletionEventRules():
  JobCompletionEventRule[] {
  const rows =
    runtimeDb.prepare(`
      SELECT
        id,
        enterprise_id AS enterpriseId,
        source_business_function_id AS sourceBusinessFunctionId,
        trigger_type AS triggerType,
        required_capability AS requiredCapability,
        published_event_label AS publishedEventLabel,
        enabled,
        created_at AS createdAt
      FROM job_completion_event_rules
      ORDER BY created_at ASC, id ASC
    `).all() as
      JobCompletionEventRuleRow[];

  return rows.map(
    (row) => ({
      id:
        row.id,
      enterpriseId:
        row.enterpriseId,
      sourceBusinessFunctionId:
        row
          .sourceBusinessFunctionId,
      triggerType:
        row.triggerType as
          JobCompletionEventRule["triggerType"],
      requiredCapability:
        (
          row.requiredCapability ??
          undefined
        ) as
          JobCompletionEventRule["requiredCapability"],
      publishedEventLabel:
        row.publishedEventLabel,
      enabled:
        row.enabled ===
        1,
      createdAt:
        row.createdAt,
    })
  );
}

/** Deletes one persisted post-Job Event rule. */
export function deletePersistedJobCompletionEventRule(
  id: string
): boolean {
  const remove =
    runtimeDb.transaction(
      () => {
        runtimeDb
          .prepare(`
            DELETE FROM job_completion_event_emissions
            WHERE rule_id = ?
          `)
          .run(
            id
          );

        return runtimeDb
          .prepare(`
            DELETE FROM job_completion_event_rules
            WHERE id = ?
          `)
          .run(
            id
          ).changes >
          0;
      }
    );

  return remove();
}

/** Returns whether a rule has already published for a completed Job. */
export function hasPersistedJobCompletionEventEmission(
  ruleId: string,
  jobId: string
): boolean {
  return Boolean(
    runtimeDb
      .prepare(`
        SELECT 1
        FROM job_completion_event_emissions
        WHERE rule_id = ? AND job_id = ?
      `)
      .get(
        ruleId,
        jobId
      )
  );
}

/** Records the durable rule-to-Job publication receipt. */
export function savePersistedJobCompletionEventEmission(
  input: {
    readonly ruleId:
      string;
    readonly jobId:
      string;
    readonly eventId:
      string;
    readonly createdAt?:
      number;
  }
): void {
  runtimeDb.prepare(`
    INSERT OR IGNORE INTO job_completion_event_emissions (
      rule_id,
      job_id,
      event_id,
      created_at
    ) VALUES (?, ?, ?, ?)
  `).run(
    input.ruleId,
    input.jobId,
    input.eventId,
    input.createdAt ??
      Date.now()
  );
}

/** Clears all post-Job Event rules and their publication receipts. */
export function clearPersistedJobCompletionEventRules():
  void {
  const clear =
    runtimeDb.transaction(
      () => {
        runtimeDb
          .prepare(
            "DELETE FROM job_completion_event_emissions"
          )
          .run();
        runtimeDb
          .prepare(
            "DELETE FROM job_completion_event_rules"
          )
          .run();
      }
    );

  clear();
}
