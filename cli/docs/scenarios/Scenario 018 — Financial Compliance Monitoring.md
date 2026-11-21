# Scenario 018 — Financial compliance monitoring: governance, schedule, and scoped Memory

## Goal and boundary

Kowhai Financial wants recurring compliance review that is gated, scheduled, and shaped by a house rule about evidence. Synthetic assumptions only — no real transactions, customer data, or regulatory filings are connected. Nothing here is compliance advice.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Kowhai Financial"
                       · "Meet compliance obligations with evidence, scheduled review, and accountable sign-off."
                       · skip
/function            → 1 · "Compliance Monitoring"
                       · "Frame compliance-monitoring checks and route findings to an accountable compliance officer."
                       · skip
/add-human-worker    → "Compliance Officer" · 1 (signs off sensitive work) · skip
/function start "Compliance Monitoring"
/staff               → yes to each Worker it proposes
```

## Add governance, a house rule, and a weekly review

```text
/governance policy add "Compliance analysis requires officer sign-off" --effect require-approval --capability "analysis"
/memory add "Never assert a control is effective without naming the evidence; list untested controls explicitly." --scope "Compliance Monitoring"
/schedule add "Review this week's compliance exceptions and list those needing officer escalation, labelling assumptions." --every friday --at "15:00" --timezone "Pacific/Auckland" --function "Compliance Monitoring"
/schedule list
```

Three deterministic controls: a require-approval rule, a scoped assertion that shapes method, and a recurring Task that arrives on a clock.

## Draft, approve, and read the checklist

```text
/task                → 1 · "Using synthetic assumptions only, draft a monthly AML transaction-monitoring review checklist: thresholds to review, false-positive handling, escalation criteria, evidence to retain, and controls that remain untested. Do not claim access to real transactions or customer data." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/health "Compliance Monitoring"
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## What to verify

- The Task is held for officer sign-off before running.
- The result names evidence and lists untested controls (the house rule held).
- `/schedule list` shows the Friday review with an explicit timezone.
- The result is labelled `Unverified model synthesis`.

## Safe completion condition

Arturo produces a gated, scheduled, evidence-aware checklist. A qualified compliance officer using real data and the applicable regime remains responsible for every compliance decision.
