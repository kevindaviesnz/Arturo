# Chapter 33 — Digital Twins

> **Note:** Current Arturo can review a supplied snapshot. It
> does not keep a live, synchronized copy of a company or physical machine.

*A dashboard is not a twin, a model summary is not synchronized state, and a hypothetical answer is not a prediction.*

## Current versus target architecture

The current Arturo CLI has no `/twin` command, Twin entity, synchronization engine, external-system connector, typed state model, timestamp reconciliation, fidelity measurement, drift alarm, isolated what-if branch, or twin-to-live control boundary.

What Arturo can currently do is narrower:

- display persisted Enterprise, Function, Runtime, Worker, Task, Governance, Memory, Event, delegation, approval, and Human Task records;
- compute limited operational Health from Arturo's own evidence;
- let an Observer or Analyst Worker discuss a supplied snapshot; and
- preserve the resulting Task and Human Task records.

This chapter calls that a **snapshot review**, never a Digital Twin.

Use only fictional or non-sensitive information.

## Starting state

Chapters 36–38 evolved `Harbour Studio Sandbox`, rehearsed a v2 migration, and ran tabletop scenarios. Chapter 33 asks whether Arturo now holds a continuously synchronized representation of that Enterprise.

It does not.

Inspect what Arturo actually knows:

```text
/overview
/enterprise inspect "Harbour Studio Sandbox"
/function list
/workers
/tasks
/governance policy list
/approvals
/human-tasks
/delegation list
/memory
/events
/timeline
```

These commands query several Arturo stores. They do not produce one atomic snapshot taken at a single instant. State may change between commands.

## What a Digital Twin must identify

Every credible twin needs an explicit answer to five questions.

### 1. What is the referent?

The referent is the real thing represented by the twin:

- an Enterprise configuration;
- a production line;
- a building;
- a supply network;
- a customer-service operation; or
- another bounded system.

“The whole organization” is usually too vague. Define ownership and boundary precisely.

### 2. Which state is mirrored?

Examples include:

- organizational definitions and Runtime states;
- queues and resource capacity;
- physical measurements;
- financial balances;
- product and order state;
- policy versions; or
- external dependencies.

Current Arturo records only its own application concepts. It does not automatically mirror external operational or physical state.

### 3. Which system is authoritative for each field?

Arturo's Event log is not automatically the source of truth. A ledger may be authoritative for a payment, an MES for a work order, an identity provider for a user, an EHR for a clinical record, or a repository for an artifact version.

A twin needs field-level source ownership and conflict resolution. “Latest Event wins” is unsafe when sources have different authority.

### 4. How fresh and complete is the representation?

A twin must expose:

- source timestamp;
- ingestion timestamp;
- processing timestamp;
- expected update frequency;
- observed lag;
- missed or duplicate update status;
- completeness; and
- last successful reconciliation.

Without these, “synchronized” is an unsupported claim.

### 5. What may the twin do?

An analytical twin can be read-only. A control twin may influence the referent, which creates a much higher safety and authorization burden.

Current Arturo snapshot analysis must remain advisory. Worker chat is read-only, and no chapter should imply that a twin can apply a change, operate equipment, move money, contact people, or authorize release.

## Snapshot review: the supported exercise

The walkthrough below creates a timestamped, fictional summary for critical review. It does not clone or synchronize Arturo state.

## 1. Define the snapshot contract externally

Use a small schema in your design notes:

```json
{
  "snapshot_id": "studio-snapshot-001",
  "captured_at": "<record-the-actual-time>",
  "enterprise": "Harbour Studio Sandbox",
  "source_commands": [
    "/enterprise inspect",
    "/function list",
    "/workers",
    "/tasks",
    "/approvals",
    "/human-tasks"
  ],
  "declared_values": {
    "functions": "<copy-observed-count>",
    "workers": "<copy-observed-count>",
    "jobs": "<copy-observed-count>",
    "pending_approvals": "<copy-observed-count>"
  },
  "known_non_atomic": true
}
```

Do not invent counts. Copy what the commands display and preserve the capture time. The schema remains an external artifact; Arturo does not validate or store it as a Snapshot entity.

## 2. Record authorization for snapshot analysis

```text
/create-human-task "Review studio snapshot exercise" "Confirm that the proposed snapshot uses non-sensitive Arturo metadata, is explicitly non-atomic, cannot control live state, and will be used only to identify missing evidence and freshness risks."
/complete-human-task <snapshot-proposal-task-id> "Approved as a read-only snapshot review. Do not call it a Digital Twin or use it to authorize configuration changes." --as "Studio Decision Owner"
/human-task <snapshot-proposal-task-id>
```

