# Chapter 31 — Versioning and Migration

> **Summary:** When replacing an important Function, run the old
> and new versions carefully and keep a clear change record. Native migration
> commands are target architecture.

*Safe migration keeps old and new behavior distinguishable until every dependency has been verified.*

## Current versus target architecture

Arturo does not currently implement versioned Event schemas, Function contracts, migration plans, dependency discovery, dual-publishing controls, compatibility checks, automatic data transformation, retirement gates, snapshots, or rollback.

This chapter therefore has two layers:

1. an executable rehearsal using supported commands and synthetic information; and
2. a target architecture describing what production versioning and migration must eventually enforce.

Any command shown under **Target architecture** is illustrative and must not be entered into the current CLI.

## Starting state

Chapter 30 added `Accessibility Review Function` to `Harbour Studio Sandbox`.
Imagine that the pilot has exposed a genuine contract change: future requests
must distinguish the Artefact version being reviewed and include an
evidence-status field.

The existing free-text request is treated as v1:

```text
Accessibility review requested
```

The proposed v2 conceptual payload is:

```json
{
  "event_type": "accessibility_review_requested",
  "schema_version": 2,
  "artifact_version": "guide-2.0-draft",
  "evidence_status": "synthetic-unverified"
}
```

Arturo does not validate either structure as a schema. The JSON above is design documentation, not a supported Event payload.

Inspect the live baseline:

```text
/enterprise inspect "Harbour Studio Sandbox"
/function inspect "Accessibility Review Function"
/function inspect "Accessibility Review Function"
/workers
/governance policy list
/tasks
/events
/timeline
```

Record the Function ID, Runtime ID, current policy ID, relevant Task IDs, and current Event position in an external migration ledger. Arturo does not generate a migration snapshot.

## Why silent replacement is dangerous

A producer can change faster than its consumers. If an Event, delegation request, Memory convention, Task expectation, or Function Objective changes in place, an existing consumer may:

- reject the new input;
- ignore a required field;
- reinterpret an old field incorrectly;
- create the wrong Task;
- duplicate work;
- continue appearing healthy while producing the wrong outcome; or
- fail only after the old behavior is no longer recoverable.

Free-text interfaces make silent semantic change particularly hard to detect. Reusing the same Event label with new meaning provides no machine-checkable compatibility boundary.

## Migration invariants

Before changing anything, define conditions that must remain true:

1. v1 remains observable until every known consumer is assessed.
2. v2 is distinguishable from v1 in every record and test.
3. No real or sensitive data is used in the rehearsal.
4. The new Function cannot make a release decision autonomously.
5. Existing Tasks, Events, approvals, and Human Tasks remain inspectable.
6. The old Runtime is paused before it is considered retired.
7. A human decides whether the migration advances or stops.
8. The external ledger records evidence that Arturo's timeline does not.

These invariants are organizational controls. Arturo does not currently enforce them as one migration object.

## 1. Propose the migration

Record the proposed change before adding v2:

```text
/create-human-task "Review accessibility contract v2 proposal" "Decide whether to pilot a successor Accessibility Review v2 Function. The conceptual v2 request adds artifact_version and evidence_status. Identify consumers, compatibility risks, test evidence, rollout order, pause criteria, and rollback limits."
/human-task <migration-proposal-task-id>
/complete-human-task <migration-proposal-task-id> "Approve a synthetic parallel pilot only. Preserve v1, label all v2 Events explicitly, prohibit release decisions, and do not pause v1 until consumer evidence is recorded." --as "Studio Decision Owner"
/human-task <migration-proposal-task-id>
```

Replace `<migration-proposal-task-id>` with the ID returned by `/create-human-task`.

This Human Task is not a first-class migration plan and is not automatically linked to later Functions, Events, Tasks, or Runtime transitions.

## 2. Add a successor instead of mutating v1

The current CLI cannot change a Function Objective, rename a Function, or create a version of one. Use an explicitly named successor for the rehearsal:

```text
/function create "Accessibility Review v2 Function" --enterprise "Harbour Studio Sandbox" --objective "Review version-labelled synthetic draft resources for accessibility barriers while preserving declared evidence status and unresolved user-evidence needs."
/function inspect "Accessibility Review v2 Function"
/function list
```

