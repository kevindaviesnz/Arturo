# Chapter 28 — Designing AI-Native Products

## What you will learn

An AI-native product needs more than a chat box. It needs clear work, evidence,
limits, ownership, and Human decisions.

## Begin with the user outcome

Write one sentence:

```text
The user can ...
```

Then ask what the company must be able to do repeatedly. Those enduring
abilities may become Business Functions.

Do not turn every screen or button into a Function.

## Audit the available capabilities

```text
/workers
/workers inspect "Product Analyst"
/workers
```

Create a bounded product question:

```text
/task-cap --capability analysis --bounded-task "Compare two supplied product options. Use only the supplied facts. List assumptions, risks, and missing evidence."
```

Inspect the result and its evidence label:

```text
/tasks
/task inspect <task-id>
```

## Design the Human boundary

Ask which decisions can cause harm, spend money, contact people, or make a
public claim.

Those actions may need:

- a deterministic policy;
- a signed approval;
- a Human Task; or
- no automation at all.

## Measure the product, not the prose

A long AI answer is not a product outcome.

Useful measures might include:

- time saved;
- error rate;
- evidence completeness;
- number of Human corrections; and
- cost per accepted result.

## Common mistakes

- Do not use model confidence as proof.
- Do not let chat perform hidden actions.
- Do not store every answer as Memory.
- Do not call a prototype production-ready.
- Do not promise external integrations that are not built.

## Completion check

You have finished when the product design names:

1. the user outcome;
2. the owning Business Function;
3. the required Worker capability;
4. the evidence needed;
5. the Human boundary; and
6. the measure of success.
