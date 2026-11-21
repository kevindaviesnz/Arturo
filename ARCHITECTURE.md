# Arturo architecture

This page gives a plain overview of Arturo's structure. For the detailed
architecture, use the [ANEA documents](./docs/ANEA/).

## The main idea

Arturo separates four questions:

1. **What must the company be able to do?**
2. **When is work needed?**
3. **What exact work should happen?**
4. **Who or what should perform it?**

Arturo gives each question a different concept:

```text
Business Function → Runtime → Task → Worker
```

Keeping these concepts separate makes it easier to change a Worker or model
without losing the company's purpose.

## Enterprise

An **Enterprise** is the company or organisation represented in Arturo.

It owns:

- a mission;
- Business Functions;
- Workers;
- Governance policies; and
- operating records.

The current local product can store more than one Enterprise. This is not the
same as production tenant isolation.

## Business Function

A **Business Function** is an ability the Enterprise needs over time.

Examples:

- Customer Support;
- Product Safety;
- Learning Design; and
- Financial Planning.

It owns an Objective. It should not be named after a person, AI model, or
temporary project.

## Runtime

A **Runtime** is the active part of a Business Function.

It can:

- examine Events;
- decide whether work appears useful;
- create Tasks;
- route Tasks to compatible Workers;
- measure some outcomes; and
- report operational state.

Some Runtime decisions use an AI model. They may vary and must not be treated
as fixed safety rules.

## Task

A **Task** is one limited piece of work.

It records:

- the task;
- status;
- required capabilities;
- selected Worker;
- routing reason;
- Governance state;
- result; and
- evidence label.

Common states include queued, awaiting approval, running, completed, failed,
and rejected.

A completed Task is not automatically correct or verified.

## Worker

A **Worker** performs Tasks.

The current registered Worker types are:

- AI; and
- Human.

An AI Worker has an archetype and usually a configured model. A Human Worker
can participate in approvals and Human Tasks. Registration does not prove a
person's identity, job, qualifications, or authority.

AI Workers cannot run host filesystem or process capabilities by default.
Tasks that request `file-read`, `file-write`, `shell-read`, or
`shell-execute` are failed before execution unless the operator explicitly uses
the trusted local-development override. The current product has an enforcement
guard for this boundary; it does not yet have a production OS/container
sandbox.

The current product does not register robots, machines, or sensors as Worker
types.

A script, API, or external service is **not** a Worker. Arturo reaches external
systems through *capabilities* held by an AI Worker — governed HTTP requests,
webhooks, email, and Web Search — each requiring an explicit allowlist entry and
subject to Governance. So a Worker can call an API; an API cannot be a Worker.
This matters because accountability stays attached to the Worker and the
Function that owns the outcome, not to the transport that carried the request.

## Procedure

A **Procedure** is how a Worker performs a Task. A Task says *what* is needed;
the Procedure supplies the *how*.

Rather than putting instructions inside the Task (which would bloat the record
history and let a tampered Task change what runs), a Task carries only a short
reference to a Procedure version, for example `proc-backup@1`. The Procedure
itself lives in a separate, versioned registry.

A Procedure is one of two kinds:

- **generative** — a method or prompt the AI Worker follows; or
- **deterministic** — an ordered list of governed capability steps.

Each Procedure declares the capabilities it needs. Before running, Arturo
checks the reference resolves to an exact version, verifies the Procedure has
not been altered, and confirms the Worker is allowed every capability the
Procedure requires. If any check fails, the Task does not run.

A Procedure reference is version-exact on purpose: a Task never silently
upgrades to a newer Procedure version.

## Events

An **Event** records that something happened.

Active Runtimes may evaluate an Event. An Event is not a guaranteed message
delivery system, alarm, or real-time control signal.

## Governance and approvals

Governance policies use application rules to:

- allow work;
- deny work; or
- require Human approval.

This policy check is deterministic: it follows fixed code rather than asking
an AI model whether the policy should apply.

Persisted Governance policy rules are HMAC integrity-checked, including their
evaluation order. This detects ordinary database tampering after the policy
store has been migrated to signed rows. It is not a tamper-proof audit system:
an attacker who can read the local signing key or run inside the Arturo process
remains inside the current trust boundary.

Approval allows a Task to run. It does not approve the result produced later.

## Human Tasks

A **Human Task** records a decision or action that belongs to a person.

It can be open, completed, blocked, or returned for revision. Notes and
participant attribution remain part of the record.

## Operational Memory

Operational Memory stores selected information for future work.

Entries record their source, scope, evidence status, and whether they may enter
Worker context. Model-generated lessons without suitable evidence can be
quarantined.

Operational Memory is not a secret store, personal record system, or complete
knowledge base.

## Health

Health summarizes recorded operation for one Business Function.

It can use facts such as:

- completed and failed Tasks;
- open work;
- measured outcomes;
- retained lessons; and
- governed criteria.

Health does not prove that the real-world business, product, person, or machine
is healthy or safe.

## Worker Chat

Worker Chat is read-only. It can help a user question or understand an AI
Worker's records.

It cannot:

- send email;
- run tools;
- approve Tasks;
- change Arturo state; or
- perform external actions.

## Model routing

Arturo can use a local model by default. It can also use approved external
model aliases when configured and authorised.

Current safeguards include:

- fail-closed setup;
- approved aliases;
- a small process-local external call cap; and
- limited automatic escalation for repeated structured-output failures.

These safeguards are not a complete billing system.

## Persistence

Current product records are stored in SQLite and local data files.

Persistence includes important operating records, but the product still needs
production backup, migration, isolation, retention, and recovery controls.

## Low-level kernel

Arturo also contains a low-level process kernel. It supports controlled process
steps, effects, replay records, and development investigation.

Normal users should use the primary terminal commands. Developers can inspect
the low-level command surface with:

```text
/help all
```

## Current trust boundaries

Do not assume that:

- AI output is true;
- an approval verifies later output;
- a registered Human identity is verified;
- one Enterprise is a secure production tenant;
- an Event guarantees action;
- a local call cap is a monetary budget; or
- terminal records satisfy every legal audit requirement.

For definitions, read the [glossary](./docs/GLOSSARY.md). For planned work,
read the [roadmap](./ROADMAP.md).
