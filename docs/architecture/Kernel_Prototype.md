# Kernel prototype architecture (historical)

> **Note:** This describes an older kernel-first design. Current
> user behaviour is defined by primary `/help`, handlers, and tests.

> Historical note: this document describes the low-level deterministic kernel prototype. It is not the complete architecture of the current CLI, which also uses asynchronous model, HTTP, email, persistence, review, and worker-runtime services. Use `/help all` for the advanced kernel commands and the [CLI Getting Started guide](../../cli/docs/getting_started.md) for the supported MVP path.

## System Overview

The system is a **minimal deterministic kernel runtime**.

Instead of task pipelines, execution is managed via:

Process → Scheduler → Syscalls → Effects → State Transition

---

## Core Components

### 1. Input Layer (impure)
- CLI (REPL)
- Future: API / external drivers

Converts user input into **kernel syscalls**

---

### 2. Kernel (core runtime)

Responsible for:
- process creation
- scheduling
- syscall handling
- state transitions

This is the **single source of truth**

---

### 3. Process Model

A Process is:

- a generator (fiber)
- with local state
- and an execution context

Processes yield **effects** instead of calling APIs directly.

---

### 4. Scheduler

Deterministic round-robin scheduler:

- selects next ready process
- resumes its fiber
- applies effect result
- updates kernel state

---

### 5. Syscall Layer

Controlled interface into kernel:

- spawn
- tick
- list
- sleep

Kernel-process interaction goes through syscalls. Higher-level Arturo runtime services currently perform external model, HTTP, email, and persistence I/O outside this prototype kernel.

---

### 6. Effect System (internal only)

Processes yield effects such as:

- log
- sleep

Effects are interpreted by the scheduler/kernel.

---

### 7. State Model

KernelState:

- processes
- readyQueue
- blockedQueue
- timers
- nextPid

---

## Execution Flow

Input (CLI)
→ syscall
→ kernel
→ scheduler tick
→ process execution
→ effect handling
→ state update

---

## Design Principles

- Deterministic execution
- No hidden state mutation
- Kernel is single authority
- Processes are isolated
- Effects are explicit outputs