Create the task first and substitute the returned ID.

## 3. Add a bounded observation capability

```text
/function create "Operational Snapshot Review Function" --enterprise "Harbour Studio Sandbox" --objective "Review supplied, timestamped, non-sensitive organizational snapshots for incompleteness, staleness, contradictions, and unsupported conclusions."

/add-ai-worker "Studio Snapshot Observer" --archetype observer
/workers inspect "Studio Snapshot Observer"
/workers
```

The Function and Worker organize review. They do not subscribe to a state stream or become a Twin.

Starting a Runtime is optional for direct Tasks, but useful if you want the Function represented operationally:

```text
/function start "Operational Snapshot Review Function"
/function inspect "Operational Snapshot Review Function"
```

Do not publish fake synchronization Events merely to make the Runtime appear live.

## 4. Review the supplied snapshot

Replace the angle-bracket values with the counts and timestamp you actually observed:

```text
/task-cap --capability monitoring --bounded-task "Review this non-atomic snapshot only: snapshot_id=studio-snapshot-001; captured_at=<actual-time>; functions=<count>; workers=<count>; jobs=<count>; pending_approvals=<count>. Source commands were run sequentially. Identify missing state, possible contradictions, freshness limits, authoritative-source questions, and conclusions that cannot be drawn. Do not call it synchronized or predict outcomes."
/task inspect <snapshot-task-id>
```

The Worker receives only the text in the Task plus normal Arturo context available to its execution path. It is not automatically given a consistent database export. Its response is unverified model synthesis.

## 5. Measure freshness manually

After a defined interval, rerun the relevant commands:

```text
/overview
/function list
/workers
/tasks
/approvals
/human-tasks
```

Create a second external snapshot with a new timestamp. Compare A and B explicitly:

```text
snapshot_age = comparison_time - captured_at
observed_job_delta = snapshot_b.jobs - snapshot_a.jobs
observed_pending_approval_delta = snapshot_b.pending_approvals - snapshot_a.pending_approvals
```

These calculations describe observed metadata changes. They do not identify every intervening transition or prove that the stores were mutually consistent at either timestamp.

Ask the Observer to critique the comparison, supplying actual sanitized values:

```text
/task-cap --capability monitoring --bounded-task "Compare snapshot A and B using only these supplied values: A captured_at=<time-a>, jobs=<a-jobs>, approvals=<a-approvals>; B captured_at=<time-b>, jobs=<b-jobs>, approvals=<b-approvals>. Separate arithmetic differences from explanations, list missing transitions, and do not infer causality."
/task inspect <comparison-task-id>
```

## 6. Reconcile against Arturo records

Use IDs rather than counts when investigating a discrepancy:

```text
/task inspect <task-id>
/approval-status <task-id>
/human-task <human-task-id>
/delegation inspect <delegation-id>
/function inspect "Operational Snapshot Review Function"
/events
/timeline
```

The timeline may explain some transitions, but it is not a complete configuration change ledger and does not include authoritative external-system state.

Record reconciliation results externally:

| Field | Snapshot value | Current value | Authoritative source | Explanation | Resolved? |
|---|---|---|---|---|---|
| Task status | supplied value | `/task` output | Arturo Task store | inspect Event sequence | yes/no |
| Approval status | supplied value | `/approval-status` | Arturo approval store | inspect decision | yes/no |
| External publication | unknown | unknown | external publishing system | Arturo has no integration | no |

## 7. Challenge fidelity through Worker chat

```text
/chat "Studio Snapshot Observer" "Based only on recorded Arturo Tasks, explain why this snapshot review is not a Digital Twin. List synchronization, fidelity, authority, external-state, and control-boundary evidence that is missing."
/chat history "Studio Snapshot Observer"
```

Worker chat is read-only, unverified model conversation. It does not refresh the snapshot or query external systems.

## 8. Record the human conclusion

```text
/create-human-task "Assess snapshot fidelity" "Review both snapshots, reconciliation results, Observer outputs, and missing external sources. Decide what claims may be made and whether any operational decision may rely on the snapshot."
/complete-human-task <snapshot-review-task-id> "Describe this as a manual Arturo metadata snapshot only. Do not claim synchronization, completeness, external-state fidelity, prediction, or authority for operational action." --as "Studio Decision Owner"
/human-task <snapshot-review-task-id>
/timeline
```

The Human Task records a conclusion. It does not certify the snapshot or alter permissions.

