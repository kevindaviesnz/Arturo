# Scenario 033 — Aviation maintenance planning

## Goal and boundary

Skyline Maintenance wants reliability trends analysed and routed to a licensed engineer, who signs off every airworthiness decision. Synthetic data only — no maintenance system, reliability database, or manuals connector. Arturo specifies no maintenance action and clears nothing for flight.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Skyline Maintenance"
                       · "Plan maintenance so a licensed engineer signs off every airworthiness decision."
                       · skip
/function            → 1 · "Maintenance Planning"
                       · "Frame maintenance-planning questions and route airworthiness decisions to a licensed engineer."
                       · skip
/function            → 1 · "Reliability Analysis"
                       · "Analyse synthetic reliability trends for accountable review."
                       · skip
/add-human-worker    → "Licensed Engineer" · 1 (signs off sensitive work) · skip
/function start "Maintenance Planning"
/function start "Reliability Analysis"
/staff               → yes to each Worker it proposes
```

## Add governance and delegate the analysis

```text
/governance policy add "Airworthiness analysis requires engineer sign-off" --effect require-approval --capability "analysis"
/delegation request "Analyse a synthetic reliability trend where a component shows rising unscheduled removals: evidence needed, possible causes at a high level, the manuals and data an engineer must consult, and the decisions a licensed engineer must make. Do not specify a maintenance action or clear anything for flight." --from "Maintenance Planning" --to "Reliability Analysis"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Record the airworthiness decision

```text
/create-human-task "Airworthiness decision" "Decide what the licensed engineer must verify before any maintenance action, and what data and manuals are required. Do not clear anything for flight."
/complete-human-task <human-task-id> "Investigate against the maintenance manual and reliability data; no component may be cleared for flight until a licensed engineer signs the record. Planning only." --as "Licensed Engineer"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

The reliability analysis is delegated, gated, and a licensed engineer records the airworthiness decision. Nothing is cleared for flight; a licensed engineer using the manuals and real data remains responsible for every airworthiness decision.
