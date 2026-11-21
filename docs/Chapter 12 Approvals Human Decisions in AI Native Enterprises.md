# Chapter 12 — Approvals

## What you will learn

You will approve one governed Task and inspect what happened.

An **approval** is a Human decision about whether a Task may run.

## Before you begin

You need:

- the pending safety Task from Chapter 11;
- a Human Worker named Safety Lead; and
- a valid `APPROVAL_SIGNING_SECRET` in `cli/.env`, or a valid
  `APPROVAL_SIGNING_SECRET_FILE`.

The secret must be a unique, non-placeholder value of at least 32 characters.
Never commit or display it.

Check the Human Worker:

```text
/workers inspect "Safety Lead"
```

If Safety Lead does not exist:

```text
/add-human-worker "Safety Lead" --archetype guardian --availability available
```

## 1. Inspect pending approvals

```text
/approvals
```

Copy the pending Task ID.

```text
/approval-status <task-id>
```

You should see:

- required approvals: 1;
- current approvals: 0; and
- no decision yet.

## 2. Approve execution

```text
/approve <task-id>
```

Then:

```text
/approval-status <task-id>
```

The decision should be attributed to Safety Lead.

## 3. Inspect the result

Wait for the Task to finish:

```text
/tasks
/task inspect <task-id>
```

Read the evidence label and output critically.

## Approval is not verification

The approval meant:

> This Task may run.

It did not mean:

> Whatever the AI says later is approved.

A real release decision may need testing, suitable experts, legal duties, and
other evidence outside Arturo.

## Rejecting work

For a different pending Task, a Human can run:

```text
/reject <task-id> "The supplied information is not enough to start this review."
```

The reason becomes part of the record.

## Important limits

- Arturo does not verify the Human Worker's identity.
- One approval count does not fit every real decision.
- Approval signatures depend on secret management.
- The approval chain helps audit work but is not automatically legally
  sufficient.

## Check your understanding

You are ready for Chapter 13 when:

- the decision shows Safety Lead;
- the Task ran only after approval; and
- you can explain why approval and result verification are separate.

Next: [Chapter 13 — Human Workers](<./Chapter 13 Human Workers First Class Participants.md>).
