# Tutorial 001 — Your first capability Task

## Outcome

Register an AI Worker, route a bounded Task by capability, and inspect its evidence-labelled result.

## Commands

```text
/reset
/add-ai-worker "Research Worker" --archetype researcher
/workers
/task create "Explain, for a general audience, what evidence would be needed to compare two local transport options. Do not invent current prices or schedules."
/tasks
/task inspect <task-id>
/timeline
```

Replace `<task-id>` with the ID printed by Arturo. A researcher archetype supplies the `research` capability; routing is based on capability rather than a famous name or model brand.

## Verify

- `/workers` identifies the Worker as AI.
- `/tasks` shows its lifecycle and selected Worker.
- `/task inspect` shows the complete output and evidence status.
- The answer does not claim external research occurred.

Task completion means execution finished. It does not establish that the prose is factually correct.
