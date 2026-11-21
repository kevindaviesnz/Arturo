# Arturo MVP readiness checklist

## Product outcome

The MVP is ready when a local user can define an Enterprise and Business Function, start its Runtime, register AI and Human Workers, create bounded work, enforce a deterministic approval rule, inspect evidence and audit history, and record an accountable human decision.

## Required user journey

- [ ] Install dependencies and build from `cli/`.
- [ ] Run the complete test suite.
- [ ] Start the native terminal with `npm run ui`.
- [ ] Use `/help` and `/help <command>` without consulting source code.
- [ ] Create and inspect an Enterprise.
- [ ] Create, describe, and inspect a Business Function.
- [ ] Start and inspect a Runtime.
- [ ] Register AI and Human Workers with clear organisational role names.
- [ ] Publish an Event or create a capability Job.
- [ ] Inspect Functions with `/functions` and `/function <job-id>`.
- [ ] Add a `require-approval` Governance policy and prove that matching work waits.
- [ ] Approve or reject the governed Task with signed attribution.
- [ ] Create and complete a standalone Human Task.
- [ ] Inspect `/events`, `/timeline`, `/memory`, and Function `/health`.
- [ ] Confirm unverified model synthesis is not treated as authoritative evidence or autonomous learning.
- [ ] Confirm `/reset` clearly warns before destructive use.

## Primary commands covered

```text
/help
/overview
/enterprise
/function
/add-ai-worker
/add-human-worker
/workers
/archetypes
/capabilities
/event
/task
/tasks
/governance
/approvals
/approve
/reject
/model
/approval-status
/create-human-task
/human-tasks
/human-task
/complete-human-task
/events
/timeline
/memory
/health
/reset
/exit
```

## Acceptance criteria

- `npm run build` succeeds.
- `npm run test:run` succeeds.
- Primary Help matches the handlers and examples.
- Secrets are absent from tracked files and invalid placeholders are rejected.
- The interface remains usable through ordinary terminal selection and scrollback.
- Failures explain recovery without exposing secrets or silently mutating unrelated state.
- Documentation never claims that Task completion proves correctness, approval verifies output, or read-only chat performs actions.
