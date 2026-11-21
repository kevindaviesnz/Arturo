# Scenario 024 — Airline disruption management

## Goal and boundary

Aotearoa Air Ops wants disruption options framed across two Functions, with a duty manager deciding every passenger impact. Synthetic scenarios only — no reservation system, crew roster, or messaging connector. Nothing contacts a passenger or makes a promise.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Aotearoa Air Ops"
                       · "Manage disruption with clear evidence and accountable human decisions for every passenger impact."
                       · skip
/function            → 1 · "Disruption Analysis"
                       · "Frame disruption scenarios and options for accountable review."
                       · skip
/function            → 1 · "Passenger Comms"
                       · "Prepare bounded passenger-communication outlines for human approval."
                       · skip
/add-human-worker    → "Duty Manager" · 1 (signs off sensitive work) · skip
/function start "Disruption Analysis"
/function start "Passenger Comms"
/staff               → yes to each Worker it proposes
```

## Schedule a review and delegate the analysis

```text
/schedule add "Summarise disruptions still open and the passenger impacts awaiting a duty-manager decision, labelling assumptions." --every daily --at "05:30" --timezone "Pacific/Auckland" --function "Disruption Analysis"
/delegation request "Frame options for a synthetic scenario where fog closes a regional airport for the morning: rebooking and accommodation considerations, vulnerable-passenger duty of care, cost and reputation trade-offs, and the decisions a duty manager must make. Do not contact passengers or make promises." --from "Passenger Comms" --to "Disruption Analysis"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


The delegated analysis is held for sign-off (it is consequential), so approve it to run, then read the framed options.

## Record the duty manager's decision

```text
/create-human-task "Duty manager decision" "Decide the disruption response and what passengers may be told, and identify what must be confirmed before any message goes out. Do not authorise sending."
/complete-human-task <human-task-id> "Approve rebooking guidance and duty-of-care steps; hold all passenger messaging until legal and operations confirm capacity and entitlements." --as "Duty Manager"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

Options are delegated with accountability retained, gated behind approval, and a duty manager decides passenger impact. Nothing is sent; a qualified duty manager using real operational data remains responsible.
