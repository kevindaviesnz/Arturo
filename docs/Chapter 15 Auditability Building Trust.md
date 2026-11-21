# Chapter 15 — Auditability

## What you will learn

You will reconstruct the whole story of one governed Task from Arturo's records,
and find out where that story stops being trustworthy.

**Auditability** is being able to answer, afterwards, what happened and who
decided it. Not from memory, and not from what a model says happened.

There is no `/audit export` command. You assemble the account from the views
below, which is itself worth knowing: the record exists, the report does not.

## Before you begin

You need the governed Task from
[Chapter 12 — Approvals](<./Chapter 12 Approvals Human Decisions in AI Native Enterprises.md>)
— one that a policy held, a person decided on, and that then ran.

## The questions an audit has to answer

1. What was asked for?
2. What capability did it need?
3. Which Worker was chosen, and why that one?
4. Which policy applied, and what did it decide?
5. Who approved or rejected it, and when?
6. Did it run?
7. What was produced, and what is that result worth?
8. What followed?

Every one of those has a command. Work through them in order and you have the
account.

## 1. The Task itself

```text
/task
```

Answer `2` and pick the Task. This covers questions 1, 2, 3 and 7 at once: the
request, the capabilities required, the Worker with the routing reason recorded
next to it, and the result with its evidence label.

**Read the evidence label as part of the audit, not as a footnote.** "Written by
an AI model, nothing in it has been checked" is a finding about the record.

## 2. The approval

```text
/approval-status <task-id>
```

How many approvals were required, what was decided, by whom, and when. The
decision is signed, so it names a person rather than merely asserting one.

## 3. The rule that caused it

```text
/governance
```

Answer `2` to list the rules in place, and read the one that acted. A Task does
not go to a person by accident — some rule said so, and the audit is incomplete
until you can name it.

## 4. The sequence

```text
/timeline
/events
```

Newest first. You are looking for a chain along the lines of:

```text
Task Queued
Governance Check
Approval Granted
Task Started
Task Completed
```

What actually appears depends on what happened. A gap is information: if there
is no Governance Check, no rule matched, and that is worth knowing.

## 5. The human decision, if there was one

```text
/human-tasks
```

This is a separate record from the approval. Approval let the work run; a Human
Task records what a person concluded about the result. Keeping them apart is
deliberate — one is permission, the other is judgement, and conflating them is
how "approved" comes to look like "correct".

## What this does and does not prove

Arturo can show you the records Arturo saved. Within that boundary the trail is
strong: decisions are signed, the routing reason is recorded rather than
inferred, and history is added to rather than rewritten.

Outside it, Arturo proves nothing. It does not establish:

- that a named person is who they claim to be — there is no login;
- that supplied evidence is genuine;
- that everything which happened in the real world was captured;
- that the database was kept under any retention policy; or
- that any of this would satisfy a regulator, court, or professional body.

A complete-looking trail of unverified records is still a trail of unverified
records. The value is that Arturo says so on every line rather than presenting
model output as fact.

## Corrections add to the history

If something recorded is wrong, record the correction. Do not edit the original
away.

An audit trail that can be quietly amended is not one. Being able to see that a
decision changed, and when, is usually more useful than the tidier version where
it was always right.

## Check your understanding

Chapter 15 is complete when you can tell the story of one Task end to end —
what was asked, who chose the Worker and why, which rule held it, who decided,
what came out, and what that result is actually worth — and when you can name
two things in that story Arturo has not verified.

Next: [Chapter 16 — Business Function collaboration](./Chapter_16_Business_Function_Collaboration.md).
