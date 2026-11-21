import fs from "node:fs";
import path from "node:path";

import type {
  PolicyEffect,
  PolicyRule,
} from "../policy/policyRule";

import {
  runtimeDb,
} from "./runtimeDatabase";

import {
  getLocalApprovalSigningSecret,
} from "../runtime/runtimeSecrets";

import {
  signPolicyRule,
  verifyPolicyRuleSignature,
} from "../policy/policyRuleSigning";

import {
  resolveRuntimeDataDirectory,
} from "./runtimeStoragePaths";

import {
  writePrivateFileAtomic,
} from "./atomicFile";

const POLICY_RULE_INTEGRITY_MARKER = "policy-rules-integrity-v1";

const policyEffects =
  new Set<PolicyEffect>([
    "allow",
    "deny",
    "require-approval",
  ]);

const policyScopeTypes =
  new Set([
    "global",
    "organization",
    "team",
    "workflow",
    "capability",
  ]);

export class PolicyRuleIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyRuleIntegrityError";
  }
}

type PolicyRuleRow = {
  readonly id: unknown;
  readonly description: unknown;
  readonly effect: unknown;
  readonly matchJson: unknown;
  readonly scopeType: unknown;
  readonly scopeId: unknown;
  readonly requiredApprovals: unknown;
  readonly position: unknown;
  readonly integritySignature: unknown;
};

/** Location of the one-time policy-rule integrity migration marker. */
export function resolvePolicyRuleIntegrityMarkerPath(): string {
  return path.join(
    resolveRuntimeDataDirectory(),
    POLICY_RULE_INTEGRITY_MARKER
  );
}

function readPolicyRuleIntegrityMarker(
  filePath =
    resolvePolicyRuleIntegrityMarkerPath()
): boolean {
  if (
    !fs.existsSync(
      filePath
    )
  ) {
    return false;
  }

  const value =
    fs
      .readFileSync(
        filePath,
        "utf8"
      )
      .trim();

  if (
    value !==
    POLICY_RULE_INTEGRITY_MARKER
  ) {
    throw new PolicyRuleIntegrityError(
      "Policy rule integrity marker is invalid"
    );
  }

  return true;
}

function writePolicyRuleIntegrityMarker(): void {
  writePrivateFileAtomic(
    resolvePolicyRuleIntegrityMarkerPath(),
    `${POLICY_RULE_INTEGRITY_MARKER}\n`
  );
}

/** Test-only: removes the sidecar marker so legacy migration paths are reachable. */
export function clearPolicyRuleIntegrityMarkerForTests(): void {
  const filePath =
    resolvePolicyRuleIntegrityMarkerPath();

  if (
    fs.existsSync(
      filePath
    )
  ) {
    fs.unlinkSync(
      filePath
    );
  }
}

function readRequiredString(
  value: unknown,
  field: string
): string {
  if (typeof value !== "string") {
    throw new PolicyRuleIntegrityError(
      `Policy rule ${field} is invalid`
    );
  }

  const trimmed =
    value.trim();

  if (!trimmed) {
    throw new PolicyRuleIntegrityError(
      `Policy rule ${field} is empty`
    );
  }

  return value;
}

function parseMatch(value: unknown): PolicyRule["match"] {
  const json =
    readRequiredString(
      value,
      "match_json"
    );

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new PolicyRuleIntegrityError(
      "Policy rule match_json is not valid JSON"
    );
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    Array.isArray(parsed)
  ) {
    throw new PolicyRuleIntegrityError(
      "Policy rule match_json must be a JSON object"
    );
  }

  return parsed as PolicyRule["match"];
}

function parseRequiredApprovals(
  value: unknown
): number | undefined {
  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  const requiredApprovals =
    Number(
      value
    );

  if (
    !Number.isInteger(
      requiredApprovals
    ) ||
    requiredApprovals < 1
  ) {
    throw new PolicyRuleIntegrityError(
      "Policy rule required_approvals must be a positive integer"
    );
  }

  return requiredApprovals;
}

function parsePolicyRuleRow(
  row: PolicyRuleRow
): {
  readonly rule: PolicyRule;
  readonly position: number;
  readonly integritySignature?: string;
} {
  const id =
    readRequiredString(
      row.id,
      "id"
    );

  const effect =
    readRequiredString(
      row.effect,
      "effect"
    );

  if (
    !policyEffects.has(
      effect as PolicyEffect
    )
  ) {
    throw new PolicyRuleIntegrityError(
      `Policy rule ${id} has unsupported effect: ${effect}`
    );
  }

  const position =
    Number(
      row.position
    );

  if (
    !Number.isInteger(
      position
    ) ||
    position < 0
  ) {
    throw new PolicyRuleIntegrityError(
      `Policy rule ${id} has invalid position`
    );
  }

  const hasScope =
    (
      row.scopeType !== null &&
      row.scopeType !== undefined
    ) ||
    (
      row.scopeId !== null &&
      row.scopeId !== undefined
    );

  const scopeType =
    hasScope
      ? readRequiredString(
          row.scopeType,
          `scope_type for ${id}`
        )
      : undefined;

  if (
    scopeType &&
    !policyScopeTypes.has(
      scopeType
    )
  ) {
    throw new PolicyRuleIntegrityError(
      `Policy rule ${id} has unsupported scope type: ${scopeType}`
    );
  }

  const requiredApprovals =
    parseRequiredApprovals(
      row.requiredApprovals
    );

  const rule: PolicyRule = {
    id,
    description:
      readRequiredString(
        row.description,
        `description for ${id}`
      ),
    effect:
      effect as PolicyRule["effect"],
    match:
      parseMatch(
        row.matchJson
      ),
    ...(hasScope
      ? {
          scope: {
            type:
              scopeType as NonNullable<PolicyRule["scope"]>["type"],
            id:
              readRequiredString(
                row.scopeId,
                `scope_id for ${id}`
              ),
          },
        }
      : {}),
    ...(requiredApprovals !== undefined
      ? {
          requiredApprovals:
            requiredApprovals,
        }
      : {}),
  };

  const integritySignature =
    typeof row.integritySignature === "string" &&
    row.integritySignature.trim().length > 0
      ? row.integritySignature
      : undefined;

  return {
    rule,
    position,
    ...(integritySignature
      ? {
          integritySignature,
        }
      : {}),
  };
}

