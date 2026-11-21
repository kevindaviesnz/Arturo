# Chapter 10 — Health

## What you will learn

You will read Arturo's operating picture of Product Safety, and learn what it is
not telling you.

Health answers one question:

> What do Arturo's own records say about how this Function has been operating?

It does not answer:

> Is the toy safe?

Keeping those apart is the entire point of the chapter.

## Before you begin

You need Product Safety running with at least one finished Task, from
[Chapter 7](./Chapter_7_Workers.md).

## 1. Look at the Function

```text
/function
```

Answer `3` and pick Product Safety.

The detail view shows what the Function is, whether it is running, and its
operating state — how many Tasks it has produced, which Workers are assigned,
what it has evaluated. These are counts of Arturo's own activity.

## 2. Ask for its Health

```text
/health
```

Arturo asks which Function when you have more than one, and answers straight
away when you have only one.

The overall label is one of:

| Label | What it means |
|---|---|
| `Unknown` | Not enough measured outcomes to say anything |
| `Healthy` | Recorded outcomes are mostly completing as expected |
| `Degrading` | Recorded outcomes are getting worse |
| `Unhealthy` | Recorded outcomes are mostly failing |

A new Function shows `Unknown`, and will keep showing it for a while.

## 3. Read the indicators before the label

The label is a summary of the numbers underneath it, so read those first: Tasks
completed, Tasks failed, work still open, outcomes measured, lessons retained,
and any governed criteria.

The combination that surprises people is **everything completed, Health still
`Unknown`**. That is not a bug. Completing a Task records that a Worker stopped.
Measuring an outcome records whether the result was any good — and that is a
separate act, which mostly has not happened yet.

Health counts the second thing. A Function can therefore be busy, productive,
and entirely unmeasured.

## 4. Check the records behind it

```text
/tasks
/events
/timeline
```

Health is derived from these. If a label looks wrong, the answer is here — not
in the label.

## What Health is not

`Healthy` means Arturo's recorded outcomes look fine. It does not mean:

- the toy is safe;
- the reviews were any good;
- a qualified person agreed with them; or
- anything happened outside Arturo at all.

For a real Product Safety function the evidence that matters would be
independent test results, incident reports, how long reviews take, what evidence
is still missing, and what people decided. **Arturo does not have any of that.**
It cannot invent it, and it does not pretend the numbers it does have are a
substitute.

This is why `Unknown` is the honest default rather than an inconvenience to be
cleared. A confident label computed from nothing would be worse than no label.

## Important limits

- Health is an operating indicator, not a business result and not a
  certification.
- It does not replace professional review of the work itself.
- Missing evidence produces `Unknown` by design.
- Running `/health` can itself add a record to the Event history.
- You cannot yet build a custom Health model with your own weighted indicators.

## Check your understanding

You are ready for Chapter 11 when:

- you can explain a Health label from the indicators under it;
- you can say why every Task completing does not make a Function `Healthy`; and
- you can name something about real-world safety that Health does not measure.

Next: [Chapter 11 — Governance](<./Chapter 11 Governance Keeping Humans in Control.md>).
