# Chapter 13 — Human Workers

## What you will learn

You will add yourself to the Enterprise as a Human Worker, and record a decision
that an AI Worker was not allowed to make.

People are not a fallback for when the AI fails. They are participants, listed
alongside the AI Workers, holding the decisions that should not be automated.

## Before you begin

You need Ethical Toys with Product Safety staffed, from
[Chapter 7](./Chapter_7_Workers.md), and at least one finished Task.

Until now every Worker has been an AI. The Enterprise has nobody in it.

## 1. Add a person

```text
/add-human-worker
```

Arturo asks up to four questions:

| Arturo asks | You answer |
|---|---|
| What is their name? | `Safety Lead` — or your own name |
| What should Safety Lead be able to do? | `1`, sign off sensitive work |
| What is Safety Lead's email address? | `skip` |

Option `1` is the approver. If you are running this alone, that is you.

Arturo does not verify the email and never sends anything unprompted — but
without one, it cannot contact this person at all through its governed
human-contact path.

## 2. See who is in the Enterprise now

```text
/workers
```

The list holds AI and Human Workers together. Safety Lead should show as a
Human, with the `guardian` role and whatever it is currently working on.

```text
/workers inspect "Safety Lead"
```

**Registering somebody proves nothing about them.** It records that a
participant by that name exists in this copy of Arturo. It does not establish
legal identity, employment, qualifications, an employer's permission, or any
authority under real law. There is no login, and nobody is asked to confirm
anything.

If that seems weak, it is — see the limits at the end of this chapter.

## 3. Find who can do a particular kind of work

```text
/workers --capability "review"
```

This filters the list to Workers holding that capability. The `guardian` role
carries `review`, so both an AI guardian and Safety Lead appear.

That is a routing convenience, not a credential check. Holding `review` means
Arturo may send this Worker reviewing work. It does not mean they are competent
to do it.

One capability is deliberately different. **`human-review` is only ever held by
people.** No AI role has it, which is what makes "a person must decide this"
enforceable rather than merely intended.

## 4. Record a decision only a person can make

An AI Worker can produce an analysis. Deciding what to do about it is separate
work, and Arturo tracks it separately as a **Human Task**.

```text
/create-human-task
```

Arturo asks what needs deciding, what the decision is about, and who should make
it. Answer with the Product Safety review you created in Chapter 7 as the
subject, and `Safety Lead` as the person.

See what is waiting on people:

```text
/human-tasks
```

Then record the decision:

```text
/complete-human-task
```

Pick the Human Task, and give the decision in your own words — for example that
the review may be used as a starting point but must not be described as testing
or certification.

Read it back with `/human-tasks`. The decision is stored against the person who
made it, separately from the AI output it was about. That separation is the
point: the model's work and the human judgement about it are two records, and
neither is allowed to stand in for the other.

## Human Task and Task are different things

Easy to confuse, worth keeping straight:

| | Task | Human Task |
|---|---|---|
| Done by | usually an AI Worker | a person |
| Created with | `/task` | `/create-human-task` |
| Listed by | `/tasks` | `/human-tasks` |
| Is | work to be performed | a decision to be recorded |

## Availability

People sleep, take leave, and have other jobs. Arturo shows an availability
field so it does not treat a person as an always-on service.

Be aware of what is missing: there is no way for somebody to set their own
availability, no notification when work is waiting for them, no backup approver,
and no escalation if nobody responds. In a real deployment all four of those
matter.

## Important limits

- Arturo is single-user. Adding a Human Worker creates a **role label you
  maintain**, not an account. There is no sign-in and no way for that person to
  use Arturo as themselves.
- The one mechanism that genuinely binds a decision to a named person is the
  review link, which carries a signed credential and expires after 24 hours.
- Do not register a real person without their agreement, and do not present a
  made-up person as real.
- Do not store personal details that are not needed.
- Local attribution is not identity verification.

## Check your understanding

You are ready for Chapter 14 when:

- `/workers` shows both AI and Human Workers;
- you can say what registering a person does not prove;
- you can explain the difference between a Task and a Human Task; and
- you can name the capability no AI Worker is allowed to hold.

Next: [Chapter 14 — Risk](<./Chapter 14 Risk Managing Uncertainty.md>).
