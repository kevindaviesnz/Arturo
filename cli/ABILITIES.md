# Arturo Ability Roadmap

> **Plain-language summary:** This is a developer planning document for Worker
> abilities. Normal users should use `/workers`, `/worker inspect`, and
> `/help`. Capability labels help routing; they do not prove expertise,
> permission, or professional authority.

## How to read this file

This file is for developers. The short list under each **Implemented** heading
names pieces of code that exist. **Remaining** names work that is not finished.
**Result** explains what the user gets.

Some words are technical:

- **deterministic** means fixed rules decide the path;
- **runtime** means the code while it is running;
- **replay** means rebuilding past state from saved records;
- **schema** means rules for the shape of data;
- **attestation** means a signed record about an action; and
- **cryptographic** means protected with mathematical signing or hashing.

These controls can detect some changes and mistakes. They do not make a system
perfectly secure.

## Core Generic Abilities

1. Deterministic workflow orchestration
2. Capability-based tool execution
3. Human approval and escalation
4. Persistent state and replay
5. Event-driven scheduling
6. Secure policy enforcement
7. External API integration
8. Document and data ingestion
9. Search and retrieval
10. Multi-agent coordination
11. Observability and audit logging
12. Queueing and concurrency
13. Role and permission management
14. Long-running task management
15. Structured memory and context

---

# Ability 1 — Deterministic Workflow Orchestration

## Status

COMPLETED

## Implemented

- Cooperative kernel scheduler
- Generator-based workflows
- Deterministic workflow definitions
- Workflow execution engine
- Workflow definition registry
- Workflow inspection
- Workflow replayability
- Capability suspension/resume
- Process result persistence
- Timers / sleep
- Event emission
- Snapshot persistence
- Snapshot restoration
- Generic workflow spawning
- Scenario runner tests
- Deterministic execution flow

## Result

Arturo can run rule-based workflows, save their state, inspect them, and replay
supported parts of their history.

---

# Ability 2 — Capability-Based Tool Execution

## Status

COMPLETED

## Implemented

- Capability call primitive
- Capability registry
- Built-in capability definitions
- Capability lookup
- Capability risk levels
- Approval requirement metadata
- Capability timeout metadata
- Capability input schemas
- Capability output schemas
- Runtime input validation
- Runtime output validation
- Unknown capability rejection
- Invalid capability input rejection
- Invalid capability output rejection
- Capability policy checks
- Pending capability calls
- Capability call events
- Capability timeout enforcement
- Capability execution adapters
- Structured capability output parsing
- Capability receipts
- Capability attestations
- Capability attestation persistence
- Capability attestation verification
- Capability attestation signing
- Capability receipt hashing
- Capability execution integrity checks

## Result

Arturo checks capability inputs and outputs. It applies policy before execution
and can save signed receipts about supported calls.

---

# Ability 3 — Human Approval and Escalation

## Status

COMPLETED

## Implemented

- Approval chain creation
- Approval chain persistence
- Approval decision recording
- Approval rejection handling
- Approval runtime evaluation
- Human-review capability gating
- Runtime approval blocking
- Approval escalation flow
- Approval state transitions
- Approval status inspection
- Signed approval decisions
- Approval signature verification
- Tamper detection
- Runtime rejection of invalid signatures
- Multi-approval chain support
- Approval runtime tests
- Approval gate tests
- Runtime approval integration
- Approval notifications
- Approval event emission
- Policy-driven approval evaluation
- Threshold approval policies
- Majority approval policies
- Role-based approval policy foundations
- Approval-aware orchestration
- Approval replay safety
- Approval integrity enforcement
- Deterministic approval gating
- Approval auditability
- Cryptographic approval verification

## Result

Arturo can stop governed work for Human approval. It saves signed decisions and
checks them before the work continues.

---

# Ability 4 — Persistent State and Replay

## Status

MOSTLY COMPLETED

## Implemented

- Workflow snapshot persistence
- Workflow restoration
- Kernel state persistence
- Kernel snapshot syscall
- Capability receipt persistence
- Capability attestation persistence
- Workflow replay foundations
- Deterministic execution replay support
- Auto persistence
- Persistent runtime stores
- Interrupted job recovery
- Persistent approval chains
- Persistent runtime recovery normalization
- Immutable runtime event log
- Runtime event log persistence
- Runtime event serialization
- Runtime event deserialization
- Runtime event sequence numbers
- Runtime event store
- Runtime broadcast event persistence
- Runtime replay engine foundations
- Replay state reconstruction
- Replay state verification
- Stable deterministic replay serialization
- Replay integrity validation
- Persisted replay verification
- Snapshot integrity verification
- Snapshot tamper detection
- Replay checkpoint creation
- Replay checkpoint verification
- Replay checkpoint persistence
- Replay checkpoint hashing
- Replay checkpoint CLI commands
- Persisted replay checkpoint validation
- Replay recovery verification

## Remaining

