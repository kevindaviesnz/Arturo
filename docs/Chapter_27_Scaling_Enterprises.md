# Chapter 27 — Scaling an Enterprise

## What you will learn

Scaling means handling more work without losing ownership, control, or
evidence.

More Workers alone do not solve a weak design.

## Run a simple readiness check

Inspect the current state:

```text
/overview
/function list
/workers
/tasks
/approvals
/human-tasks
```

For each running Function:

```text
/function inspect "<business-function-name>"
/health "<business-function-name>"
```

## Look for bottlenecks

Ask:

- Are Tasks waiting because no Worker has the right capability?
- Is one Worker used by too many Functions?
- Are approvals waiting for one Human?
- Are outcomes measured, or only Tasks completed?
- Are model costs visible and limited?
- Can the Timeline explain failures?

## Scale one boundary at a time

A safe order is:

1. improve the task and evidence;
2. add or refine the needed capability;
3. test routing;
4. add Governance where risk requires it;
5. measure the outcome; and
6. review Health.

Do not copy a broken Function ten times.

## Model cost

Inspect routing before using an external model:

```text
/model-routing
```

Local-first routing can reduce cost. It does not guarantee quality. External
models are optional and need credentials, permission, and a call cap.

## Important limits

The current product is for private, local evaluation. It is not yet a hosted,
production multi-user service. Real scaling also needs stronger identity,
access control, notifications, operations, and support.

## Completion check

You have finished when you can name:

- the first real bottleneck;
- the evidence that shows it exists;
- the smallest safe change; and
- how you will verify the result.
