# Chapter 6 — Tasks

## What you will learn

You will ask for one piece of work, find out that nobody can do it yet, and
understand why.

A **Task** is one bounded piece of work: one outcome, enough context to attempt
it, and a point at which it stops.

You have met the word already. Chapter 5 said a running Function "may create a
Task, or may decide no Task is needed". This chapter is where the word gets its
meaning.

## Before you begin

Product Safety should be running. If it is not, work through
[Chapter 5 — Bringing a Business Function to life](./Chapter_5_Bringing_a_Business_Function_to_Life.md)
first and come back.

## A Function is ongoing. A Task is not.

This is the distinction the rest of the book rests on.

| | Function | Task |
|---|---|---|
| Lasts | Indefinitely | Until it is finished |
| Example | Product Safety | "List three safety questions this cube needs answered" |
| Ends when | You retire it | The work is done, or it fails |
| Owns | An objective | One outcome |

Product Safety is not a thing you finish. Reviewing one toy is.

## 1. See what is there

```text
/tasks
```

The list will almost certainly be empty.

Chapter 5 published an Event and the running Function considered whether it
needed work. But the Enterprise has no Workers yet, so there is nobody the
Function could give work to. An empty list here is the correct answer, and the
rest of this chapter is about why.

## 2. Ask for one thing to be done

Rather than wait for the Function to decide, ask directly. You know exactly what
you asked for, which makes what happens next easy to read.

```text
/task
```

Answer `1`, then:

| Arturo asks | You answer |
|---|---|
| In one sentence, what do you want done? | `Using only this description — a soft fabric activity cube for children aged three and over — list three safety questions that need evidence before a Human release decision. Do not claim testing, certification, or legal compliance.` |
| Does this task need anything to work from? | the number beside `No, it has everything it needs` |

## 3. Read the refusal

Arturo does not create the Task. It says:

```text
Product Safety has no Worker assigned to it, so there is nobody to do this.

  /staff

Registering a Worker does not assign it to a Function; /staff does that.
```

**This is the chapter.** Nothing has gone wrong.

You have described a piece of work and named the responsibility it belongs to.
What you have not done is say who performs it. Arturo will not quietly pick
somebody, and it will not accept work it cannot route — because a Task that
exists but can never run is worse than one that was never created. It looks like
progress.

Note the last line carefully, because it is the single easiest thing to get
wrong in Arturo:

> Registering a Worker does not assign it to a Function; `/staff` does that.

Adding a Worker to the company and putting that Worker behind a particular
Function are two separate acts. Chapter 7 does both, in that order.

## Why a Task waits

Once Tasks do exist, one can sit and not run. The honest reasons are:

- no Worker is assigned to the Function that owns it;
- no assigned Worker holds a capability the Task requires;
- Governance is holding it until a person decides; or
- it is queued and the Function has not reached it yet.

`/tasks` shows the status. `/timeline` shows what happened and when.

Do not add a Worker at random to make a queue move. Match the Worker to the work.
A Task that completes because an unsuitable Worker took it has not been done —
it has been answered.

## What a status does and does not mean

You will meet these in Chapter 7, when work actually runs. Read them now, because
one of them is routinely misread.

| Status | Meaning |
|---|---|
| Queued | Waiting for a Worker or for the Function to reach it |
| Blocked — awaiting approval | Governance stopped it until a person decides |
| Running | A Worker is performing it |
| Completed | Execution ended and a result was saved |
| Failed | Execution stopped with an error |

**`Completed` means the Worker stopped. It does not mean the answer is right.**

It does not mean the evidence is real, that a professional agreed, that an email
was sent, that anything changed outside Arturo, or that anything in the real
world happened at all. Every Task carries an evidence label saying where its
result came from. Read it.

This is not a caveat. It is the difference between a record of work and a record
of claims.

## Important limits

- A Task is temporary, but its result and history are kept.
- Arturo adds to history rather than rewriting it, but the Timeline is an
  operating record, not a legal audit trail.
- Nothing here proves a Task's result is correct.

## Check your understanding

You are ready for Chapter 7 when:

- you can say what makes a Task different from a Function;
- you can explain why Arturo refused to create yours; and
- you know why `Completed` is not the same as correct.

Next: [Chapter 7 — Workers](./Chapter_7_Workers.md).
