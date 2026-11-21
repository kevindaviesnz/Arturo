# Chapter 18 — Delegation

## What you will learn

Delegation lets one Business Function ask another Function for a small, clear
piece of work.

The requesting Function keeps responsibility for the larger outcome.

## Event or Delegation?

Use an Event to announce a fact:

```text
New design submitted
```

Use a Delegation when you need a specific result:

```text
Check the supplied evidence and return a short gap list
```

## Before you begin

You need:

- two Business Functions in the same Enterprise;
- a running Runtime for the receiving Function; and
- an available AI Worker with the required capability.

Cross-Enterprise Delegation is not supported by the current CLI.

## Request bounded work

Replace the names with Functions in your own state:

```text
/delegation request "Prepare a short evidence gap list" --from "Product Safety" --to "Evidence Review"
```

Then inspect the record:

```text
/delegation list
```

Copy the Delegation ID:

```text
/delegation inspect <delegation-id>
```

If a Task was created, inspect it too:

```text
/task inspect <task-id>
/timeline
```

## What good Delegation looks like

A good request is:

- small enough to finish;
- clear about the expected result;
- sent to a suitable Function; and
- connected to a real owner.

The Product Safety Function still owns its safety outcome. Evidence Review only
owns the delegated evidence check.

## Common mistakes

- “Handle everything” is not bounded work.
- Delegation does not transfer accountability.
- A completed Task is not automatically verified evidence.
- A model-generated result must keep its evidence label.
- Long chains of Delegation can hide who is responsible.

## Completion check

You have finished when `/delegation inspect` shows:

- the sending Function;
- the receiving Function;
- the work requested;
- the linked Task;
- the Worker, if one was assigned;
- the status; and
- the result, if completed.
