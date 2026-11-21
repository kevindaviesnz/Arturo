import {
  createJobCompletionEventRule,
  type CreateJobCompletionEventRuleInput,
  type JobCompletionEventRule,
} from "./jobCompletionEventRule";

import {
  clearPersistedJobCompletionEventRules,
  deletePersistedJobCompletionEventRule,
  loadPersistedJobCompletionEventRules,
  savePersistedJobCompletionEventRule,
} from "../storage/jobCompletionEventRuleRepository";

const rules =
  new Map<
    string,
    JobCompletionEventRule
  >(
    loadPersistedJobCompletionEventRules()
      .map(
        (rule) => [
          rule.id,
          rule,
        ]
      )
  );

/** Creates and persists one post-Job Event rule. */
export function addJobCompletionEventRule(
  input:
    CreateJobCompletionEventRuleInput
): JobCompletionEventRule {
  const duplicate =
    listJobCompletionEventRules()
      .find(
        (rule) =>
          rule.enabled &&
          rule.enterpriseId ===
            input.enterpriseId &&
          rule.sourceBusinessFunctionId ===
            input.sourceBusinessFunctionId &&
          rule.requiredCapability ===
            input.requiredCapability &&
          rule.publishedEventLabel
            .toLowerCase() ===
            input
              .publishedEventLabel
              .trim()
              .toLowerCase()
      );
  if (duplicate) {
    throw new Error(
      `An equivalent Event rule already exists: ${duplicate.id}`
    );
  }

  const rule =
    createJobCompletionEventRule(
      input
    );
  rules.set(
    rule.id,
    rule
  );
  savePersistedJobCompletionEventRule(
    rule
  );

  return rule;
}

/** Lists all post-Job Event rules. */
export function listJobCompletionEventRules():
  readonly JobCompletionEventRule[] {
  return [
    ...rules.values(),
  ].sort(
    (left, right) =>
      left.createdAt -
        right.createdAt ||
      left.id.localeCompare(
        right.id
      )
  );
}

/** Gets one post-Job Event rule by exact ID. */
export function getJobCompletionEventRule(
  id: string
): JobCompletionEventRule |
  undefined {
  return rules.get(
    id
  );
}

/** Removes one post-Job Event rule without deleting prior Events. */
export function removeJobCompletionEventRule(
  id: string
): JobCompletionEventRule |
  undefined {
  const rule =
    getJobCompletionEventRule(
      id
    );
  if (!rule) {
    return undefined;
  }

  deletePersistedJobCompletionEventRule(
    id
  );
  rules.delete(
    id
  );

  return rule;
}

/** Clears post-Job Event rules and their deduplication receipts. */
export function clearJobCompletionEventRules():
  void {
  rules.clear();
  clearPersistedJobCompletionEventRules();
}
