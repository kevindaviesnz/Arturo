# Scenario 046 — Waste management route planning

## Goal and boundary

Greenline Waste frames a capacity problem across two Functions, with an operations lead deciding any route change. Synthetic scenarios only — no fleet, routing, or telematics connector. Arturo commits no route change.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Greenline Waste"
                       · "Collect efficiently with evidence-led planning and accountable human decisions on every route change."
                       · skip
/function            → 1 · "Route Planning"
                       · "Frame route-planning questions and route change decisions to an accountable operations lead."
                       · skip
/function            → 1 · "Demand Analysis"
                       · "Analyse synthetic collection-demand scenarios for accountable review."
                       · skip
/add-human-worker    → "Operations Lead" · 1 (signs off sensitive work) · skip
/function start "Route Planning"
/function start "Demand Analysis"
/staff               → yes to each Worker it proposes
```

## Schedule a review and delegate the demand analysis

```text
/schedule            → 1 (schedule a task)
                       · "List the routes under pressure this week and the changes awaiting an operations decision, labelling assumptions."
                       · 2 (once a week) · monday · 06:00 · Route Planning
/delegation          → 1 (ask one Function to do work for another)
                       · Route Planning · Demand Analysis
                       · "Analyse a synthetic scenario where a growing suburb pushes one collection route over capacity: evidence needed, high-level rebalancing options, service and cost trade-offs, and the decisions an operations lead must make. Do not commit a route change."
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


## Record the route-change decision

```text
/create-human-task         → "Route change decision"
                       · "Decide whether a route change proceeds and what must be confirmed first. Do not commit a change."
                       · "Only the operations lead can commit a route change."
                       · Operations Lead
/complete-human-task       → "Trial a split on the affected route after confirming crew, vehicle, and cost limits; review service impact before making it permanent. No change committed."
/human-tasks
/timeline
```

A weekly schedule asks which day, so there is no way to leave it unsaid. The
switch form took `--every weekly` and refused it — "Use daily or a weekday such
as friday" — which is the kind of thing a menu simply does not let you write.

Every question that offers a list takes the name on the row as readily as its
number — `monday`, `Route Planning`, `Demand Analysis`, `Operations Lead`.

## Safe completion condition

The demand analysis is delegated and gated, and an operations lead records the route-change decision. No change is committed; a qualified operations team using real fleet and demand data remains responsible.
