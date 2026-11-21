# Chapter 5 — Bringing a Business Function to life

## What you will learn

You will start Product Safety running, and give it something to react to.

A declared Function is a statement of intent. Starting it turns on the part
that watches for Events and decides whether the Function needs work.

## Before you begin

Product Safety should already exist, with status `declared`. If it does not,
work through
[Chapter 4 — Your first Business Function](./Chapter_4_Your_First_Business_Function.md)
first and come back.

## Declared and running

The Business Function says:

> Ethical Toys needs the ability to review product safety.

A running Function asks:

> Has something happened that may need Product Safety work?

The Function coordinates work. A Worker performs the work.

## 1. Start it running

```text
/function
```

Answer `2`:

```text
  1. Add a new Function
  2. Start one running
  3. Look at a Function you've set up
  4. Change a Function's details
  5. See all your Functions
```

Product Safety is your only Function, so Arturo starts it without asking which
one. You should see:

- state `Running`;
- zero Tasks at first; and
- Health `Unknown`.

## 2. Look at it

Run `/function` again and answer `3`.

Check:

- the Function name;
- Status `active`;
- Objective;
- Operating state

## 3. Publish an event

An **Event** records that something happened.

```text
/event
```

Arturo asks what kind of signal you want:

```text
An Event is a signal that something happened, which other Functions can react to.

  1. Announce that something has happened
  2. Announce it automatically whenever work finishes
  3. See the automatic announcements
  4. Stop an automatic announcement

Reply with a number, or type cancel to stop.
```

Answer `1`. Arturo then asks one question:

| Arturo asks | You answer |
|---|---|
| Describe the event. | `New fabric activity cube submitted for safety review` |

Because Product Safety is your only Function, Arturo does not ask which one the
Event is about.

The running Function will evaluate the Event.

It may create a Task, or it may decide no Task is needed. This decision can use
the configured AI model, so the wording and result may vary.

Inspect the result:

```text
/tasks
/timeline
```

## Ongoing Function or workflow?

An ongoing Function stays active and can evaluate many Events.

A workflow is a temporary set of steps for one objective. It ends when that
piece of work ends.

## Important limits

- Starting a Function does not guarantee work.
- Event evaluation is model-assisted, not a fixed safety alarm.
- The Function does not test a real toy.
- It has no laboratory, product database, or outside evidence unless you
  provide an approved integration.
- Do not rely on this exercise for a real release decision.

## Check your understanding

You are ready for Chapter 6 when:

- `/function` answered with `3` shows Product Safety as `Running`;
- the Event appears in `/timeline`; and
- you understand that a Function coordinates work but does not perform it.

Next: [Chapter 6 — Tasks](./Chapter_6_Tasks.md).
