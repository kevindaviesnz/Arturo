import { describe, expect, it } from "vitest";
import { evaluatePolicy, evaluatePolicyAtBoundary } from "./policyEngine";
import type { PolicyContext } from "./policyContext";
import type { PolicyRule } from "./policyRule";

const context: PolicyContext = { capabilityId: 'email-send', riskLevel: 'high', role: 'worker', trustBoundary: 'restricted', consequential: true };
describe('explicit policy boundaries', () => {
  it('preserves strict access denial and Job approval as explicit defaults', () => {
    expect(evaluatePolicyAtBoundary([], context, 'strict-access').decision).toEqual({ effect: 'deny' });
    expect(evaluatePolicyAtBoundary([], context, 'job-execution').decision).toEqual({ effect: 'require-approval', matchedRuleId: 'fail-closed:consequential-default' });
    expect(evaluatePolicyAtBoundary([], { ...context, consequential: false }, 'job-execution').decision).toBeUndefined();
    expect(evaluatePolicy([], context)).toEqual({ effect: 'deny' });
  });
  it.each(['allow', 'deny', 'require-approval'] as const)('uses identical explicit %s rules at both boundaries', effect => {
    const rules: PolicyRule[] = [{ id: 'explicit', description: 'test', match: {}, effect, requiredApprovals: 2 }];
    for (const boundary of ['strict-access', 'job-execution'] as const) {
      expect(evaluatePolicyAtBoundary(rules, context, boundary)).toEqual({ matchedRule: rules[0], decision: { effect, matchedRuleId: 'explicit' } });
    }
  });
  it('preserves first-match precedence and the approval rule metadata', () => {
    const rules: PolicyRule[] = [
      { id: 'review', description: 'test', match: {}, effect: 'require-approval', requiredApprovals: 2 },
      { id: 'later', description: 'test', match: {}, effect: 'deny' },
    ];
    expect(evaluatePolicyAtBoundary(rules, context, 'job-execution').matchedRule).toBe(rules[0]);
  });
});
