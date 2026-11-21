# Scenario 016 — Manufacturing QA: reject, then approve a corrected task

## Goal and boundary

Ironbark Manufacturing wants to show both sides of the deterministic gate: a first draft rejected for a real deficiency, and a corrected draft approved. Synthetic assumptions only — no real batch data, drawings, or measurements are connected.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Ironbark Manufacturing"
                       · "Ship quality product with evidence-led checks and accountable sign-off."
                       · skip
/function            → 1 · "Quality Review"
                       · "Frame quality-review checklists and route them to an accountable quality manager."
                       · skip
/add-human-worker    → "Quality Manager" · 1 (signs off sensitive work) · skip
/function start "Quality Review"
/staff               → yes to each Worker it proposes
```

## Add deterministic governance

```text
/governance policy add "Quality analysis requires manager sign-off" --effect require-approval --capability "analysis"
/governance policy list
```

## Reject a deficient draft, then approve a corrected one

```text
/task                → 1 · "Using synthetic assumptions only, draft an incoming-goods inspection checklist for a batch of aluminium fittings: sampling approach, dimensions to verify, surface-defect criteria, documentation needed, and reasons a human must sign off a rejection. Do not claim access to real batch data." · 1 (nothing to work from)
/approval-status <task-id>
/reject <task-id> "Sampling plan is not tied to a batch size or an accepted quality level."
/task                → 1 · "Revised: draft an incoming-goods inspection checklist for a 500-unit batch of aluminium fittings at AQL 1.0, listing sample size, dimensions to verify, surface-defect criteria, documentation, and human sign-off points. Synthetic assumptions only." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


Rejection records the reason and prevents execution; the revised Task is a new, separately governed record. Approval authorises the corrected analysis to run — it is not confirmation that the checklist is correct.

## Safe completion condition

The Timeline shows a rejection with its reason and a later approved, completed Task. A qualified quality professional using the real standard, drawings, and batch remains responsible for acceptance decisions.
