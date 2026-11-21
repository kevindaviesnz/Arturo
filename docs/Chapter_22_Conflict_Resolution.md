# Chapter 22 — Conflict Resolution

## What you will learn

Two Business Functions can disagree. Arturo should make the disagreement
visible and give an accountable Human a clear decision.

## A simple conflict

Imagine this situation:

- Product Design wants to start a prototype.
- Product Safety says important evidence is missing.

Neither Function should secretly overrule the other.

## Create a Human Task

```text
/create-human-task "Resolve prototype decision" "Product Design wants to begin. Product Safety says material and age-range evidence is missing. Decide whether to proceed, return for revision, or request outside review. Record the reason and next action."
```

List the Tasks:

```text
/human-tasks
```

Copy the Human Task ID and inspect it:

```text
/human-task <human-task-id>
```

## Record the real decision

Complete it:

```text
/complete-human-task <human-task-id> "Return for revision. Add material, dimensions, age range, and review evidence before prototyping." --as "Safety Lead"
```

Check the record:

```text
/human-task <human-task-id>
/timeline
```

You can also block or revise an open Task:

```text
/block-task <human-task-id> "The required reviewer is unavailable."
/revise-task <human-task-id> "Add the missing material list before a decision."
```

Use only the action that matches the real situation.

## Governance after the decision

A Human Task records a decision. It does not automatically create a new
Governance policy or perform the next action.

If later execution needs a fixed rule, add and test a policy separately.

## Important limits

- Human attribution in local state is not strong identity proof.
- Do not invent a Human name.
- The Human needs the real evidence, not only an AI summary.
- A completed Task records the choice; it does not prove the choice was wise.

## Completion check

You have finished when the Human Task shows:

- the question;
- the decision notes;
- the Human participant; and
- a Timeline record.
