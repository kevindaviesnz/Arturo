# Chapter 25 — Emergent Behaviour

## What you will learn

Emergent behaviour is a pattern that appears when several parts interact. No
single part planned the whole pattern.

Do not confuse a surprising pattern with proof of intelligence or success.

## Observe the records

Publish a harmless Event in an Enterprise with more than one active Runtime:

```text
/event publish "New product idea submitted" --source "Product Strategy" --enterprise "Ethical Toys"
```

Then inspect what happened:

```text
/tasks
/events
/timeline
```

Several Runtimes may respond. One may create a Task and another may decide that
no Task is needed.

That interaction can produce an unexpected pattern. Arturo still records the
individual causes.

## Ask four questions

1. Which Event started the interaction?
2. Which Runtime created each Task?
3. Which Worker performed the Task?
4. Which policy or Human decision changed the path?

If the records cannot answer those questions, the pattern is not safely
inspectable.

## Guardrails still matter

Emergent behaviour does not remove control.

Governance can:

- deny unsafe work;
- require Human approval;
- quarantine unverified learning; and
- preserve a Timeline.

## Common mistakes

- Do not call every surprise “learning.”
- Do not call repeated model wording an organisational strategy.
- Do not let unverified output create endless follow-up Tasks.
- Do not hide the chain of Events and Tasks behind a summary.

## Completion check

You have finished when you can trace one multi-Runtime interaction from Event
to Task to Worker to result.
