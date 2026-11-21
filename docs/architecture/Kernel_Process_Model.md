# Kernel process model (historical)

> **Note:** This is a developer document about Arturo's
> low-level process engine. Normal users do not need it to run Arturo.

> Historical kernel terminology: a Process is not the same thing as a current Arturo AI or human Worker. This page applies only to the low-level kernel prototype.

A Process is a **deterministic execution unit** inside the kernel.

---

## Definition

A Process is:

- a generator function (fiber)
- executed by the scheduler
- controlled by the kernel

---

## Responsibilities

- execute logic step-by-step
- yield effects (not perform side effects)
- maintain local execution state

---

## Non-Responsibilities

- no direct IO
- no global state mutation
- no scheduling logic

---

## Execution Model

Processes run via:

1. scheduler selects process
2. kernel resumes fiber
3. process yields effect
4. kernel interprets effect

---

## Example

```ts
function* worker() {
  yield { type: "log", message: "hello" };
  yield { type: "sleep", ms: 1000 };
  yield { type: "log", message: "done" };
}
```
