# Worker model checkpoint

Authenticated Users and Human Workers are separate records. Enterprise ownership narrows routing and dispatch. Legacy unowned Workers remain local execution resources; ownership is never inferred from a display name. Jobs with conflicting organisation references fail closed.

## Availability

Missing legacy availability means available. Available Workers can accept new assignments. Busy and offline Workers accept no new tasks or delegation. Queued work waits until its Worker becomes available; ongoing work is not retroactively cancelled. Busy Humans may still resolve work already assigned to them. Availability is not authentication or approval authority.

`/worker-availability <name> <available|busy|offline>` persists transitions in both CLI interfaces.

## Deterministic Workers

`/workflow-worker <name> <definition.json>` registers a real persisted Worker of kind `workflow`, with only the `conversion` capability. Version 1 definitions contain 1–32 ordered pure transformations:

```json
{"version":1,"steps":[{"operation":"json-select","path":["reference"]},{"operation":"template","template":"Reference: {{input}}"}]}
```

Queue input with `/workflow-run Formatter '{"reference":"Matter 12"}' --enterprise enterprise-1` (substitute the actual Worker and Enterprise ids). This creates an ordinary `conversion` Job; the running CLI processes it through governance. Enterprise can be omitted only when scope resolves unambiguously or the Worker is a legacy unowned local resource.

Each step consumes the prior output. Text is bounded to 100,000 characters before template expansion; paths have at most 16 elements and reject prototype keys. No arbitrary code, external tools, AI models or Procedure references are supported. Unsupported operations fail closed.

Execution uses ordinary persisted Jobs, the normal governance and approval gate, capability timeout wrapper, cancellation checks and output validation. Scheduled Function routing can select staffed workflow Workers for conversion; current persisted staffing role `ai` denotes the automated executor slot for compatibility. CLI registration alone does not staff a Function. Administrative staffing APIs can assign it; a dedicated graphical workflow staffing flow is a later checkpoint.

Pause with offline; resume with available. Workflows perform bounded synchronous transformations, so cancellation is checked at entry and between steps; an event-loop timer cannot interrupt a synchronous step mid-operation. Definitions must remain bounded pure operations. Execution records deterministic transformation evidence, not independent verification of input truth.
