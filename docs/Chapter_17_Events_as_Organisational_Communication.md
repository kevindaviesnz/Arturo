# Chapter 17 — Events as Organisational Communication

## What you will learn

Chapter 9 used Events with one Function. Here you will build a second Function
and have the first one's finished work set the second one going, without either
of them knowing about the other.

This is the first chapter where Arturo coordinates rather than executes.

## Publish, do not command

Suppose Order Processing accepts an order.

It could call Inventory and tell it what to do. Now the two are welded together:
Order Processing has to know Inventory exists, know what it is called, and know
what to ask it for. Replace Inventory and you edit Order Processing.

Instead it announces a fact:

```text
Order Accepted
```

Inventory reacts if it cares. When stock is reserved it announces another fact,
and Shipping reacts to that. Nothing in the chain names the thing after it.

The practical test: **could you add a fourth Function that also reacts to
`Order Accepted`, without editing anything that already exists?** If yes, the
Functions are communicating. If no, one is issuing orders.

## Before you begin

You need Ethical Toys with Product Safety running and staffed, from
[Chapter 7](./Chapter_7_Workers.md), and you should have met automatic
announcements in [Chapter 9](./Chapter_9_Events_The_History_of_an_AI_Native_Enterprise.md).

## 1. Add the Function that will react

Product Safety identifies what evidence is missing. Something has to act on
that. Give the Enterprise a second responsibility:

```text
/function
```

Answer `1`, then:

| Arturo asks | You answer |
|---|---|
| What should the new Function be called? | `Evidence Gathering` |
| In one sentence, what should "Evidence Gathering" keep doing? | `Collect the certificates, test reports and supplier statements that safety reviews ask for.` |
| Anything more worth knowing about "Evidence Gathering"? | `skip` |

Start it, and staff it, exactly as you did for Product Safety:

```text
/function
```

Answer `2` and pick Evidence Gathering. Then:

```text
/staff
```

Say `yes` to the Workers proposed for it.

## 2. Connect them with an announcement

Now say what Product Safety announces when it finishes:

```text
/event
```

Answer `2`, then:

| Arturo asks | You answer |
|---|---|
| Whose finished work should trigger it? | the number beside `Product Safety` |
| When Product Safety finishes a piece of work, what should Arturo announce? | `safety review finished` |
| Should this fire for every finished task, or only some kinds? | `1` for every finished task |

Read what you have just built carefully. You told Product Safety **what to
announce**. You did not tell it about Evidence Gathering, and Evidence Gathering
has not been told about Product Safety. Neither names the other anywhere.

## 3. Watch one set the other going

Create a Product Safety Task as Chapter 7 did, and let it finish. Then:

```text
/timeline
```

You should see, in order: the Task completing, `safety review finished` being
published by Arturo, and Evidence Gathering evaluating that announcement.

Whether it creates work is its own decision, made by a model, and it may
reasonably decide none is needed. What matters is that it *was asked* — the
announcement reached a Function nobody wired to it by name.

```text
/tasks
```

If Evidence Gathering did create work, its Task will say which Worker it went to
and why.

## Name facts clearly

The names you choose are the interface between Functions, so they outlive the
insides of both.

Good Event names describe something that has happened:

- `Order Accepted`
- `Stock Reserved`
- `Safety Review Finished`

Weak names are instructions, or leak how a Function works internally:

- `Update Row 42`
- `Call Inventory Now`
- `Run Step Three`

An Event name should still make sense after the Function that publishes it has
been rewritten. If renaming a database column would force you to rename an
Event, the name was describing the machinery rather than the fact.

## Important limits

- Publishing does not prove anything acted. A Function may evaluate an
  announcement and decide to do nothing, which is a real answer.
- A Function does not react to its own announcements.
- Rules fire only when a Task completes. There is no rule for failure, approval,
  or anything else yet.
- Events from outside systems need integration code; nothing arrives on its own.
- Never put passwords or personal data in an Event name. Everyone using this
  copy of Arturo can read every Event in it.

## Completion check

You have finished when:

- two Functions are running in the same Enterprise;
- finishing work in the first publishes an announcement without you typing it;
- `/timeline` shows the second Function evaluating that announcement; and
- you can explain why neither Function mentions the other.

Next: [Chapter 18 — Delegation](./Chapter_18_Delegation.md).
