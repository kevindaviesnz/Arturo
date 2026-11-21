# Arturo

> The open-source command-line operating system for governed AI-native companies.

Arturo helps people organise work done by humans and AI from the terminal.

You give Arturo a company mission, define the ongoing Functions the company needs, staff AI and Human Workers, create bounded Tasks, and enforce deterministic Governance policies and signed Human approvals before consequential work runs. Arturo keeps persistent SQLite records so you can inspect and audit everything that happened.

New to Arturo? Read [Arturo in plain English](./docs/START_HERE.md) and the [glossary](./docs/GLOSSARY.md).

Arturo models the company, not only the AI:

```text
Mission → ongoing Functions → bounded Tasks → Workers
                              ↘ approvals, Events, Memory, Health
```

## Quick start

Requirements: Node.js, npm, and [Ollama](https://ollama.com/) (for local models) or an optional external API key.

```bash
cd cli
npm install
npm run ui
```

To try a pre-seeded sandbox example immediately (a fictional one-lawyer practice in its own `.data/harbour` directory, leaving your main data untouched):

```bash
cd cli
npm run try
```

Arturo uses your terminal's native scrollback and text selection, so output can be copied normally. Start with:

```text
/overview
/enterprise create "Northstar" --mission "Turn complex customer signals into decisive action"
/next "Northstar"
/staff
/function start "<function-name>"
/overview
```

`/overview` shows real persisted Arturo records. For worked walkthroughs, see the [progressive scenarios](./docs/investor-scenarios/README.md), [Arturo Builds Arturo](./docs/ARTURO_BUILDS_ARTURO.md), and the [CLI tutorials](./cli/docs/tutorial.md).

### Local configuration and secrets

Arturo reads local configuration from `cli/.env`. This file may contain API keys and must never be committed.

- `.env`, `cli/.env`, and `.env.*` are gitignored;
- `cli/.env.example` is tracked and contains placeholders only; and
- model aliases can be configured with `ARTURO_MODEL_PROFILES_JSON` in `cli/.env`.

Start from the template:

```bash
cd cli
cp .env.example .env
```

See [Model Routing](./docs/Model_Routing.md) for local-first routing, approved model aliases, external escalation controls, and session call limits.

### Documentation map

- [`cli/README.md`](./cli/README.md) — installing, running, and developing the CLI;
- [`cli/docs/README.md`](./cli/docs/README.md) — current CLI documentation and command reference;
- [`cli/docs/scenarios/README.md`](./cli/docs/scenarios/README.md) — scenario exercise index; and
- [`docs/README.md`](./docs/README.md) — conceptual chapters and architecture guide.

## Why Arturo matters

AI tools easily turn into an untraceable pile of chats, prompts, and autonomous scripts. Arturo gives each part of the company a clear purpose: it shows which Function owns the outcome, which Worker performed the Task, what evidence supports the result, and where a Human gave go-ahead approval or signed off the finished output.

## Current capabilities

The CLI supports:

- Enterprise mission definition and ongoing Function design;
- AI and Human Worker registration with explicit archetypes and capabilities;
- persistent Tasks, Events, Function operating state, Delegations, Human Tasks, approvals, Memory, Health, and audit Timeline;
- persistent daily and weekly Task schedules with explicit IANA timezones, reusable completed Tasks, Worker reselection, recorded skipped occurrences, and single-run catch-up after downtime;
- reusable ordered Workflows that can pause for named Human file creation and exact-version Human review;
- versioned Artefact records for local files and HTTPS references, including local SHA-256 verification, `.docx` text extraction, clause-by-clause review checks, Human Task attachments, signed post-output review, and approval-gated downstream Tasks;
- governed public Web Search through Brave Search or an operator-controlled SearXNG service, with explicit Worker authority, source-domain controls, process-local call limits, and captured evidence Artefacts;
- deterministic Governance policies around model-generated work, with HMAC integrity checks for persisted policy rules and rule order;
- separate signed **go-ahead approval** (`/approve`) and **result sign-off** (`/task signoff` / `/task setaside`), plus `/task reply` for conversational clarification loops;
- fail-closed AI Worker execution guard for host filesystem/process capabilities pending a production sandbox;
- evidence labels that distinguish unverified model synthesis from stronger provenance;
- read-only Worker Chat (`/chat`);
- local-first model routing with bounded external escalation through approved aliases; and
- built-in `/help <command>` guidance for the primary command surface (`/help all` exposes low-level kernel and replay commands).

## What Arturo does not claim

Arturo is pre-release open-source software. It does not:

- make model output true merely because a Task completed;
- turn approval to execute a Task into approval of its eventual result;
- verify a Human Worker's identity or professional authority;
- grant an AI Worker undeclared tools or external authority;
- provide a production OS/container sandbox for AI Worker host filesystem or process access;
- copy, upload, back up, preview, or independently verify external Artefact files;
- open search-result pages, sign in to social platforms, or bypass website restrictions;
- guarantee provider quota, availability, price, privacy, or output quality;
- provide production multi-tenant isolation or a hosted service; or
- replace legal, financial, medical, security, or other professional review.

External model calls may transfer Enterprise context, Worker context, prompts, invalid model responses, and validation errors to the configured provider. Keep external escalation disabled unless that transfer is permitted.

## Contributing, roadmap, and licence

- **Licence:** [Apache License 2.0](./LICENSE)
- **Contributing:** See [CONTRIBUTING.md](./CONTRIBUTING.md)
- **Roadmap:** See [ROADMAP.md](./ROADMAP.md)
- **Security:** See [SECURITY.md](./SECURITY.md)
