# Worker sandbox boundary

This document separates Arturo's current enforcement guard from the production
sandbox it still needs.

## Current enforcement

AI Worker Tasks that request any of these host-impact capabilities fail before
execution by default:

- `file-read`
- `file-write`
- `shell-read`
- `shell-execute`

The guard runs after Governance and approval gates, but before the Task is
marked running or sent to the model executor. Its purpose is to prevent an
approved Task from silently using unsandboxed host filesystem or process
authority.

`ARTURO_WORKER_SANDBOX_MODE=required` is the default. The only current override
is `ARTURO_WORKER_SANDBOX_MODE=trusted-host-dev`, which should be used only on
a trusted single-user development machine.

Current tests:

- `cli/src/runtime/workerSandboxPolicy.test.ts`
- `cli/src/runtime/workerRuntime.test.ts`, test name:
  `fails AI host capability work before execution when the worker sandbox is not available`

## What this is not

This is not an OS sandbox, container runtime, virtual machine, kernel policy,
or proof that arbitrary in-process code is isolated. Code already running
inside the Arturo process remains inside the current trust boundary.

Web Search, outbound HTTP, email, Human Tasks, and review links use separate
capability and configuration controls. They are not covered by this host
filesystem/process guard.

## Target sandbox design

A production sandbox for host-impact Worker capabilities should provide:

- isolated process or container execution;
- a per-Task working directory with explicit read/write mounts;
- no raw access to Arturo signing keys or runtime state;
- brokered Artefact reads and writes instead of arbitrary file paths;
- explicit network egress policy;
- CPU, memory, wall-clock, and output-size limits;
- syscall or equivalent host-operation restrictions where available;
- deterministic capability receipts with input, output, and policy hashes; and
- safe cleanup after success, failure, timeout, or cancellation.

Until that exists, Arturo should continue to block host filesystem/process
capabilities by default.
