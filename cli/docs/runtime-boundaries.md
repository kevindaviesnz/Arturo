# External requests and governance boundaries

## HTTP capabilities

Both plain and authenticated HTTP capabilities use the same bounded executor.

- `timeoutMs` must be finite, positive and no larger than 2,147,483,647.
- One deadline covers destination resolution, fetch, response reading and any
  explicitly configured retries. Timeout or caller cancellation aborts the fetch
  signal, cancels a pending stream reader and stops further retries.
- A late DNS result cannot start a request after cancellation. An injected fetch
  implementation that ignores its signal cannot hold up the caller indefinitely.
- JSON successes retain their actual status (for example, 201). Status 204 or 205
  succeeds with `body: null`. HTTP failures and malformed JSON retain the observed
  response status. Error response bodies are not consumed.
- Native fetch streams are limited to 1 MiB of received body bytes before buffering
  the complete response. Content-Length is an early rejection check; the stream
  byte count also applies when the header is absent or inaccurate.
- Injected text-only adapters remain supported, with a UTF-8 byte check after
  `text()` resolves. Those adapters must bound their own allocations; they cannot
  provide the same pre-buffering memory limit as a streaming response.

Existing HTTPS host allowlists, destination checks, manual redirect handling and
credential resolution still apply. Cancellation cannot undo a request already
accepted by an external service. Explicit retry policies retain their existing
semantics; callers remain responsible for safe retry/idempotency decisions.

## Policy evaluation

`policyEngine.evaluatePolicyAtBoundary` is the shared first-match evaluator. Each
caller explicitly selects its boundary:

| Boundary | No matching rule |
| --- | --- |
| `strict-access` | Deny. Used by `evaluatePolicy` and `evaluateStrictRuntimePolicy`. |
| `job-execution` | Require approval for consequential work; otherwise no additional governance decision. |

`evaluateRuntimePolicy` remains a compatibility alias for strict access checks.
Use `runtime/jobGovernance.evaluateJobGovernance` for product Job execution. Its
scope attribution, ambiguous-Enterprise refusal, approval counts, audit records
and most-restrictive decision across capabilities remain intact.

The generic Job engine is `runtime/jobGovernanceEngine.ts`. It receives trusted
domain rules through application composition in `runtime/jobGovernance.ts`.
The existing Office drafting exception lives in `office/officeJobGovernance.ts`.
Only accepted Office staffing grants the default draft allowance; explicit custom
rules and denies still take precedence. Job/model input cannot supply domain hooks.

These changes preserve the existing approval semantics. Consolidation does not
make a generic access denial equivalent to a Job awaiting Human approval.
