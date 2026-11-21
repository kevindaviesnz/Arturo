# Scenario 013 — A week in a sole legal practice

## Goal

Every other scenario stops shortly after work is created. This one answers the
question an evaluator actually asks: **what does Arturo do for me on an ordinary
Tuesday?**

Harbour Legal is a one-lawyer residential property practice. There is no second
lawyer, no paralegal, and no office manager. The practice does not need a
demonstration of setup — it needs the recurring shape of a working week: work
that arrives on a clock, work triggered by something happening, decisions the
lawyer must personally make, and a record of what happened that survives to
Friday.

Nothing here sends an email, files a document, contacts a client, or gives legal
advice. Every result is drafting or analysis for a qualified person to check.

## Before you start

This scenario runs on the seeded demonstration Enterprise. From `cli/`:

```bash
npm run demo
npm run ui
```

`npm run demo` is destructive — it resets local Arturo state and rebuilds
Harbour Legal from scratch. It needs no model provider. Running the week below
does: start Ollama first, or the Tasks will queue and never complete.

Confirm the starting position:

```text
/overview
/functions
/workers
```

You should see four Functions, five AI Workers, one Human Worker (Principal
Lawyer), and one Task already queued under a require-approval policy.

## Monday — the week starts itself

Real practices have work that arrives because it is Monday, not because someone
remembered. Put the recurring review on a clock:

```text
/schedule add "Review the overnight client enquiries and list which need a same-day reply, labelling every assumption." --every daily --at "08:30" --timezone "Pacific/Auckland" --function "Client Intake"
/schedule add "Summarise the matters that moved this week and list what is waiting on the principal." --every friday --at "16:00" --timezone "Pacific/Auckland" --function "Practice Administration"
/schedule list
```

Two things worth stating out loud:

- A Schedule creates a dormant Task immediately. It cannot run before its first
  due occurrence, so nothing has happened yet.
- If Arturo is not running at 08:30, the persistent Schedule queues one missed
  occurrence when Arturo next starts, then advances. It does not silently skip,
  and it does not replay a week of backlog.

The Function is never scheduled — the Task is. The Function supplies the
staffing and capability context that decides which Worker performs it.

## Tuesday — a decision only the lawyer can make

Start the advice Function, then create a bounded review Task under it. The
deterministic policy holds any `review` work for a person before it runs:

```text
/governance policy list
/function start "Client Advice"
/task create "Review a synthetic draft advice note for a small business on a commercial contract question, and list what the principal must check before it goes to the client. Do not send anything." --job "Client Advice"
/tasks
/approvals
```

The policy matches `capabilityId=review`, and the Task requires `review`. That is
the whole mechanism: a deterministic rule, not a model judgement.

Inspect the decision, then make it. Replace `<task-id>` with the ID from
`/approvals`:

```text
/approval-status <task-id>
/approve <task-id>
/approval-status <task-id>
```

Approving authorises the Task to **run**. It is not approval of whatever the
model then writes. Read the result yourself:

```text
/tasks
/task inspect <task-id>
```

The result carries the evidence label `Unverified model synthesis`. For a legal
practice that distinction is the entire point: this is a first draft for a
qualified person to check, and Arturo says so rather than presenting it as
advice.

If the work is wrong, turn it down instead and record why:

```text
/reject <task-id> "The draft assumes a settlement date that was never supplied."
```

## Wednesday — one thing finishing starts the next

A practice is a chain of dependencies. Publish an Event when advice is ready so
the administration side can pick it up:

```text
/event rule add --when task.completed --job "Client Advice" --publish "Advice ready for filing"
/event rule list
```

The rule is deterministic: Arturo applies it once per eligible completed Task.
The model cannot publish the Event itself.

For a Function to act on Events, it has to be running:

```text
/function start "Practice Administration"
/function inspect "Practice Administration"
```

A started Function watches Events and may create its own Tasks. "May" is exact —
it decides, and a running Function with no relevant Event does nothing at all.
That is correct behaviour, not a failure.

```text
/events
/tasks
```

## Thursday — handing work between responsibilities

The advice side needs something from the intake side. Delegation keeps the
accountability where it belongs:

```text
/function start "Client Intake"
/delegation request "Prepare a plain-English summary of the supplied clauses for a client who is not a lawyer." --from "Client Advice" --to "Client Intake"
/delegation list
```

The receiving Function must be started first — Arturo refuses to delegate into a
Function that cannot act. The requesting Function keeps accountability for the
outcome; delegation moves the work, not the responsibility.

Record something the practice has learned, so future work carries it:

```text
/memory add "Clients consistently misread the settlement-date clause; explain it in plain English every time." --scope "Harbour Legal"
/memory
```

Human-entered Memory is an assertion by the operator, not verified evidence.
Arturo keeps that distinction and will not promote it.

## Friday — what actually happened

This is the part a sole practitioner cannot otherwise reconstruct:

```text
/overview
/health "Client Advice"
/timeline
/events
/approvals
```

`/timeline` is the honest answer to "what did this week consist of" — every
Task, approval, Event, Schedule, and Memory change in order.

Read Health carefully. It summarises **recorded outcomes only**. A Function
showing healthy means its Tasks completed, not that the advice was correct or
that any client was well served. Health with no completed work reads `Unknown`,
which is the truthful answer rather than a reassuring one.

## When the week does not go smoothly

Work is stuck and you want to know why:

```text
/tasks all
/task inspect <task-id>
/timeline
```

A Task queued forever usually means no staffed Worker holds the capability its
wording implies, or the local model provider is not running.

The practice changed shape and a Function is no longer needed:

```text
/function remove "Practice Administration"
/workers remove "Matter Administrator"
```

Both refuse while unfinished work depends on them, and neither deletes history.
Completed Tasks, approvals, Events, and Timeline records survive removal and
still reference what performed them.

A Schedule you no longer want:

```text
/schedule list
/schedule remove <schedule-id>
```

Removal stops future occurrences and preserves the record of past ones.

## Verify

- `/schedule list` shows both recurring Tasks with explicit timezones.
- `/approvals` and `/approval-status` show a signed, attributable decision chain.
- `/task inspect` shows an evidence label distinguishing model output from
  verified fact.
- `/event rule list` shows a deterministic rule, and `/events` shows what it
  published.
- `/delegation list` shows the requesting Function still owning the outcome.
- `/timeline` reconstructs the week in order.
- No output claims that an email, filing, client contact, or legal advice
  occurred.

## Safe completion condition

The scenario succeeds when a week of practice activity is visible, attributable,
and inspectable after the fact — recurring work ran on a clock, a consequential
Task waited for a named human, one completed Task triggered the next, and every
result is labelled as unverified.

It does **not** succeed in the sense that any output is usable as legal advice. A
qualified, admitted lawyer must review every draft before it reaches a client.
Arturo has organised the week; it has not practised law, and a completed Task is
not a checked one.
