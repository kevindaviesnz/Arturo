# Scenario 047 — Regional disaster recovery coordination

## Goal and boundary

The Regional Recovery Office runs three collaborating Functions to coordinate recovery, with a coordinator deciding every commitment. Synthetic scenarios only — no logistics, agency, or communications connector. Arturo commits no resources and contacts no one.

## Create, staff, and start three Functions

```text
/reset               → yes
/enterprise          → 1 · "Regional Recovery Office"
                       · "Coordinate recovery with evidence-led planning and accountable human decisions on every commitment."
                       · skip
/function            → 1 · "Needs Assessment"
                       · "Frame community-needs questions and route priority decisions to an accountable coordinator."
                       · skip
/function            → 1 · "Resource Analysis"
                       · "Analyse synthetic resource and logistics scenarios for accountable review."
                       · skip
/function            → 1 · "Community Liaison"
                       · "Frame community-communication outlines for human approval."
                       · skip
/add-human-worker    → "Recovery Coordinator" · 1 (signs off sensitive work) · skip
/function start "Needs Assessment"
/function start "Resource Analysis"
/function start "Community Liaison"
/staff               → yes to each Worker it proposes
```

## Schedule a daily review and delegate the resource analysis

```text
/schedule            → 1 (schedule a task)
                       · "Summarise the recovery priorities still open and the decisions awaiting the coordinator, labelling assumptions."
                       · 1 (every day) · 07:00 · Needs Assessment
/delegation          → 1 (ask one Function to do work for another)
                       · Needs Assessment · Resource Analysis
                       · "Analyse a synthetic post-flood scenario: assessing community needs (shelter, water, health), the evidence required to prioritise, resource and logistics constraints, equity considerations, and the decisions a coordinator must make. Do not commit resources or contact anyone."
/delegation          → 2 (see what has been handed over)
/delegation          → 3 (look at one handover) · 1
/tasks
/approve
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Record the priority decision

```text
/create-human-task         → "Recovery priority decision"
                       · "Decide the priority order and what must be confirmed before committing resources. Do not commit resources."
                       · "Only the coordinator can commit recovery resources."
                       · Recovery Coordinator
/complete-human-task       → "Prioritise safe water and shelter, confirm supply and access before committing, and coordinate with agencies and iwi. No resources committed yet."
/human-tasks
/functions
/timeline
```

Every question that offers a list takes the name on the row as readily as its
number — `Needs Assessment`, `Resource Analysis`, `Recovery Coordinator`. A
row's number moves as records are added or change state, so naming what you mean
is the answer that cannot come to mean something else.

Bare `/approve` lists what is waiting and, with one coordinator able to decide,
does not ask who: the decision is recorded against the Recovery Coordinator.

## Safe completion condition

Three Functions collaborate, resource analysis is delegated and gated, and a coordinator records the priorities. No resources are committed and no one is contacted; qualified emergency-management staff remain responsible.
