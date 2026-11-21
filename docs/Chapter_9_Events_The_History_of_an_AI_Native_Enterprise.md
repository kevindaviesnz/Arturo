# Chapter 9 — Events

## What you will learn

You will announce that something happened, watch a Function react to it, and
then make Arturo do the announcing for you.

An **Event** says that something happened. You published one in Chapter 5. This
chapter is about what they are for.

## Why announce anything

Product Safety could be told what to do. Instead it is told what happened, and
decides for itself whether that needs work.

That difference is the whole design. If one Function commands another, the two
are welded together — change one and you change the other. If a Function
announces a fact, anything that cares can react, and nothing that does not care
has to be modified. You can add a second Function next month that also listens,
and the first one never learns it exists.

## Before you begin

Product Safety should be running, with a Worker assigned to it, from
[Chapter 7](./Chapter_7_Workers.md).

## 1. Publish an Event

```text
/event
```

Answer `1`, then:

| Arturo asks | You answer |
|---|---|
| Describe the event. | `A revised fabric activity cube was submitted for safety review` |
| Which Function is this about? | the number beside `Product Safety` |

Arturo asks which Function only when you have more than one. With a single
Function it publishes straight away.

What comes back is in two parts, and they are different kinds of thing:

- **the Event was recorded** — this always happens; and
- **each running Function evaluated it** — and either created a Task or
  explained why it did not.

The second part uses an AI model, so it varies between runs. Creating no Task is
a legitimate answer, not a failure.

## 2. See what followed

```text
/events
```

Every Event, newest first, with its time, name, severity and ID. This list
includes Arturo's own records — a Worker being registered, a Task being queued —
not only the ones you published.

```text
/timeline
```

The same history read as a sequence. After the Event above you may see something
like:

```text
Event published
Task Queued
Worker assigned
Task Started
Task Completed
```

or you may see the Event and nothing after it, if the Function decided no work
was needed. Both are real outcomes. What you must not do is assume the chain
happened because you published something.

## 3. Let Arturo announce it for you

Typing every Event by hand does not scale, and a person is not always there to
type it. Arturo can announce automatically when a Function finishes a piece of
work.

The thing you are creating is a **rule**: a fixed instruction that Arturo's own
code follows, checked every time a Task completes. It is not a model deciding
whether to announce something. That distinction matters — a model can *say* it
published an Event; a rule actually does.

```text
/event
```

Answer `2`, then:

| Arturo asks | You answer |
|---|---|
| Whose finished work should trigger it? | the number beside `Product Safety` |
| When Product Safety finishes a piece of work, what should Arturo announce? | `safety review finished` |
| Should this fire for every finished task, or only some kinds? | `1` for every finished task |

As with publishing, Arturo skips the first question when you have only one
Function.

The third question narrows the rule. Answering `1` announces after any Product
Safety Task. The other rows restrict it to Tasks that needed a particular kind
of work, which is what you want once a Function does several different things
and only one of them is worth announcing.

Nothing is published yet. You have saved a rule that will fire the next time a
Product Safety Task completes.

See the rules you have:

```text
/event
```

Answer `3`. Answer `4` to stop one — removing a rule does not delete the Events
it already produced.

### Watch it fire

Create a Task the way Chapter 7 did, and let it finish. When it completes,
`/events` shows two entries rather than one: the Task completing, and
`safety review finished` published immediately after it, by Arturo, without you
typing anything.

That is the mechanism the rest of the book relies on for Functions working
together: one finishes, announces, and another reacts.

### What the rule will not do

- It only fires on a Task **completing**. There is no rule for a Task failing,
  or being approved, or anything else yet.
- The Function that published it does not react to its own announcement.
- Completion is not correctness. Chapter 6 made this point; a rule firing means
  the Worker stopped, not that the work was any good.

## 4. Announce on a timetable

Some work is due because of the calendar rather than because something happened.

```text
/schedule
```

Answer `1` and give the outcome you want, then the cadence and time Arturo asks
for. Answer `2` to see the schedules you have.

Arturo's own clock publishes the Event — no model keeps time. If Arturo is not
running at the appointed moment, the Event is published once when it next
starts, and the schedule moves on to the next occurrence rather than firing once
for every one it missed.

A schedule does not grant a Worker any ability it did not have. It creates work
on time; whether that work can be done still depends on the Worker and on
whatever the Task needs.

## Important limits

- Publishing an Event does not guarantee anything happens.
- An Event is not an alarm and carries no delivery guarantee.
- Naming a business on an Event is routing, not security. Everyone using this
  copy of Arturo can see every Event in it.
- Rules currently fire only when a Task completes.
- Schedules currently support daily or one named weekday at a local time. This
  is not a general calendar or a cron expression.

## Check your understanding

You are ready for Chapter 10 when:

- `/events` shows the Event you published;
- you can say why an Event is announced rather than addressed to somebody;
- you have a rule that announces without you typing it; and
- you can explain why "the rule fired" does not mean "the work was right".

Next: [Chapter 10 — Health](./Chapter_10_Health_Models_Knowing_Whether_an_Organisation_Is_Succeeding.md).
