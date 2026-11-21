# Scenario 038 — Pharmaceutical manufacturing deviation review

## Goal and boundary

Amberton Pharma runs two collaborating Functions to frame a manufacturing deviation, with a quality lead deciding batch disposition. Synthetic scenarios only — no MES, LIMS, or batch-record connector. Arturo releases or rejects no batch and asserts no fitness for use.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Amberton Pharma"
                       · "Make medicines to specification, with a quality person accountable for every deviation decision."
                       · skip
/function            → 1 · "Deviation Management"
                       · "Frame manufacturing-deviation questions and route disposition decisions to an accountable quality lead."
                       · skip
/function            → 1 · "Quality Analysis"
                       · "Analyse synthetic deviation scenarios for accountable review."
                       · skip
/add-human-worker    → "Quality Lead" · 1 (signs off sensitive work) · skip
/function start "Deviation Management"
/function start "Quality Analysis"
/staff               → yes to each Worker it proposes
```

## Add governance, a house rule, and delegate the analysis

```text
/governance policy add "Deviation analysis requires quality sign-off" --effect require-approval --capability "analysis"
/memory add "Never assert a batch is fit for release; frame the investigation, impact, and CAPA questions and require a qualified quality decision." --scope "Deviation Management"
/delegation request "Analyse a synthetic deviation where a tablet-compression batch shows an out-of-trend weight variation: evidence and investigation steps needed, batch-impact questions, CAPA considerations, and the disposition decisions a quality lead must make. Do not release or reject the batch." --from "Deviation Management" --to "Quality Analysis"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Record the disposition decision

```text
/create-human-task "Batch disposition decision" "Decide what the investigation must confirm before disposition and what CAPA is required. Do not release or reject the batch."
/complete-human-task <human-task-id> "Quarantine the batch pending a full investigation; confirm root cause and product impact before any disposition. No release authorised." --as "Quality Lead"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

The deviation analysis is delegated, gated, and a quality lead records the disposition. No batch is released or rejected; qualified quality staff following GMP and the real batch record remain responsible.
