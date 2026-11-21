# FAQ

## What should I read first?

Read [Arturo in plain English](../../docs/START_HERE.md), then follow
[Getting started](./getting_started.md).

Inside Arturo, use `/help` and `/help <command>`.

## Do I need to understand the kernel?

No. The **kernel** is low-level code that runs processes in a controlled order.
Normal Arturo users do not need its commands.

## Do I need `/tick`?

Not for normal `/ask`, function, approval, or Business Function workflows. Arturo starts its worker runtime and background services automatically.

`/tick` is an advanced developer command shown by `/help all`. It moves the
low-level scheduler forward by one step.

## Why does Arturo use generators in the kernel?

This is an implementation detail for developers. A generator lets a process
pause, request a controlled action, and continue later. This helps tests repeat
the same process order.

Higher-level services can still wait for models, HTTP, email, and storage.

## Does “deterministic” mean Arturo does not use AI?

No. It means a particular decision follows fixed application rules.

For example, a Governance policy can require Human approval for every Function with
the `safety` capability. Arturo applies that match in code. An AI model can
still perform the Function after approval.

## Does a completed Task mean the answer is correct?

No. It means the Worker finished running.

Check the evidence label, assumptions, supplied sources, approvals, and Human
review before relying on a result.

## Can Worker Chat send email?

No. Current Worker Chat is read-only. It can produce text but cannot send
email, approve work, change Arturo records, or run tools.

## How do I remove a Worker?

Use:

```text
/workers remove "<worker-name>"
```

Arturo refuses removal while unfinished Functions, active Workflows, or open Human
Tasks still depend on that Worker. It also protects built-in system Workers.
When removal succeeds, Arturo removes the registration and current staffing
assignments but keeps completed Tasks, Events, approvals, Artefacts, and other
audit history. A warning tells you when a saved Workflow still needs a
replacement Worker.

## Can an AI Worker search the web?

Yes, but only through Arturo's governed Web Search path. A local language
model does not secretly have live internet knowledge. The operator must
configure Brave Search or an operator-controlled SearXNG service, set a
process-local call allowance, and explicitly give the Worker the
`web-research` capability.

Run `/web-search` to check the setup and `/capabilities web-research` to read
the boundary. A successful search becomes a dated, hashed evidence Artefact
before the model sees it. Arturo captures result titles, URLs, and snippets.
It does not open pages, sign in to social media, bypass restrictions, or make
the snippets verified facts.

## Can a Worker automatically publish an Event after Web Search?

Not by claiming it in model text. Arturo can now apply a deterministic
post-Job Event rule:

```text
/event rule add --when task.completed --job "Science Discovery" --capability web-research --publish "Science evidence ready" --enterprise "Science Tracker"
```

The source Function must belong to the named Function's Runtime. When it completes,
Arturo reopens the exact captured search evidence, checks its hash and
provenance, and requires at least one result. Arturo then publishes the Event
once and supplies the evidence reference to other running Runtimes that create
downstream Jobs. The model does not control this decision.

Use `/event rule list`, `/events`, and `/timeline` to inspect what happened. A
stand-alone `/task-cap` Function does not belong to a Function Runtime, so it cannot
trigger this Function rule.

## How do I make work start at a regular time?

Create a persistent daily or weekly Schedule for one bounded Task:

```text
/schedule add "Retrieve current public science news" --every daily --at "09:00" --timezone "Pacific/Auckland" --job "Science Discovery" --enterprise "Science Tracker" --search-query "latest public science news"
```

Arturo, not the model, checks the clock. Schedule creation makes a dormant Task
for the named Function; each due occurrence selects an available qualified Worker
and queues that Task. The Worker runtime then decides whether it starts.
`--search-query` carries a fixed query into the `web-research` Task; it does
not perform the search by itself or bypass Worker capability and `/web-search`
controls.

A common weekly example is a Friday evening backup:

```text
/schedule add "Verify the weekly code backup" --every friday --at "18:00" --timezone "Pacific/Auckland" --job "Back up code" --enterprise "Code Keeper"
```

The Schedule routes the Task, but a real backup still requires an authorized
backup tool or integration. A language model alone cannot copy or verify files.

Use `/schedule list`, `/schedule inspect <schedule-id>`, and `/schedule remove
<schedule-id>` to manage it. If Arturo was stopped at the due time, it
queues one occurrence at the next start and schedules the following local day
or week.

## Where can I find unfamiliar words?

Use the [plain-language glossary](../../docs/GLOSSARY.md).

## Which documentation is executable?

Use [Getting started](./getting_started.md),
[the MVP happy path](./mvp-happy-path.md), and live `/help` output as the
current CLI reference.

Architecture chapters may describe future design. They should label that
material as **target architecture**.