This is additive coexistence, not formal Function versioning. Arturo has no relationship declaring that v2 succeeds v1.

Add a distinct Worker capability so v2 routing can be observed independently:

```text
/add-ai-worker "Studio Accessibility v2 Analyst" --archetype analyst
/workers
/workers inspect "Studio Accessibility v2 Reviewer"
```

The Worker remains in the global registry. The versioned capability name is a convention, not an enforced contract or Enterprise ownership boundary.

## 3. Add v2 Governance before v2 work

```text
/governance policy add "Studio accessibility v2 review requires approval" --effect require-approval --capability "analysis"
/governance policy inspect "Studio accessibility v2 review requires approval"
```

This policy gates Tasks requiring the new capability. It does not validate `artifact_version`, `evidence_status`, schema compatibility, producer identity, or consumer version.

## 4. Start v2 in parallel

```text
/function start "Accessibility Review v2 Function"
/function inspect "Accessibility Review Function"
/function inspect "Accessibility Review v2 Function"
/function list
```

Both Runtimes are now visible. Parallel operation does not automatically mean they consume separate Event versions: every running Runtime in the named Enterprise may evaluate any published free-text Event.

## 5. Exercise direct v1 and v2 Tasks

Run bounded synthetic work through each explicit capability:

```text
/task-cap --capability review --bounded-task "V1 rehearsal: review the fictional instruction 'Click the green button' and identify accessibility questions. Do not claim conformance."

/task-cap --capability analysis --bounded-task "V2 rehearsal: artifact_version=guide-2.0-draft; evidence_status=synthetic-unverified. Analyze the fictional instruction 'Choose Continue' and preserve those fields in the response. Do not claim conformance."
/approvals
```

Depending on the v1 policy retained from Chapter 30, one or both Tasks may await approval. Use the IDs Arturo returns:

```text
/approve <v2-task-id>
/approval-status <v2-task-id>
/task inspect <v1-task-id>
/task inspect <v2-task-id>
```

If the v1 Task is also awaiting approval, approve it separately with `/approve <v1-task-id>`. Do not approve an ID that is not awaiting approval. Pre-execution approval lets the Task run; it is not validation of the returned content.

Compare:

- selected Worker and routing reason;
- required capability;
- whether the requested version labels survived in output;
- provenance and external-tool status;
- unsupported claims;
- token usage;
- failure or retry behavior; and
- whether either result could be confused with the other.

The model may omit or alter version labels because Arturo does not enforce a response schema.

## 6. Rehearse labelled Event coexistence

Publish two distinct synthetic labels rather than silently changing one label's meaning:

```text
/event publish "Accessibility Review Requested v1 — synthetic guide" --source "Resource Design Function" --enterprise "Harbour Studio Sandbox"

/event publish "Accessibility Review Requested v2 — artifact guide-2.0-draft — evidence synthetic-unverified" --source "Resource Design Function" --enterprise "Harbour Studio Sandbox"
/events
/tasks
/timeline
```

This is only a naming convention. Arturo does not parse or validate a version, preserve structured fields, subscribe a Runtime to one version, prevent v1 from reacting to v2, or prevent v2 from reacting to v1. Parallel Runtimes may create duplicate or cross-version Tasks.

That limitation is valuable to observe: safe contract migration cannot be built from labels alone.

## 7. Track consumers explicitly

The current stores do not produce a dependency graph. Maintain a migration table outside Arturo:

| Consumer or producer | Current version | v2 test evidence | Decision owner | Status |
|---|---:|---|---|---|
| Resource Design Function | v1 | v2 synthetic Event published and inspected | Studio Decision Owner | testing |
| Accessibility Review Function | v1 | must not consume v2 after cutover | Studio Decision Owner | active |
| Accessibility Review v2 Function | v2 | direct Task and Event behavior inspected | Studio Decision Owner | pilot |
| Quality Review Function | unknown | dependency assessment required | Studio Decision Owner | not assessed |
| Human release decision | manual | post-output review required | Studio Decision Owner | retained |

Do not mark a consumer migrated merely because a Task completed. Require defined acceptance evidence.

