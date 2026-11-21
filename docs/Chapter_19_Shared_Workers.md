# Chapter 19 — Shared Workers

## What you will learn

You will put one Worker behind two Functions, and see what that does and does
not share between them.

A Worker belongs to the Enterprise, not to the first Function that used it. That
is what makes Workers a resource rather than a possession.

## Before you begin

You need the two Functions from
[Chapter 17](./Chapter_17_Events_as_Organisational_Communication.md) — Product
Safety and Evidence Gathering — both running and staffed.

## 1. Look at the pool

```text
/workers
```

Everything registered in the Enterprise, AI and human together. Nothing in this
list says which Function a Worker belongs to, because that is not a property of
the Worker.

```text
/workers --capability "analysis"
```

Filters to Workers holding that capability. This is how you find out who *could*
take a piece of work, before deciding who *should*.

Capability is a routing fact. It says Arturo may send this Worker that kind of
work. It says nothing about whether the Worker is any good at it, and it is not
a record of what the Worker has actually done — for that, use `/tasks` and
`/timeline`.

## 2. Put one Worker behind both Functions

Run staffing again and let Arturo propose coverage for Evidence Gathering:

```text
/staff
```

Where a Worker already registered can cover what a second Function needs, the
proposal will reuse it rather than inventing another. Say `yes`.

Confirm:

```text
/function list
```

Both Functions should now name Workers, and at least one name should appear
twice.

## 3. What is shared, and what is not

The Worker is shared. **Nothing else is.**

A Worker taking a Task for Evidence Gathering does not know what it concluded
last week for Product Safety. It is not a colleague carrying context between
jobs; it is a capability being applied to a request, and each request stands
alone.

So a Task must carry everything it needs. If work depends on an earlier result,
say so in the request, or attach the Artefact — do not assume the shared Worker
remembers. This is the single most common way shared Workers disappoint people.

What *does* cross between Functions is Operational Memory, which Chapter 20
covers, and Events, which Chapter 17 covered. Those are deliberate channels.
Worker memory is not one.

## Why share at all

Sharing avoids duplicate setup, leaves less capacity idle, and costs less in
model calls.

It also raises questions Arturo does not yet answer:

- which Function's work goes first when both want the same Worker;
- what happens when it is busy;
- which Function bears the cost of a paid model call; and
- how to stop one Function consuming everything.

There is a shared pool today. Priority, reserved capacity, and per-Function cost
accounting are later work. For a single operator this rarely bites; for a real
deployment it would.

## Important limits

- Matching a capability does not establish quality.
- Availability is not a capacity guarantee.
- There is no primary command that forces a named Worker onto a Function;
  `/staff` proposes and you accept.
- A Human Worker is never used as an execution engine for AI work.

## Completion check

You have finished when you can:

1. filter the pool by capability;
2. show one Worker staffed to two Functions;
3. explain why that Worker still carries nothing between them; and
4. say which channels *do* cross Functions.

Next: [Chapter 20 — Collaboration Through Operational Memory](./Chapter_20_Collaboration_Through_Operational_Memory.md).