## Why `/overview` is not a Digital Twin

`/overview` is valuable operational visibility, but it is not a Twin because it does not provide:

- an explicit referent model;
- one atomic capture across all state;
- external authoritative sources;
- typed state with measurement semantics;
- per-field timestamps and quality;
- synchronization guarantees;
- completeness and drift metrics;
- historical state reconstruction;
- isolated what-if execution; or
- validated predictive fidelity.

The same applies to the live footer. Counts and model/token labels are status indicators, not a living replica of the Enterprise.

## Why Events alone do not create a Twin

An Event-driven architecture can feed a Twin, but only if the Event system supplies appropriate guarantees and coverage. A credible implementation needs:

- typed, versioned Event schemas;
- stable entity identity;
- source authority;
- ordering rules;
- deduplication and idempotency;
- replay and checkpoints;
- late and out-of-order handling;
- deletion and correction semantics;
- completeness monitoring;
- reconciliation with authoritative state; and
- access and purpose controls.

Current Arturo Events are useful operational records, but free-text organizational Events and internal Runtime Events do not establish all those properties.

Publishing an Event also changes the live Arturo record and may prompt running Runtimes to create Tasks. It is not a safe Twin synchronization test.

## Fidelity dimensions

A Twin should report fidelity across several dimensions rather than one vague status:

### Structural fidelity

Does it contain the right entities and relationships?

### State fidelity

Do mirrored values match authoritative sources within declared tolerance?

### Temporal fidelity

Is update lag acceptable for the intended decision?

### Behavioral fidelity

Does the model respond to inputs like the referent under tested conditions?

### Statistical fidelity

Do distributions, correlations, and rare events resemble observed evidence?

### Decision fidelity

Would a decision based on the Twin remain safe when applied to the referent?

### Security and privacy fidelity

Does the Twin preserve classification, authorization, consent, and purpose constraints rather than creating a broader copy?

A Twin can be adequate for one use and dangerously inadequate for another. A five-minute lag might be fine for capacity planning and unacceptable for protective control.

## Twin drift and reconciliation

Drift occurs when the representation and referent diverge. Causes include:

- missed, duplicated, late, or reordered updates;
- connector failure;
- schema change;
- clock skew;
- manual changes outside integrated systems;
- stale reference data;
- identifier mismatch;
- deletion or correction not propagated;
- model parameter drift; and
- changed real-world behavior.

A real Twin needs periodic reconciliation against authoritative snapshots, not confidence that the Event stream “probably worked.” Drift thresholds should be tied to permitted uses and should fail closed for consequential action.

## Enterprise twins versus physical twins

An Enterprise twin models organizational state and behavior. A physical twin may model geometry, forces, wear, temperature, control state, and failure modes.

Arturo supports neither as a first-class Twin. In particular, it has no sensor, robot, equipment, or PLC Worker types and no real-time industrial integration. Never interpret Runtime Health or an Observer response as machine condition or permission to operate equipment.

## Ecosystem twins and organizational boundaries

The current CLI does not support cross-Enterprise delegation or an ecosystem Twin. Enterprise records are not isolated tenants, and global Workers can match capabilities across organizational names.

A future ecosystem Twin must not become a surveillance backdoor. Each participant needs:

- explicit data-sharing authority;
- purpose and field-level scope;
- independent source ownership;
- disclosure and access records;
- revocation and correction;
- retention and deletion rules;
- confidentiality and commercial boundaries;
- aggregated or privacy-preserving alternatives; and
- governance over derived inferences.

“Shared for the Twin” is not a lawful or contractual basis by itself.

## Twin-to-live control

A read-only analytical Twin and a control Twin must be separate trust classes.

Before a Twin can influence a real system, require:

1. authenticated actor and system identity;
2. least-privilege command authorization;
3. deterministic safety constraints;
4. post-output human approval where appropriate;
5. simulation and staged validation;
6. rate, scope, and time limits;
7. independent interlocks;
8. command acknowledgement and outcome verification;
9. emergency stop and manual override;
10. complete audit and incident response; and
11. safe behavior when the Twin is stale, unavailable, or wrong.

Current Arturo's Worker chat and Simulator output perform no external action. Keep that boundary.

## Model and cost considerations

Continuously synchronizing and exploring a Twin can be expensive. Current Arturo does not implement:

- change-aware incremental model invocation;
- automatic free-local-first routing;
- uncertainty-triggered paid-model escalation;
- per-Twin token or monetary budgets;
- provider billing reconciliation;
- sampling and summarization guarantees; or
- storage and compute lifecycle policies.