## 8. Record post-output migration review

```text
/create-human-task "Assess accessibility v2 migration evidence" "Compare v1 and v2 Tasks, Event evaluations, routing, outputs, provenance, duplication, and missing dependency evidence. Decide whether to continue parallel testing, revise v2, or pause it."
/complete-human-task <migration-review-task-id> "Continue synthetic parallel testing. Do not cut over: Event consumers are not version-isolated and response fields are not schema-enforced." --as "Studio Decision Owner"
/human-task <migration-review-task-id>
```

Create the task first and replace `<migration-review-task-id>` with the returned ID. The recorded decision does not automatically pause a Runtime or update the external migration table.

## 9. Pause safely; do not claim retirement

The following pause and resume commands are from the low-level developer
surface shown by `/help all`; they are not primary terminal commands. If the
decision is to contain v2 in a local exercise, use its Runtime ID:

```text
/function inspect "Accessibility Review v2 Function"
/pause-function <v2-runtime-id>
/function inspect "Accessibility Review v2 Function"
```

Resume it for further testing if appropriate:

```text
/resume-function <v2-runtime-id>
/function inspect "Accessibility Review v2 Function"
```

Pausing is not rollback. It does not remove the v2 definition, Worker, policy, Tasks, outputs, approvals, Events, Memory, or previous model influence.

If all external evidence eventually supports a v2 cutover, you could pause the v1 Runtime:

```text
/function inspect "Accessibility Review Function"
/pause-function <v1-runtime-id>
/function inspect "Accessibility Review Function"
```

The CLI performs no consumer check before pausing. A human must verify dependencies first. Paused is not retired, archived, or deleted.

## 10. Preserve migration evidence

Inspect everything Arturo can show:

```text
/function list
/workers
/workers
/governance policy list
/tasks
/approvals
/human-tasks
/events
/timeline
/memory
```

Then update the external ledger with:

- before and after definitions;
- conceptual v1 and v2 schemas;
- producer and consumer inventory;
- exact Task, Event, approval, Human Task, Function, Runtime, Worker, and policy IDs;
- test inputs and acceptance criteria;
- model and configuration used;
- observed outputs, failures, duplication, and ambiguity;
- data migration and privacy impact;
- rollback and containment limits;
- unresolved dependencies;
- human decisions and authority; and
- cutover, extension, or cancellation decision.

Arturo's timeline alone does not supply this complete migration record.

## Data migration is a different problem

The rehearsal above migrates behavior conceptually. Migrating persisted data is more dangerous.

Do not manually rewrite Arturo's SQLite data to simulate a migration. Tasks, Events, approvals, Memory, delegations, Human Tasks, Function definitions, Runtime state, and cross-references may have assumptions enforced in application code. A partial rewrite can produce internally inconsistent state that still appears readable.

A production data migration requires:

1. an explicit source and target schema;
2. a tested transformation;
3. backup and restore procedures;
4. validation counts and checksums;
5. referential-integrity checks;
6. idempotent or restartable execution;
7. privacy and retention review;
8. a maintenance or dual-write strategy;
9. rollback or forward-fix criteria; and
10. post-migration reconciliation.

None of these is currently orchestrated by Arturo's CLI.

## Target architecture — non-executable

The commands below describe a possible future interface. **Do not enter them in the current CLI.**

```text
# NOT IMPLEMENTED
/function contract inspect "Accessibility Review Function"

# NOT IMPLEMENTED
/function contract propose-version "Accessibility Review Function" --event "Accessibility Review Requested" --schema-file "accessibility-review-v2.json"

# NOT IMPLEMENTED
/function contract migration-status "Accessibility Review Function" --event "Accessibility Review Requested"

# NOT IMPLEMENTED
/function contract retire-version "Accessibility Review Function" --event "Accessibility Review Requested" --version v1

# NOT IMPLEMENTED
/enterprise migration create --from "Accessibility Review Function" --to "Accessibility Review v2 Function" --enterprise "Harbour Studio Sandbox"
```

A robust implementation would need more than commands. It would require versioned immutable definitions, typed schemas, compatibility rules, explicit subscriptions, dependency discovery, producer and consumer acknowledgements, migration state, deadlines, approval, rollout telemetry, refusal to retire active dependencies, rollback, and a complete change ledger.

