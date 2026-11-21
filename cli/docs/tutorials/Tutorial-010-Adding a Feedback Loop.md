# Tutorial 010 — AI review and revision planning

## Outcome

Ask the planner for bounded draft-and-review work, then inspect what was actually created rather than assuming a hidden loop exists.

## Commands

```text
/reset
/add-ai-worker "Policy Draft Writer" --archetype creator
/add-ai-worker "Policy Draft Reviewer" --archetype reviewer
/ask "Create a short fictional equipment-check policy. Have the reviewer identify ambiguity, unsupported claims, and missing failure procedures. If revision is warranted, produce a revised draft and preserve the critique. Stop after one revision."
/tasks
```

`/ask` drafts the plan and stops. Read it, then start the run with the workflow
run ID `/ask` printed:

```text
/start <workflow-run-id>
/tasks
/timeline
```

Inspect each Task:

```text
/task inspect <task-id>
```

## Interpretation

The planner may propose separate creation, review, and revision steps, but its plan is model-generated and validation-bounded. Do not infer an iterative runtime merely from polished final prose. Verify actual Tasks and Timeline records.

For accountable human revision, use Tutorial 008. For an ongoing Function that learns only from eligible evidence, use the Function, Event, Memory, and Health path in the MVP happy path.

## Completion check

- Draft, critique, and any revision are traceable as Tasks.
- No exact reviewer conclusion is hardcoded in the tutorial.
- The result remains unverified model synthesis unless authoritative evidence was supplied.
- No publication or external action occurred.