The session-token footer is observability, not a hard budget. A production design should avoid invoking an LLM for deterministic synchronization work that ordinary code can perform more cheaply and reliably.

## Target architecture — non-executable

The following commands illustrate a possible future interface. **Do not enter them in the current CLI.**

```text
# NOT IMPLEMENTED
/twin create --enterprise "Harbour Studio Sandbox" --mode read-only --sources "arturo,artifact-repository"

# NOT IMPLEMENTED
/twin inspect <twin-id> --show-freshness --show-fidelity --show-drift

# NOT IMPLEMENTED
/twin reconcile <twin-id> --against-authoritative-sources

# NOT IMPLEMENTED
/twin explore <twin-id> --proposal "Accessibility Review v2" --isolated

# NOT IMPLEMENTED
/twin permissions <twin-id>

# NOT IMPLEMENTED
/twin pause-sync <twin-id>

# NOT IMPLEMENTED
/twin destroy <twin-id> --retention-policy <policy-id>
```

Command syntax is the smallest part of the implementation. The hard work is identity, sources, synchronization, fidelity, isolation, governance, reconciliation, and safe failure.

## Current implementation boundaries

Arturo currently does **not** provide:

- a Twin entity, referent, schema, lifecycle, owner, or permissions model;
- atomic Enterprise snapshots or historical point-in-time reconstruction;
- external source connectors, field-level authority, synchronization, checkpoints, or reconciliation;
- freshness, completeness, quality, fidelity, lag, drift, or divergence measures;
- versioned Event schemas, replay guarantees, ordering, or consumer offsets;
- isolated exploration, executable behavioral models, validation, calibration, or prediction accuracy;
- ecosystem Twin participation, cross-Enterprise sharing contracts, or privacy-preserving federation;
- physical models, sensors, industrial protocols, control interfaces, safety interlocks, or real-time guarantees;
- twin-to-live action authorization or outcome verification; or
- Twin-specific budgets, retention, export, destruction, incident response, or audit assurance.

## Common mistakes

**Calling `/overview` a Digital Twin.** It is an operational summary of selected Arturo records.

**Calling an Observer summary synchronized state.** The Worker only interprets supplied context.

**Treating Events as complete truth.** External authoritative sources and unrecorded activity may differ.

**Ignoring capture time.** A state value without source and ingestion timestamps has unknown freshness.

**Using free-text labels as entity identity.** Names can collide or change; identity mapping must be explicit.

**Treating a Twin exploration as prediction.** Fidelity must be measured for the intended use.

**Allowing the Twin to write back by default.** Analytical representation and control authority should be separated.

**Copying partner or personal data into an ecosystem Twin.** Derived visibility can violate legal, contractual, and ethical boundaries.

**Invoking an LLM for deterministic synchronization.** It adds cost and uncertainty where code and schemas are appropriate.

**Failing open when stale.** Consequential uses must be blocked when freshness or fidelity falls below their declared threshold.

## Design challenge

Using fictional, non-sensitive information only:

1. Define a bounded referent and intended Twin use.
2. List every mirrored field, authoritative source, unit, update frequency, and permitted lag.
3. Create two manual Arturo metadata snapshots and label them non-atomic.
4. Register a uniquely routed Observer and critique the snapshots without calling them a Twin.
5. Reconcile one discrepancy using IDs and source-specific commands.
6. Define structural, state, temporal, behavioral, statistical, decision, and security fidelity criteria.
7. Specify drift detection and reconciliation.
8. Define what remains invisible at Enterprise and ecosystem boundaries.
9. Prohibit twin-to-live action unless an independent control architecture is designed.
10. Record the human conclusion about which claims the current snapshot can support.
11. Identify cost controls and deterministic work that should not use an LLM.

## Chapter summary

Current Arturo supports a modest snapshot-review pattern:

```text
inspect stores → record timestamped non-atomic snapshot → bounded Observer review
               → capture again → calculate differences → reconcile by ID
               → human statement of supported and prohibited claims
```

A Digital Twin requires much more:

```text
bounded referent + authoritative sources + typed state + synchronization
                  + freshness and fidelity + reconciliation + isolation
                  + governance + safe failure + measured permitted uses
```

The right question is not “Do we have a Twin?” It is “For which decision, against which authoritative state, at what freshness and measured fidelity, under whose authority, with what failure behavior?”

## Looking ahead

Chapter 34 explores Enterprise Optimisation. Optimization must not act on a stale snapshot, a low-fidelity Twin, or a model-generated objective without explicit constraints and human accountability.