## Compatibility rules worth enforcing

For structured contracts, classify changes mechanically:

- **Additive compatible:** add an optional field with a defined default.
- **Conditionally compatible:** add an optional field that some consumers may treat as required.
- **Breaking:** add a required field, remove or rename a field, narrow allowed values, change units, or change semantics.
- **Behaviorally breaking:** preserve the schema but change when the Event is emitted or what it means.
- **Security breaking:** expose data to a broader audience, weaken authorization, or change classification.

Schema compatibility cannot detect semantic, operational, legal, or security incompatibility on its own.

## Migration state machine

A first-class migration should have explicit states such as:

```text
draft → proposed → approved → testing → dual-running
      → ready-for-cutover → cutover → observing → complete
                         ↘ blocked
                         ↘ rolled-back-or-contained
```

Each transition should record actor, authority, evidence, timestamp, affected dependencies, and permitted next states. `complete` should be impossible while required consumers remain unverified.

## Current implementation boundaries

Arturo currently does **not** provide:

- Function, Objective, Event, delegation, policy, Worker, Memory, or data-schema versions;
- typed Event payloads or schema validation;
- explicit Event subscriptions or consumer-version selection;
- contract compatibility classification;
- producer, consumer, or dependency discovery;
- migration objects, states, owners, deadlines, acknowledgements, or dashboards;
- dual-write or dual-publish orchestration;
- canary, percentage, environment, or cohort rollout controls;
- cutover, drain, replay, cancellation, retirement, successor, archive, or deletion workflows;
- database migration planning, execution, validation, reconciliation, backup, restore, or rollback;
- automatic refusal to pause or stop a Runtime with active dependents; or
- a complete, tamper-evident migration audit record.

## Common mistakes

**Typing target syntax as though it exists.** `/function contract` and `/enterprise migration` are not current commands.

**Changing a free-text Event in place.** The same label can conceal incompatible meaning.

**Calling parallel Functions formal versions.** Their relationship is a human convention until Arturo models it.

**Assuming dual-running isolates consumers.** Current running Runtimes in the Enterprise can evaluate both free-text Event labels.

**Treating a completed Task as migration evidence by itself.** Completion does not prove compatibility, correctness, or consumer readiness.

**Pausing v1 without a dependency inventory.** Arturo will not stop you from breaking an unrecorded consumer.

**Calling pause rollback or retirement.** State changes do not undo persistent effects or establish archival status.

**Migrating the database manually.** Application-level invariants can be broken even when tables remain readable.

**Leaving both versions forever.** Indefinite duplication creates ambiguity and operational cost; a governed resolution is still required.

**Removing old Governance too early.** A policy can still protect old-version Tasks during a transition.

## Design challenge

Using synthetic input only:

1. Choose one Event, delegation request, or Function boundary that needs a breaking change.
2. Write explicit conceptual v1 and v2 contracts.
3. Record migration invariants and a Human Task proposal.
4. Add a distinctly named successor Function and capability without modifying v1.
5. Add Governance before v2 work.
6. Run direct v1 and v2 Tasks and compare routing, output, provenance, and failure behavior.
7. Publish explicitly labelled v1 and v2 Events and inspect every Runtime evaluation.
8. Build an external producer and consumer inventory.
9. Record a post-output human migration decision.
10. Rehearse pause and resume without calling either rollback or retirement.
11. List the structured data, compatibility, dependency, and audit features still required.

## Chapter summary

Current Arturo can rehearse a cautious parallel-successor pattern:

```text
baseline → proposal → additive v2 → separate capability and policy
         → parallel synthetic tests → external dependency evidence
         → human decision → pause, continue, or contain
```

It cannot yet guarantee a migration. Safe versioning requires machine-readable contracts, explicit dependencies, compatibility rules, governed state transitions, verified cutover evidence, retirement guards, and rollback or containment designed before change begins.

## Looking ahead

Chapter 32 explores Enterprise Simulation. As with versioning, the crucial question will be whether Arturo is executing an isolated predictive model or merely asking an LLM to describe a hypothetical scenario.
