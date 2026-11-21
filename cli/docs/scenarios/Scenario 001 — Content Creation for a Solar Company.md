# Scenario 001 — Solar customer education

## Goal

BrightSky Solar wants a draft homeowner guide explaining what Auckland homeowners should check before considering residential solar. This is a bounded content exercise, gated behind a named human sign-off.

No web research or publishing connector is assumed. The result must therefore identify its own uncertainty and must not invent current prices, incentives, payback periods, regulations, or performance figures.

## Why the setup comes first

Arturo will not create or run work for an Enterprise that is not set up and
staffed. `/task create` refuses until a Function exists **and** has an assigned
Worker, and Workers are assigned by `/staff`, not by registering them. So even a
one-off content job starts with the Enterprise → Function → `/staff` setup.

## Set up and staff the Function

Type each command on its own; Arturo asks for the rest. Answers are shown in
order after the arrow.

```text
/reset               → yes
/enterprise          → 1 · "BrightSky Solar"
                       · "Help residential solar customers make good decisions with honest, uncertainty-aware information."
                       · skip
/function            → 1 · "Customer Education"
                       · "Produce bounded homeowner guides that separate general guidance from claims needing current local evidence."
                       · skip
/add-human-worker    → "Publication Reviewer" · 1 (signs off sensitive work) · skip
/staff               → yes to each Worker it proposes
/function start "Customer Education"
```

`/staff` proposes a model-generated plan, so the Worker names and how many are
proposed differ every run. Accept what it offers.

## Create, approve, and read the guide

```text
/task                → 1
```

Then describe the work:

> Prepare a concise homeowner guide to evaluating residential solar in
> Auckland. Separate general considerations from claims that require current
> local evidence, identify the evidence still needed, and finish with a
> pre-publication fact-check checklist. Do not invent current prices,
> incentives, payback periods, regulations, or performance figures.

Choose `1` when asked what it should work from — it has everything it needs.

```text
/tasks
```

Wait until the Task reads **Blocked — awaiting approval**. The approval chain is
created when the runtime picks the Task up, a moment after it is queued, so
approving immediately reports that there is nothing to approve yet.

```text
/approve <task-id>
/task inspect <task-id>
```

The Task routes to a staffed Worker and waits in **Awaiting approval**. Approving
authorises it to **run**, not to publish — the completed result carries the
evidence label `Unverified model synthesis`. `/approval-status <task-id>` names
the rule that is holding it.

## Ask a Worker about the result

Worker chat is read-only — useful for explanation, not action. Use the Worker
name shown by `/workers`:

```text
/workers
/chat "<worker-name>" "Which statements in the completed guide need external verification before publication?"
/chat history "<worker-name>"
```

If asked to publish or email the guide, the Worker should explain that read-only chat cannot perform that action.

## Verify

```text
/task inspect <task-id>
/timeline
```

- The Task shows `Completed` with evidence `Unverified model synthesis`.
- The output separates general guidance from claims needing local evidence, and lists a fact-check checklist.
- The output does not claim that external research or publication occurred.

## Safe completion condition

The scenario succeeds when Arturo produces an auditable draft with explicit evidence gaps, approved to run by a named person. A suitably qualified person must still verify all customer-facing claims and use a separately governed publishing process. Completing a Task is not the same as publishing content.
