# Tutorial 004 — Deterministic approval gate

## Outcome

Require a signed human decision before an analysis Task may execute.

## Prerequisite

Set a unique `APPROVAL_SIGNING_SECRET` of at least 32 non-placeholder
characters in the untracked local environment, or configure a valid
`APPROVAL_SIGNING_SECRET_FILE`, then restart Arturo.

## Commands

```text
/reset
/enterprise create "Approval Tutorial" --mission "Demonstrate controlled execution using synthetic work."
/add-ai-worker "Analysis Worker" --archetype analyst
/add-human-worker "Accountable Reviewer" --archetype guardian --availability available
/governance policy add "Analysis requires approval" --effect require-approval --capability "analysis"
/governance policy inspect "Analysis requires approval"
/task create "Using fictional inputs only, compare two project options and identify missing evidence."
/approvals
/approval-status <task-id>
/approve <task-id>
/tasks
/task inspect <task-id>
/timeline
```

To exercise rejection, create a second Task and use:

```text
/reject <task-id> "Decision criteria are incomplete."
```

## Verify

The matching Task waits before execution, the decision is signed and audited, and approval releases only that Task. Approval authorises execution; it does not verify the model result.
