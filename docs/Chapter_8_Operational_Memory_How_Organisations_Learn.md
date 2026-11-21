# Chapter 8 — Operational Memory

## What you will learn

You will write something down, read it back, and take it away again.

**Operational Memory** is what Arturo carries forward. A note written here is
given to Workers as context on later work, so it shapes what they produce
without anybody retyping it each time.

It is not a transcript. It should not hold everything an AI has said.

## Before you begin

You need Ethical Toys and Product Safety, from
[Chapter 4](./Chapter_4_Your_First_Business_Function.md).

## 1. See what is there

```text
/memory
```

Answer `2`.

A new installation has nothing written down, and says so. Once there are notes,
each one shows its text, its ID, what it applies to, where it came from, whether
it is allowed into a Worker's context, and when it was written.

## 2. Write a note down

Use a teaching fact:

```text
/memory
```

Answer `1`, then:

| Arturo asks | You answer |
|---|---|
| What should Arturo remember? | `Ethical Toys uses example product descriptions in this teaching exercise.` |
| Which work should this note be used for? | the number beside `Ethical Toys — everything this business does` |

Read it back with `/memory`, answer `2`. The entry should say it applies to
Ethical Toys, that it came from you rather than from a model, and that it is an
assertion rather than verified evidence.

**That last part is the point of the chapter.** Arturo records who said
something. It does not record that the thing is true. Writing a fact into memory
does not make it one, and every Worker that later reads this note is reading your
claim, not a checked one.

## 3. Write a narrower one

The same flow, filed against one Function rather than the whole business:

| Arturo asks | You answer |
|---|---|
| What should Arturo remember? | `Product Safety reviews must separate supplied facts from missing evidence.` |
| Which work should this note be used for? | the number beside `Product Safety — only this Function's work` |

Scope decides who sees it. A note filed against Product Safety reaches the work
of that Function. A note filed against Ethical Toys reaches everything the
business does. The third option, everything on this computer, crosses businesses
— which is rarely what you want, and is worth being deliberate about.

Narrower is usually better. A note that is true of one Function and wrong
everywhere else does damage in proportion to its scope.

## 4. Take one away

```text
/memory
```

Answer `3`. Arturo lists the notes and you pick the one to remove by number —
you do not need to copy an ID.

Remove the first note, the one about example product descriptions. Then answer
`2` again and confirm it has gone.

Memory is meant to be edited. A note that was right in March and wrong in June
is worse than no note, because a Worker will use it with the same confidence
either way.

## What not to store

Do not put these in Operational Memory:

- passwords or API keys;
- private personal information;
- health, financial, learner, or customer records;
- confidential legal material;
- guesses presented as facts; or
- every model answer.

Memory is not a secure secret store and not a records-management system. Notes
are held in an ordinary local database in plain text.

## Important limits

- A note is an assertion. Arturo records its source, never its truth.
- Scope controls reach, not confidentiality — anyone using this copy of Arturo
  can read every note in it.
- Nothing here is evidence. A Worker citing a note is citing you.

## Check your understanding

You are ready for Chapter 9 when:

- you can write a note and choose what it applies to;
- you can say what changes when a note is filed against a Function rather than
  the whole business; and
- you can explain why Arturo recording a note does not make it true.

Next: [Chapter 9 — Events](./Chapter_9_Events_The_History_of_an_AI_Native_Enterprise.md).
