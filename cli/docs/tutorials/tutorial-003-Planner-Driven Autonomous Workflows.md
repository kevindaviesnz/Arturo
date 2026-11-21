# Tutorial 003 — Multi-role planned work

## Outcome

Observe a planner coordinate organisational roles without confusing Worker names with people, model providers, or guarantees of expertise.

## Commands

```text
/reset
/add-ai-worker "Market Evidence Researcher" --archetype researcher
/add-ai-worker "Launch Plan Writer" --archetype planner
/add-ai-worker "Launch Risk Reviewer" --archetype reviewer
/workers
/ask "Create a cautious launch-options briefing for a fictional educational product. Research requirements, planning assumptions, review criteria, uncertainty, and the human decisions still required must be explicit."
/tasks
```

`/ask` drafts the plan without executing it. Review the steps, then start the
run using the workflow run ID `/ask` printed:

```text
/start <workflow-run-id>
/tasks
/timeline
```

For each Task ID:

```text
/task inspect <task-id>
```

## Verify

- The planner uses registered Workers when their capabilities fit.
- Tasks preserve routing reasons and evidence labels.
- No Worker claims to have contacted customers, searched the web, or launched a product.
- The workflow ends; it does not create an ongoing Function.

For continuous Event-driven operation, create an Enterprise and a Function, then start that Function as shown in the MVP happy path.
