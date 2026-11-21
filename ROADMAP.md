# Arturo roadmap

This page separates what Arturo supports now from what may come later.

## Current status

Arturo is open-source, pre-release, command-line-only software licensed under the Apache License 2.0. It is designed to run locally on a single operator's machine backed by SQLite, not as a hosted multi-tenant service.

Current goals:

- keep the core CLI runtime reliable, inspectable, and straightforward to use;
- preserve strict deterministic trust boundaries (policy integrity, signed approvals, separate result sign-off, fail-closed capabilities);
- keep local-first model routing and bounded external escalation predictable; and
- welcome open-source feedback, testing, and contributions.

## Supported now

The maintained terminal interface (`npm run ui`) supports:

- Enterprises with names and missions;
- enduring Business Functions and Function operating state;
- AI and Human Workers with explicit archetypes and capabilities;
- capability-based Task routing and `/task reply` clarification loops;
- model-planned one-off workflows and deterministic multi-step Workflows;
- Events, deterministic `task.completed` Event rules, and Timeline records;
- persistent daily and weekly local-time Task schedules;
- same-Enterprise Delegations;
- deterministic Governance policies with HMAC integrity verification;
- signed go-ahead approvals (`/approve`, `/reject`) and separate signed result sign-off (`/task signoff`, `/task setaside`);
- Human Tasks with attribution and Artefact attachments;
- versioned Artefacts with local SHA-256 verification and exact-version Human review;
- plain-text and Word (`.docx`) Artefacts shown to AI Workers as text, with automatic clause numbering written out (PDFs, images, and scanned documents are recorded but not read);
- clause-by-clause review checks on supplied numbered documents;
- governed public Web Search with captured evidence Artefacts;
- labelled Operational Memory;
- operational Health views;
- read-only Worker Chat;
- local-first model routing with approved external aliases and process-local call limits;
- persistence in SQLite; and
- low-level replay and kernel tools for development (`/help all`).

"Supported" does not mean "safe for every production use." Read [What Arturo does not claim](./README.md#what-arturo-does-not-claim).

## Planned areas of work

### 1. Identity and access

- verified user accounts;
- clear roles and permissions;
- stronger separation between Enterprises;
- review of administrative actions; and
- tested access removal.

### 2. Deployment safety

- repeatable installation and upgrades;
- backup and recovery procedures;
- KMS-backed or asymmetric signing-key storage with rotation; and
- documented data locations and retention.

### 3. Durable work products

Arturo has a bounded native Artefact registry recording stable identity, kind, exact versions, local hashes, creator and source-work links, Human Task inputs and outputs, signed exact-version review, and approval-gated downstream Tasks. Future improvements could include managed storage, content scanning, withdrawal/supersession workflows, and retention rules (see [Chapter 40](./docs/Chapter_40_Artefacts.md)).

### 4. Cost controls

The current router prefers a local model and limits external calls per process. Future work includes persistent per-Task token/cost attribution, monetary budgets per Enterprise, and budget approval thresholds.

### 5. Sandboxed programmable Workers

Workers are currently `ai`, `human`, or bounded deterministic `workflow` definitions. Expanding sandboxed programmable Workers needs declared, versioned, integrity-checked behaviour, OS/container isolation with explicit resource and time budgets, fail-closed capability authorisation, and deterministic replay.

Current interim safeguard: AI Workers requesting host filesystem/process capabilities fail before execution unless `ARTURO_WORKER_SANDBOX_MODE=trusted-host-dev` is set explicitly for local development.

### 6. Governed integrations

Future external integrations (e.g., approved web retrieval, controlled email drafts/sending, issue trackers, document stores) must maintain least-privilege credentials, input validation, allowlists, deterministic Governance, Human approval, and audit logging.

## Later architectural directions

These are exploratory ideas documented in the later chapters, not current promises:

- Enterprise versioning and staged migrations;
- bounded scenario analysis and simulation;
- federated cross-Enterprise delegation; and
- evidence-gated operational improvement proposals.

## How this roadmap changes

Update this file when an item becomes supported, changes priority, or is discarded. Move implemented features into "Supported now."
