# Scenario 039 — Port logistics: operational Health from real outcomes

## Goal and boundary

Portside Logistics wants to see what operational Health actually reflects: recorded outcomes, not real-world truth. A Function with a completed Task reports Health from that outcome; a Function with no work reports `Unknown`. Synthetic scenarios only — no terminal operating system or vessel connector. Arturo commits no berth.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Portside Logistics"
                       · "Move cargo on time with evidence-led planning and accountable human decisions."
                       · skip
/function            → 1 · "Berth Scheduling"
                       · "Frame berth-scheduling questions and route decisions to an accountable operations manager."
                       · skip
/function            → 1 · "Yard Planning"
                       · "Frame yard-planning questions for accountable review."
                       · skip
/add-human-worker    → "Operations Manager" · 1 (signs off sensitive work) · skip
/function start "Berth Scheduling"
/function start "Yard Planning"
/staff               → yes to each Worker it proposes
```

## Run one Function's work, then compare Health

```text
/task                → 1 · "Analyse a synthetic berth-scheduling scenario where two vessels request the same tide window: evidence needed, sequencing options at a high level, knock-on yard effects, and the decisions an operations manager must make. Do not commit a berth." · 1 (Berth Scheduling) · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/health "Berth Scheduling"
/health "Yard Planning"
/tasks all
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## What to verify

- `Berth Scheduling` Health reflects the completed Task's recorded outcome.
- `Yard Planning` Health reads `Unknown` — the truthful answer when there is no work, not a reassuring one.
- Health summarises recorded outcomes only; it does not prove the schedule is correct.

## Safe completion condition

Health is shown to reflect recorded outcomes, with `Unknown` where none exist. No berth is committed; a qualified operations manager using real vessel and tide data remains responsible.
