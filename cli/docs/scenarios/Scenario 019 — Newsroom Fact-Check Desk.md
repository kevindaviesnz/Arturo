# Scenario 019 — Newsroom fact-check desk

## Goal and boundary

Meridian Newsroom wants claims turned into checkable questions, with an editor accountable for what runs. Arturo has no source documents, datasets, or CMS here. Nothing is published.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Meridian Newsroom"
                       · "Publish only what has been checked, with an editor accountable for every claim."
                       · skip
/function            → 1 · "Fact Check Desk"
                       · "Turn draft claims into checkable questions and evidence gaps for an accountable editor."
                       · skip
/add-human-worker    → "Managing Editor" · 1 (signs off sensitive work) · skip
/function start "Fact Check Desk"
/staff               → yes to each Worker it proposes
```

## Record the house rule, then check a claim

```text
/memory add "Separate what a source says from what is established; never present an unverified claim as fact." --scope "Fact Check Desk"
/task                → 1 · "For a hypothetical local story claiming a new cycleway cut commute times by 30 percent, list the specific claims to verify, the primary sources and data needed, the caveats, and which statements must not run until checked. Do not assert any figure as verified." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Record the editor's publication decision

```text
/create-human-task "Editor decision on publication readiness" "Decide whether the piece can proceed to editing, what must be independently verified first, and which claims are held. Do not authorise publication."
/complete-human-task <human-task-id> "Hold the 30 percent figure until the traffic dataset and methodology are verified; proceed to edit the rest with caveats." --as "Managing Editor"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

Claims are separated from established fact, and an editor holds the unverified figure. No source was retrieved and nothing was published; a qualified editor verifying primary sources remains responsible.
