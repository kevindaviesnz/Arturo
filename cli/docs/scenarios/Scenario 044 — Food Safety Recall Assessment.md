# Scenario 044 — Food safety recall assessment

## Goal and boundary

Harvest Foods frames a possible food-safety incident across two Functions, with a safety manager deciding any recall. Synthetic scenarios only — no traceability, testing, or notification connector. Arturo declares no recall and clears no product.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Harvest Foods"
                       · "Protect consumers with evidence-led assessment and a person accountable for every recall decision."
                       · skip
/function            → 1 · "Incident Assessment"
                       · "Frame food-safety incident questions and route recall decisions to an accountable safety manager."
                       · skip
/function            → 1 · "Traceability Analysis"
                       · "Analyse synthetic traceability scenarios for accountable review."
                       · skip
/add-human-worker    → "Food Safety Manager" · 1 (signs off sensitive work) · skip
/function start "Incident Assessment"
/function start "Traceability Analysis"
/staff               → yes to each Worker it proposes
```

## Add governance, a house rule, and delegate the analysis

```text
/governance policy add "Recall analysis requires manager sign-off" --effect require-approval --capability "analysis"
/memory add "Never declare a product safe or unsafe; frame the evidence, traceability, and consumer-risk questions and require a qualified recall decision." --scope "Incident Assessment"
/delegation request "Analyse a synthetic scenario where a supplier reports a possible allergen mislabel affecting one production run: evidence and traceability needed, consumer-risk questions, notification considerations, and the decisions a safety manager must make. Do not declare a recall or clear the product." --from "Incident Assessment" --to "Traceability Analysis"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Record the recall decision

```text
/create-human-task "Recall decision" "Decide what traceability and testing must confirm before any recall or clearance, and how consumers would be notified. Do not declare a recall."
/complete-human-task <human-task-id> "Hold and quarantine the affected run; confirm distribution and allergen testing before any recall or clearance, and prepare consumer notification for sign-off. No decision made yet." --as "Food Safety Manager"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

The incident is analysed, delegated, and gated, and a safety manager records the recall decision. No recall is declared and no product cleared; qualified food-safety staff using real traceability and testing remain responsible.