- Historical reconstruction for approvals/workflows/notifications
- Snapshot + event checkpoint recovery
- State version migration
- Cross-version replay compatibility
- Full replay audit report
- Event-sourced workflow reconstruction
- Deterministic replay rollback support

## Result

Arturo can save Runtime state and verify supported replay checkpoints. Some
full historical reconstruction and cross-version recovery work remains.

---

# Ability 5 — Event-Driven Scheduling

## Status

COMPLETED

## Implemented

- Event emission
- Event storage
- Event subscriptions
- Timer/sleep primitives
- Runtime event broadcasting
- Workflow wake/resume behavior
- Approval event emission
- Runtime notification events
- Persistent runtime event log foundation
- Event sequence tracking
- Durable scheduled jobs
- Persistent scheduled job store
- Scheduled job serialization
- Scheduled job deserialization
- Scheduled job persistence
- Scheduled job recovery
- Scheduled job replay integration
- Scheduled job queue
- Scheduled job queue persistence
- Deterministic scheduled job ordering
- Runnable scheduled job detection
- Future scheduled job preservation
- Scheduled job recovery validation
- Scheduled job queue events
- Scheduled job historical reconstruction
- Replayable scheduled job state
- Scheduled job dispatcher
- Automatic scheduled job execution
- Delayed execution engine
- Retry scheduling
- Scheduled job retry policies
- Scheduled job retry persistence
- Retry event emission
- Dead-letter queues
- Dead-letter queue persistence
- Dead-letter queue recovery
- Dead-letter queue events
- Cron-style scheduling
- Cron schedule calculation
- Cron job persistence
- Cron job recovery
- Cron job dispatching
- Cron job event emission
- Historical cron job reconstruction
- Replayable cron job state
- Runtime scheduling recovery
- Mixed runtime state recovery
- Persistent scheduling integrity validation

## Remaining

- Event routing policies
- Distributed event handling
- Persistent event subscriptions
- Replayable event streams
- Distributed scheduler coordination

## Result

Arturo can save scheduled Jobs, retry supported failures, recover queues, and
rebuild supported scheduling state from records.

---

# Ability 6 — Secure Policy Enforcement

## Status

COMPLETED

## Implemented

- Capability risk levels
- Approval-required capabilities
- Capability policy checks
- Runtime capability validation
- Signed approval enforcement
- Approval signature verification
- Tamper rejection
- Capability attestation verification
- Runtime integrity enforcement
- Approval policy evaluation
- Majority approval enforcement
- Threshold approval enforcement
- Approval integrity validation
- Runtime approval-chain verification
- Declarative policy engine
- Dynamic policy loading
- Role-aware policy enforcement
- Capability trust boundaries
- Deterministic policy replay
- Policy evaluation persistence
- Policy evaluation events
- Policy event store
- Policy event replay support
- Historical policy reconstruction
- Historical policy replay
- Immutable policy audit logs
- Policy audit persistence
- Policy creation audit events
- Policy update audit events
- Policy deletion audit events
- Policy audit runtime integration
- Runtime policy event emission
- Policy inheritance
- Policy conflict resolution
- Replayable policy state
- Policy governance recovery support
- Historical runtime reconstruction of policy evaluations
- Policy governance test coverage

## Remaining

- Runtime sandbox policy controls
- Policy versioning
- Policy migration tooling
- Policy approval workflows
- Policy signing and attestation
- Distributed policy synchronization

## Result

Arturo can apply fixed policy rules while work runs. It saves policy history and
checks signed records for supported governed actions.

---

# Ability 7 — External API Integration

## Status

IN PROGRESS — HTTP + WEBHOOK FOUNDATION IMPLEMENTED

## Implemented

- Capability abstraction layer
- Capability execution adapters
- Structured capability invocation
- Capability metadata system
- Timeout enforcement hooks
- Capability integrity validation hooks
- Structured capability result handling
- HTTP capability adapter foundation
- HTTP GET capability definition
- HTTP GET capability registration
- HTTP GET request validation
- HTTPS-only URL enforcement
- HTTP timeout validation
- HTTP JSON response parsing
- HTTP response status handling
- HTTP fetch abstraction
- HTTP runtime execution wrapper
- HTTP execution adapter
- HTTP dispatcher integration
- HTTP end-to-end execution tests
- HTTP POST request model
- HTTP POST fetch option generation
- HTTP POST execution support
- Webhook capability definition
- Webhook capability registration
- Webhook execution adapter
- Webhook dispatcher integration
- Webhook end-to-end execution tests

## Remaining

- Real fetch integration using runtime/global fetch
- OAuth/token handling
- Retry policies
- Rate limiting
- API secret management
- External service attestation
- Streaming integrations
- API capability sandboxing
- API-specific connectors
- Webhook inbound handling

## Result

Arturo has low-level HTTP and webhook capabilities. They validate supported
inputs and outputs. They are developer tools, not a complete connector product.
