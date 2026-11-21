# Tutorial 005 — Human Tasks and attribution

## Outcome

Create a standalone decision for an accountable Human Worker and preserve the notes and attribution.

## Commands

```text
/reset
/add-human-worker "Operations Lead" --archetype guardian --availability available
/create-human-task "Choose the next test" "Review the synthetic findings and record which test should happen next, why, and what evidence is still missing."
/human-tasks
/human-task <human-task-id>
/complete-human-task <human-task-id> "Run the accessibility test next; participant criteria and success measures must be agreed first." --as "Operations Lead"
/human-task <human-task-id>
/timeline
```

To exercise another terminal state on a new task:

```text
/block-task <human-task-id> "Required external evidence is unavailable."
```

## Boundary

Registration does not verify the person's identity, employment, qualifications, or authority. `/create-human-task` creates a standalone task; it has no upstream workflow Task, so `/revise-task` is not valid for it. Tutorial 008 covers a workflow-linked revision.
