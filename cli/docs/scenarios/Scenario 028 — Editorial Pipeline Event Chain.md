# Scenario 028 — Editorial pipeline: one completed Task triggers the next

## Goal and boundary

Lumen Press wants a deterministic hand-off: when a manuscript assessment completes, an Event is published for the production side. Synthetic proposal only — no real manuscript, author, or publishing system. Arturo accepts or rejects nothing.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Lumen Press"
                       · "Publish carefully checked work, with an editor accountable for what runs."
                       · skip
/function            → 1 · "Manuscript Assessment"
                       · "Assess submitted manuscripts and prepare an accountable editorial recommendation."
                       · skip
/function            → 1 · "Production Readiness"
                       · "Prepare production-readiness checks once a manuscript is assessed."
                       · skip
/add-human-worker    → "Commissioning Editor" · 1 (signs off sensitive work) · skip
/function start "Manuscript Assessment"
/function start "Production Readiness"
/staff               → yes to each Worker it proposes
```

## Add a deterministic event rule

```text
/event rule add --when task.completed --job "Manuscript Assessment" --publish "Manuscript assessed"
/event rule list
```

The rule is deterministic: Arturo applies it once per eligible completed Task. The model cannot publish the Event itself.

## Run the assessment and see the Event

```text
/task                → 1 · "Assess a synthetic non-fiction manuscript proposal: audience fit, evidence and sourcing quality, structural issues, risks (legal, factual), and the editorial decisions a human must make. Do not accept or reject; synthetic proposal only." · 1 (Manuscript Assessment) · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/events
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


When the assessment Task completes, `/events` shows the published `Manuscript assessed` Event. A started Production Readiness Function watches Events and may create its own work — or none, if it judges none is warranted.

## Safe completion condition

A completed assessment deterministically publishes an Event for the next stage, with the editorial decision left to a person. Nothing was accepted, rejected, or published; a qualified editor remains responsible.
