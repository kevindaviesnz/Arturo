# Scenario 031 — Agricultural advisory

## Goal and boundary

Farmwise Advisory wants seasonal guidance framed, gated, scheduled, and bounded by a house rule, with a qualified adviser signing off. Synthetic assumptions only — no farm records, soil tests, or weather connector. Arturo specifies no agrichemical rates and guarantees no outcome.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Farmwise Advisory"
                       · "Give farmers sound, evidence-aware guidance that a qualified adviser always signs off."
                       · skip
/function            → 1 · "Seasonal Advisory"
                       · "Frame seasonal farm-management questions and route recommendations to an accountable adviser."
                       · skip
/add-human-worker    → "Lead Adviser" · 1 (signs off sensitive work) · skip
/function start "Seasonal Advisory"
/staff               → yes to each Worker it proposes
```

## Add governance, a house rule, and a weekly review

```text
/governance policy add "Advisory analysis requires adviser sign-off" --effect require-approval --capability "analysis"
/memory add "Never recommend agrichemical rates or animal-health treatments; frame options and always require a qualified adviser and label local-regulation checks." --scope "Seasonal Advisory"
/schedule add "List the seasonal decisions coming up and the evidence still needed, labelling assumptions." --every weekly --at "07:30" --timezone "Pacific/Auckland" --function "Seasonal Advisory"
/schedule list
```

## Frame, approve, and read the guidance

```text
/task                → 1 · "Analyse, using synthetic assumptions only, the considerations for planning a pasture-renewal programme on a temperate dairy farm: soil and climate evidence needed, timing trade-offs, cost factors, agronomic uncertainties, and the decisions a qualified adviser must make. Do not specify agrichemical rates or guarantee outcomes." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## What to verify

- The result frames options and defers rates to a qualified adviser (the house rule held).
- The Task was gated for adviser sign-off before running.
- `/schedule list` shows the weekly review with an explicit timezone.

## Safe completion condition

A gated, scheduled, evidence-aware framing is produced with rates and treatments deferred to a person. A qualified adviser using real farm data and local regulations remains responsible for every recommendation.
