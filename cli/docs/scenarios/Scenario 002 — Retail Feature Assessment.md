# Scenario 002 — Retail feature assessment

## Goal

Northstar Outfitters is considering a feature that recommends hiking gear from a customer's trip, activity, weather, and budget. Arturo will produce a bounded product assessment, gate it behind a named human sign-off, and record an accountable product decision as a Human Task.

This scenario does not grant repository access, inspect a product catalogue, call a weather service, change code, run tests, or deploy software.

## Why the setup comes first

Arturo will not create or run work for an Enterprise that is not set up and
staffed. A bare `/task create` refuses with *"No Functions are available"*, and a
Function with no assigned Worker refuses with *"has no Worker assigned … /staff
does that"*. So the flow is always: create the Enterprise, create the Function,
register the person who signs off, start the Function, then `/staff`.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Northstar Outfitters"
                       · "Recommend the right outdoor gear using evidence, not guesswork, with a person accountable for every launch decision."
                       · skip
/function            → 1 · "Product Assessment"
                       · "Produce bounded assessments of proposed product features and prepare an accountable launch decision."
                       · skip
/add-human-worker    → "Product Owner" · 1 (signs off sensitive work) · skip
/function start "Product Assessment"
/staff               → yes to each Worker it proposes
```

`/staff` proposes the AI Workers that cover the Function and shows them one at a
time — reply `yes` to add each. It also records that sensitive work needs a
human sign-off, which is why the assessment below waits for approval.

## Create and approve the assessment

```text
/task                → 1 · "Assess a proposed hiking-gear recommendation feature. Identify user value, required inputs, privacy risks, failure modes, accessibility concerns, evidence gaps, and a smallest testable version. Do not claim access to catalogue, weather, customer, or repository data." · 1 (nothing to work from)
/tasks
```

The Task routes to a staffed Worker and lands in **Awaiting approval**. Approve it
with the ID from `/tasks`, then read the result:

```text
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


Approval authorises the Task to **run**; it is not approval of the result. The
completed result carries the evidence label `Unverified model synthesis`.

## Create an accountable product decision

Register the decision itself as a Human Task owned by the Product Owner:

```text
/create-human-task "Decide whether to prototype gear recommendations" "Review the Arturo assessment. Decide whether to prototype, return for revision, or stop. Record required evidence, privacy constraints, accessibility requirements, and the next authorised action."
/human-tasks
/human-task <human-task-id>
/complete-human-task <human-task-id> "Proceed only to a synthetic prototype after catalogue coverage, privacy, accessibility, and weather-data requirements are documented." --as "Product Owner"
```

`/revise-task` is not valid for this standalone Human Task. Revision is an
upstream workflow action and requires a Human Task linked to a source workflow
Function; Scenario 011 demonstrates that loop.

## Verify

```text
/human-task <human-task-id>
/timeline
/overview
```

- The AI Task shows `Completed` with evidence `Unverified model synthesis`.
- `/approvals`/`/approval-status` attribute the sign-off to `Product Owner`.
- The Human Task records a decision; it does not edit code or deploy anything.

## Safe completion condition

The assessment is a bounded draft and the Human Task records a decision. Production implementation requires separately authorised repository, test, review, and deployment capabilities.
