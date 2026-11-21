# Tutorial 002 — One-off planner workflow

## Outcome

Use `/ask` for a finite objective that may require multiple roles. The planner is model-based; deterministic runtime controls validate and route its proposed structure.

## Commands

```text
/reset
/add-ai-worker "Evidence Researcher" --archetype researcher
/add-ai-worker "Briefing Writer" --archetype creator
/add-ai-worker "Quality Reviewer" --archetype reviewer
/ask "Prepare a short decision briefing comparing three hypothetical community-event formats. Identify assumptions, accessibility considerations, evidence gaps, and a recommendation that remains conditional on supplied evidence."
/tasks
```

`/ask` stops at a plan. Read it, then start it with the workflow run ID `/ask`
printed:

```text
/start <workflow-run-id>
/tasks
/timeline
```

Inspect every material Task:

```text
/task inspect <task-id>
```

## Deterministic versus model behavior

- The model interprets the objective and proposes work.
- Arturo validates the plan schema and Worker fields.
- Capability matching, policy evaluation, lifecycle state, and audit recording are deterministic runtime behavior.
- Worker conclusions are model output, not hardcoded answers or verified evidence.

Use `/task create` instead when one known capability and one bounded Task are sufficient.
