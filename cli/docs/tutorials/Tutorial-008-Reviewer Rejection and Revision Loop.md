# Tutorial 008 — Rejection and upstream revision

## Outcome

Create a planned workflow with a Human Task linked to an upstream AI Task, request revision, and inspect the new revision Task.

`/revise-task` cannot revise a standalone task created with `/create-human-task`; it requires a source Task and previous workflow step.

## Commands

```text
/reset
/add-ai-worker "Draft Writer" --archetype creator
/add-ai-worker "Draft Reviewer" --archetype reviewer
/add-human-worker "Publication Lead" --archetype guardian --availability available
/ask "Have the Draft Writer prepare a short fictional product announcement, have the Draft Reviewer check unsupported claims, then require the Publication Lead to review before completion."
/tasks
```

`/ask` stops at a plan, so no Human Task exists yet. Read the plan, then start
the run with the workflow run ID `/ask` printed:

```text
/start <workflow-run-id>
/tasks
/human-tasks
/human-task <human-task-id>
```

The planner is model-based. Continue only if it created an open Human Task with a source Task. Otherwise the requested human-review step was not created; do not substitute a standalone Human Task and pretend it supports upstream revision.

Request revision:

```text
/revise-task <human-task-id> "Remove unsupported performance claims, label assumptions, and add a pre-publication evidence checklist."
/tasks
/timeline
```

Inspect the revision Task and any new review task:

```text
/task inspect <revision-task-id>
/human-tasks
/human-task <new-human-task-id>
```

Complete or block the new task as the registered Human Worker:

```text
/complete-human-task <new-human-task-id> "Accepted as a fictional draft only; publication remains outside Arturo." --as "Publication Lead"
```

## Verify

The original review, revision instructions, upstream revision Task, new review state, attribution, and Timeline must remain distinguishable. Revision does not prove the new content is correct.