function loadPolicyRuleRows(): PolicyRuleRow[] {
  return runtimeDb.prepare(`
    SELECT id, description, effect, match_json AS matchJson,
           scope_type AS scopeType, scope_id AS scopeId,
           required_approvals AS requiredApprovals, position,
           integrity_signature AS integritySignature
    FROM policy_rules
    ORDER BY position ASC
  `).all() as PolicyRuleRow[];
}

function signPersistedPolicyRules(
  parsedRows: readonly {
    readonly rule: PolicyRule;
    readonly position: number;
  }[],
  secret: string
): void {
  const update =
    runtimeDb.prepare(`
      UPDATE policy_rules
         SET integrity_signature = @integritySignature
       WHERE id = @id
    `);

  const migrate =
    runtimeDb.transaction(
      () => {
        parsedRows.forEach(
          ({ rule, position }) => {
            update.run({
              id:
                rule.id,
              integritySignature:
                signPolicyRule(
                  rule,
                  position,
                  secret
                ),
            });
          }
        );
      }
    );

  migrate();
}

function ensurePolicyRuleIntegrity(
  rows: readonly PolicyRuleRow[]
): readonly {
  readonly rule: PolicyRule;
  readonly position: number;
  readonly integritySignature: string;
}[] {
  const hasMarker =
    readPolicyRuleIntegrityMarker();

  if (
    rows.length === 0
  ) {
    if (!hasMarker) {
      writePolicyRuleIntegrityMarker();
    }

    return [];
  }

  const parsedRows =
    rows.map(
      parsePolicyRuleRow
    );

  const unsignedRows =
    parsedRows.filter(
      (row) =>
        !row.integritySignature
    );

  const signedRows =
    parsedRows.filter(
      (row) =>
        row.integritySignature
    );

  if (
    unsignedRows.length > 0 &&
    (
      hasMarker ||
      signedRows.length > 0
    )
  ) {
    throw new PolicyRuleIntegrityError(
      "Unsigned policy rules found after integrity migration"
    );
  }

  const secret =
    getLocalApprovalSigningSecret();

  if (
    unsignedRows.length ===
    parsedRows.length
  ) {
    signPersistedPolicyRules(
      parsedRows,
      secret
    );

    writePolicyRuleIntegrityMarker();

    return loadPolicyRuleRows().map(
      (row) => {
        const parsed =
          parsePolicyRuleRow(
            row
          );

        if (!parsed.integritySignature) {
          throw new PolicyRuleIntegrityError(
            "Policy rule integrity migration did not write a signature"
          );
        }

        return {
          rule:
            parsed.rule,
          position:
            parsed.position,
          integritySignature:
            parsed.integritySignature,
        };
      }
    );
  }

  const verifiedRows =
    parsedRows.map(
      (row) => {
        if (!row.integritySignature) {
          throw new PolicyRuleIntegrityError(
            "Policy rule signature is missing"
          );
        }

        if (
          !verifyPolicyRuleSignature(
            row.rule,
            row.position,
            row.integritySignature,
            secret
          )
        ) {
          throw new PolicyRuleIntegrityError(
            `Policy rule integrity check failed: ${row.rule.id}`
          );
        }

        return {
          rule:
            row.rule,
          position:
            row.position,
          integritySignature:
            row.integritySignature,
        };
      }
    );

  if (!hasMarker) {
    writePolicyRuleIntegrityMarker();
  }

  return verifiedRows;
}

/** Loads persisted policy rules in deterministic evaluation order. */
export function loadPolicyRules(): PolicyRule[] {
  return ensurePolicyRuleIntegrity(
    loadPolicyRuleRows()
  ).map(
    (row) =>
      row.rule
  );
}

/** Replaces persisted policy rules atomically. */
export function savePolicyRules(rules: readonly PolicyRule[]): void {
  const secret =
    getLocalApprovalSigningSecret();

  const replace = runtimeDb.transaction(() => {
    runtimeDb.prepare("DELETE FROM policy_rules").run();
    const insert = runtimeDb.prepare(`
      INSERT INTO policy_rules (
        id, description, effect, match_json, scope_type, scope_id, position,
        required_approvals, integrity_signature
      ) VALUES (
        @id, @description, @effect, @matchJson, @scopeType, @scopeId, @position,
        @requiredApprovals, @integritySignature
      )
    `);

    rules.forEach((rule, position) => insert.run({
      id: rule.id,
      description: rule.description,
      effect: rule.effect,
      matchJson: JSON.stringify(rule.match),
      scopeType: rule.scope?.type ?? null,
      scopeId: rule.scope?.id ?? null,
      position,
      requiredApprovals: rule.requiredApprovals ?? null,
      integritySignature:
        signPolicyRule(
          rule,
          position,
          secret
        ),
    }));
  });

  replace();
  writePolicyRuleIntegrityMarker();
}

/** Clears persisted policy rules. */
export function clearPolicyRules(): void {
  runtimeDb.prepare("DELETE FROM policy_rules").run();
}
