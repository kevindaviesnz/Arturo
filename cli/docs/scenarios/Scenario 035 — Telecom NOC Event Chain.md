# Scenario 035 — Telecom NOC: one completed analysis triggers the next stage

## Goal and boundary

Meridian Telecom's NOC wants a deterministic hand-off: when a fault analysis completes, an Event is published for the change side. Synthetic scenarios only — no network management system or change connector. Arturo issues no network change.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Meridian Telecom NOC"
                       · "Keep the network up with evidence-led analysis and accountable human control of every change."
                       · skip
/function            → 1 · "Fault Analysis"
                       · "Analyse synthetic network faults and prepare an accountable recommendation."
                       · skip
/function            → 1 · "Change Coordination"
                       · "Prepare change options once a fault is analysed, for human approval."
                       · skip
/add-human-worker    → "Shift Lead" · 1 (signs off sensitive work) · skip
/function start "Fault Analysis"
/function start "Change Coordination"
/staff               → yes to each Worker it proposes
```

## Add a deterministic event rule

```text
/event rule add --when task.completed --job "Fault Analysis" --publish "Fault analysed"
/event rule list
```

## Run the analysis and see the Event

```text
/task                → 1 · "Analyse a synthetic scenario where a regional link shows rising packet loss during peak hours: evidence needed, likely causes at a high level, customer-impact questions, and the change decisions a shift lead must make. Do not issue a network change." · 1 (Fault Analysis) · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/events
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


When the analysis Task completes, `/events` shows the published `Fault analysed` Event. A started Change Coordination Function watches Events and may create its own work — or none, if it judges none is warranted.

## Safe completion condition

A completed analysis deterministically publishes an Event for the change stage, with the change decision left to a person. No network change is issued; qualified engineers remain responsible.
