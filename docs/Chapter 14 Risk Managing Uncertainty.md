# Chapter 14 — Risk

## What you will learn

You will use current Arturo features to manage one risk, using both the
approve and reject paths this time.

**Risk** is the chance that something unwanted may happen.

Arturo does not currently have a `/risk` command or a complete risk register.
This chapter uses Governance, approvals, Tasks, and the Timeline.

## Before you begin

You need the rule from [Chapter 11](<./Chapter 11 Governance Keeping Humans in Control.md>)
still in place, and a Human Worker who can approve, from
[Chapter 13](<./Chapter 13 Human Workers First Class Participants.md>).

## A simple way to discuss risk

Ask four questions:

1. What could go wrong?
2. How likely is it?
3. How serious would it be?
4. What control reduces the risk?

Example:

| Question | Teaching answer |
|---|---|
| What could go wrong? | An AI could sound confident without real safety evidence. |
| Likelihood | Possible whenever evidence is missing. |
| Impact | Serious if someone treats the output as release approval. |
| Control | Require Human approval, label evidence, and obtain real testing. |

These labels are Human judgements, not measured facts in this exercise.

## 1. Inspect the control

```text
/governance policy inspect "Toy safety work requires Human approval"
```

```text
Governance policy
Policy        Toy safety work requires Human approval
ID            policy-...
Then          a person has to approve it first
Applies to    work needing safety
Where         organization: enterprise-1
```

Still there, still matching on `safety`.

## 2. Submit another safe test

```text
/task
```

Answer `1`, then:

`For this synthetic toy description, identify what is unknown. Do not decide that the toy is safe and do not claim external evidence.`

Answer `1` for "No, it has everything it needs."

```text
/approvals
```

The rule should stop this new Task the same way it stopped Chapter 11's —
you should now see two pending entries, `task-1` (left over from Chapter 11)
and this one.

## 3. Decide each one on its own terms

Approving and rejecting are the same command shape either way; Chapter 11's
Task and this one make good opposite examples, because nothing about the
description is wrong with the first.

If the prompt is safe and properly limited, approve it:

```text
/approve task-1
```

```text
Approval
Approval recorded  task-1
Approval status    approved
Approved by        Safety Lead
The work will run now. See how it goes with /task inspect task-1
```

Give it a moment, then check the result:

```text
/tasks
```

```text
1. ...
   ID                     task-1
   Status                 Completed
   Worker                 Product Safety Analyst
   Required capabilities  safety, research
   Evidence               An AI model wrote it; nobody has checked it
   Result preview         Evidence status: UNVERIFIED MODEL SYNTHESIS ...
```

`Completed` and `Evidence... nobody has checked it` sit right next to each
other. Approval meant the work was allowed to run — not that its answer is
trusted.

If important context is missing, reject instead — use the second Task,
which asked Arturo to name what is unknown from a description it never saw:

```text
/reject task-2 "The description is too incomplete for useful analysis."
```

```text
Rejection
Rejection recorded  task-2
Approval status     rejected
Rejected by         Safety Lead
```

A rejected Task does not run. There is no result to inspect.

## 4. Inspect the record

```text
/approval-status task-2
```

```text
Approval status
Task                task-2
Status              rejected
Waiting because     Human approval required for Product Safety, from the staffing plan you applied. (staffing-approval:ethical-toys:product-safety)
Required approvals  1
Current approvals   0

Safety Lead         rejected (The description is too incomplete for useful analysis.)
```

```text
/timeline
```

Both decisions are there, each attributed to Safety Lead, each with its
reason recorded if it gave one.

## Controls work in layers

One rule and one approval are not a complete safety system.

A stronger real process may include:

- data limits;
- compatible Worker routing;
- fixed policy;
- Human approval;
- evidence labels;
- independent testing;
- expert review;
- release authority; and
- monitoring after release.

## Important limits

- Arturo's internal risk metadata is not a complete enterprise risk system.
- A model cannot measure likelihood or impact without suitable evidence.
- Safety, legal, privacy, financial, and security obligations remain outside
  this teaching exercise.
- Never use synthetic exercises for real decisions.

## Check your understanding

You are ready for Chapter 15 when:

- you can name the risk and the control;
- you can find both decisions in `/timeline`, one approved and one rejected;
- `/approval-status task-1` shows a completed result and `task-2` shows none;
  and
- you know that Governance reduces risk but does not remove it.

Next: [Chapter 15 — Auditability](<./Chapter 15 Auditability Building Trust.md>).
