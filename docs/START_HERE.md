# Start here: Arturo in plain English

This page explains Arturo without assuming that you know AI or business
software.

## What is Arturo?

Arturo is software for organising work done by people and AI.

Imagine that you want to build a company. You need to answer five questions:

1. What is the company trying to achieve?
2. What ongoing responsibilities (Business Functions) does the company need?
3. What work needs to happen now?
4. Who or what should do that work?
5. Which decisions must stay under human control?

Arturo gives each answer a visible place. This makes the company easier to
inspect and control.

## The five main ideas

### 1. Enterprise

An **Enterprise** is the company or organisation.

It has a name and a mission. The mission says why it exists.

Example:

```text
Name: BrightPath Studio
Mission: Help independent professionals explain their services clearly.
```

### 2. Function (Business Function)

A **Function** (or **Business Function**) is a responsibility the Enterprise needs for a long time.

For example, a toy company might need:

- Product Development;
- Learning Design; and
- Product Safety.

A Function says **what the company must keep doing**. It should
not depend on one person, one AI model, or one set of steps. (Older chapters call
an ongoing Function a **Job**; the terminal still accepts `/job` and `/jobs` as
compatibility aliases.)

### 3. Worker

A **Worker** does a piece of work.

In the current Arturo product, a registered Worker can be:

- an AI Worker; or
- a Human Worker.

A Worker has a broad type of skill, called an **archetype**. For example, an
`analyst` is suited to analysis and a `researcher` is suited to research.
These labels help Arturo route work. They do not prove expertise or legal
authority. Run `/archetypes` to compare the available types, or
`/archetypes guardian` to inspect one.

### 4. Task

A **Task** is one clear, limited piece of work.

Examples:

- compare three options;
- draft a short explanation;
- review supplied information; or
- list questions that need an answer.

A completed Task means the Worker finished running. It does not mean the answer
is true, safe, or approved.

### 5. Governance

**Governance** means rules about what may happen.

For example, a rule can say:

> Safety work must wait for a Human approval.

Arturo checks this rule in application code. It does not ask the AI to decide
whether the rule should apply.

## How the pieces fit together

```text
Enterprise
  └─ owns ongoing Functions
       └─ creates bounded Tasks
            └─ routed to Workers

Governance can allow, block, or pause Tasks for approval.
Events record things that happened.
Memory stores selected information for future work.
Timeline records Arturo activity in time order.
```

## What does starting a Function mean?

Starting a Function turns on its operating process. The Function can then watch for
relevant Events and create Tasks for Workers.

Starting a Function does not guarantee that it will create a Task. It may need a
relevant Event, a Schedule, a suitable Worker, or Governance approval first.
Older Arturo documentation calls this operating process a **Runtime**.

## What is an Event?

An **Event** is a record that something happened.

Example:

> A new toy idea was submitted.

An Event is a fact or signal, not an order. Running Functions can examine it and
decide whether a Task is needed.

## What is Operational Memory?

**Operational Memory** is selected information that may help future work.

It is not a place for secrets, private personal information, or every sentence
an AI produces. Entries show where they came from and whether they are allowed
into future Worker context.

## What Arturo can do today

The current Arturo CLI (`npm run ui`) can:

- create and inspect Enterprises and ongoing Functions;
- register AI and Human Workers;
- create, route, and inspect Tasks;
- start ongoing Functions;
- publish Events;
- apply Governance policies;
- record signed go-ahead approvals, result sign-offs, and Human Tasks;
- store labelled Operational Memory;
- show Health and Timeline records;
- provide read-only Worker Chat; and
- use a local model first, with optional controlled external model use.

## What Arturo cannot promise today

Arturo is pre-release open-source software. It is not a hosted, production
multi-tenant service.

Arturo does not:

- make AI output true;
- prove a person's identity or qualifications;
- send email merely because an AI wrote email-shaped text;
- control machines;
- replace a lawyer, doctor, accountant, safety expert, or other professional;
- provide complete multi-user or multi-tenant security; or
- guarantee an AI provider's price, privacy, quota, or availability.

## Try the smallest demonstration

Use the five-minute
[BrightPath Studio demonstration](./investor-scenarios/01_BRIGHTPATH_BASIC.md).
It creates one Enterprise, one ongoing Job, one AI Worker, and one Task.

For installation, read
[Getting started](../cli/docs/getting_started.md).

For command syntax, run:

```text
/help
/help <command>
```

For unfamiliar words, use the [plain-language glossary](./GLOSSARY.md).
