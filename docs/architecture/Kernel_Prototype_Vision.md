# Kernel prototype vision (historical Phase 2)

> **Note:** This is an old vision document. “Phase 2” here
> referred to a prototype stage, not the current investor-review phase.

We are building a **minimal deterministic operating system runtime** for structured computation.

---

## Current Reality (Phase 2)

We now have:

- Kernel-based process model
- Deterministic scheduler
- Syscall boundary
- Generator-based execution (fibers)
- Effect-driven process output

---

## Updated Goal

Instead of “workers and tasks”, the system is now:

> A controllable execution kernel for concurrent deterministic processes.

---

## What This Enables

- predictable concurrency
- reproducible execution
- controllable process lifecycle
- foundation for distributed simulation systems
- safe future IPC layer (Phase 3)

---

## Long Term Vision (Refined)

- multi-process simulation engine
- distributed deterministic runtime
- debugging + replay system
- safe message-passing IPC layer
- plugin execution sandbox
