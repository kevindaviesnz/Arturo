# Chapter 21 — Collaboration Through Health

## What you will learn

Health tells you whether a Business Function is producing measured outcomes.
Completed Tasks alone do not prove success.

## Compare two Functions

Inspect two running Runtimes:

```text
/function inspect "Product Safety"
/function inspect "Evidence Review"
```

Then compute Health:

```text
/health "Product Safety"
/health "Evidence Review"
```

Look at:

- Tasks completed;
- Tasks failed;
- open Tasks;
- measured outcomes;
- retained lessons; and
- governed criteria.

## Read the result carefully

Possible Health labels include:

- `Healthy`
- `Degrading`
- `Unhealthy`
- `Unknown`

`Unknown` does not mean broken. It can mean there is not enough measured
evidence.

`Degrading` can appear even when every Task completed. For example, the Runtime
may have measured only one of four outcomes.

## Local and shared effects

Each Function has its own Health. However, one weak Function can affect others.

For example:

```text
Product Safety is healthy
Evidence Review is unknown
Release work is waiting for verified evidence
```

The company should not hide the missing evidence just because Product Safety
finished its Tasks.

## Important limits

- Health is computed from Arturo records.
- It is not a legal, financial, or professional certification.
- An AI result with no verified evidence may be excluded from learning.
- A stable trend can still have a weak overall state.
- Company-wide Health needs careful interpretation across Functions.

## Completion check

You have finished when you can explain:

1. why Task completion and outcome success differ;
2. why `Unknown` is sometimes honest; and
3. how one Function's Health may affect another Function.
