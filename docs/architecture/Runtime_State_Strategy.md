# Runtime state strategy

> **Summary:** This developer document explains where Arturo keeps
> state, which records survive a restart, and which state is temporary.

Arturo uses different state mechanisms for different responsibilities rather than treating one database or in-memory object as universal authority.

## Current approach

- In-memory stores provide the hot execution view used by queues, Workers, Jobs, Runtimes, and active coordination.
- SQLite repositories persist durable operational records, audit Events, checkpoints, policies, approvals, Human Tasks, Delegations, notifications, and replay material where implemented.
- Pure transition and validation functions define legal state changes; persistence must not bypass those invariants.
- Startup and replay paths reconstruct required runtime state from durable records and verify integrity where attestations exist.

## Design rules

1. Do not move hot-path queue operations directly into SQLite without measuring contention, ordering, and recovery behavior.
2. Do not treat process memory as durable evidence.
3. Persist before claiming durable success when a workflow depends on the record surviving restart.
4. Keep secrets out of ordinary Events, logs, prompts, and state snapshots.
5. Make idempotency, ordering, retries, and partial failure explicit at every persistence boundary.
6. Test restart and recovery behavior, not only the in-process happy path.

## Direction

The long-term goal is a clearly defined write model, durable event/checkpoint model, and reconstructable read model with documented consistency guarantees. Any migration must preserve existing audit and approval integrity rather than silently rewriting history.
