# Chapter 32 — Enterprise Simulation

> **Note:** Current Arturo can compare made-up scenarios. It is
> not a simulation engine and cannot predict what will really happen.

*A model describing a hypothetical future is a tabletop exercise, not a validated enterprise simulation.*

## Current versus target architecture

The current Arturo CLI has no `/simulation` command, isolated Enterprise branch, historical Event replay engine, deterministic policy evaluator, synthetic-data generator, Monte Carlo runner, discrete-event model, calibration framework, or simulation-result store.

Arturo does have a `simulator` Worker archetype. It can generate explicitly hypothetical model output using the `simulation` capability. That is useful for surfacing assumptions and questions, but it does not predict what the Enterprise will do.

This chapter teaches both:

1. a supported, synthetic tabletop scenario exercise; and
2. the requirements for a genuine future simulation subsystem.

Use only fictional, non-sensitive inputs.

## Starting state

Chapter 31 rehearsed a migration from `Accessibility Review Function` to a parallel `Accessibility Review v2 Function`. The unresolved decision was whether v2 should continue, be revised, or be contained.

Before a scenario exercise, inspect the actual state rather than asking a model to invent it:

```text
/enterprise inspect "Harbour Studio Sandbox"
/function list
/workers
/tasks
/approvals
/human-tasks
/events
/timeline
```

Record a sanitized baseline outside Arturo. Do not paste the entire Event history into a prompt. It may contain model outputs, internal identifiers, human decisions, or other information unsuitable for reuse.

## Simulation, scenario analysis, and prediction

These terms must remain distinct:

| Activity | What it does | Current Arturo support |
|---|---|---|
| Tabletop scenario | Uses stated assumptions to reason about plausible consequences | Supported as unverified model synthesis |
| Deterministic calculation | Produces reproducible outputs from explicit formulas and inputs | Not a first-class Arturo engine |
| Discrete-event simulation | Models queues, resources, timing, and state transitions | Not implemented |
| Monte Carlo simulation | Repeats a quantitative model over probability distributions | Not implemented |
| Agent-based simulation | Models interacting actors with defined behavior rules | Not implemented |
| Historical replay | Re-evaluates recorded inputs against an isolated proposed configuration | Not implemented |
| Digital twin | Maintains a validated, synchronized representation of a live system | Not implemented; Chapter 33 |
| Prediction | Estimates an unknown future outcome with measured performance | Not established by an LLM scenario response |

Calling all of these “simulation” conceals material differences in evidence and reliability.

## 1. Define the decision before the scenario

The decision in this walkthrough is:

> Should `Accessibility Review v2 Function` proceed to a longer synthetic pilot, be revised first, or be paused?

Define decision criteria before seeing model output:

- no autonomous release decision;
- explicit artifact and evidence-status labels retained;
- no cross-version routing ambiguity accepted as safe;
- no claim of accessibility conformance;
- no sensitive data;
- human post-output decision retained;
- acceptable Task duplication defined externally; and
- containment possible by pausing the v2 Runtime.

Precommitting criteria reduces the temptation to reinterpret success after receiving a persuasive response.

## 2. Record the scenario proposal

```text
/create-human-task "Approve synthetic v2 scenario exercise" "Review the proposed tabletop exercise comparing continued v1 operation, parallel v1/v2 operation, and paused v2. Confirm that it uses fictional inputs, performs no configuration mutation, and cannot authorize cutover."
/complete-human-task <scenario-proposal-task-id> "Approved as a tabletop exercise only. Use explicit assumptions, label all outputs unverified, and return the final migration decision to a human." --as "Studio Decision Owner"
/human-task <scenario-proposal-task-id>
```

Create the task first and replace `<scenario-proposal-task-id>` with the returned ID. The decision records authorization to run model Tasks; it does not create an isolated environment.

## 3. Add a bounded Simulator Worker

Use a distinct capability so routing is visible:

```text
/add-ai-worker "Studio Evolution Simulator" --archetype simulator
/workers inspect "Studio Evolution Simulator"
/workers
```

The Worker is global, not owned by `Harbour Studio Sandbox`. Its archetype guardrails require it to state assumptions and avoid presenting simulations as predictions. Guardrails reduce risk; they do not mathematically validate output.

## 4. Supply a controlled scenario packet

A useful scenario prompt contains only declared facts and clearly marked assumptions. For this exercise:

```text
Declared fictional facts:
- v1 and v2 Functions both exist.
- v1 uses the standard `review` capability.
- v2 uses the standard `analysis` capability for this teaching comparison.
- v2 Task execution requires pre-execution approval.
- Event payloads are free text and not schema-validated.
- running Runtimes in the Enterprise can evaluate both labelled Events.
- a human owns any release or migration decision.

Assumptions for discussion, not observed evidence:
- 20 synthetic review requests arrive per week.
- 25% are ambiguously labelled.
- each duplicate review consumes one additional model run.
- a human can review at most 10 migration exceptions per week.
```

Do not present invented volumes or percentages as historical facts.

## 5. Run three tabletop scenarios

### Scenario A: keep v1 only

```text
/task-cap --capability simulation --bounded-task "TABLETOP SCENARIO A. Declared facts: v1 and v2 Functions exist; Events are free text; a human owns release. Assumptions: 20 synthetic requests per week, 25 percent ambiguously labelled, human capacity 10 exceptions per week. Analyze keeping v1 active and pausing v2. Output assumptions, plausible benefits, plausible failures, evidence needed, leading indicators, containment options, and unknowns. Do not calculate invented precision or recommend cutover."
/task inspect <scenario-a-task-id>
```

### Scenario B: parallel operation

```text
/task-cap --capability simulation --bounded-task "TABLETOP SCENARIO B. Use the same declared facts and assumptions as Scenario A. Analyze keeping v1 and v2 Runtimes active in parallel when both may evaluate free-text Events. Output assumptions, plausible duplication and routing risks, evidence needed, leading indicators, containment options, and unknowns. Do not present this as prediction."
/task inspect <scenario-b-task-id>
```

### Scenario C: v2 only

```text
/task-cap --capability simulation --bounded-task "TABLETOP SCENARIO C. Use the same declared facts and assumptions as Scenario A. Analyze pausing v1 and continuing v2 before Event schemas or dependency discovery exist. Output assumptions, plausible benefits, broken-consumer risks, evidence needed, leading indicators, containment options, and unknowns. Do not recommend cutover."
/task inspect <scenario-c-task-id>
```

Replace each placeholder with the returned Task ID. All three Tasks run in Arturo's live persistent Task store. They do not run in a cloned Enterprise, and their outputs are unverified model synthesis.

The Simulator may produce inconsistent structure, arithmetic, or conclusions across runs. Repeating the same prompt is not a controlled Monte Carlo experiment; variation reflects model sampling and context, not a declared probability distribution.

## 6. Compare without inventing a score

Build an external comparison table from the actual outputs:

| Criterion | Scenario A | Scenario B | Scenario C | Evidence quality |
|---|---|---|---|---|
| Version-label preservation | inspect output | inspect output | inspect output | model synthesis only |
| Duplicate Task exposure | plausible discussion | plausible discussion | plausible discussion | not measured |
| Consumer breakage | plausible discussion | plausible discussion | plausible discussion | dependencies unknown |
| Human exception load | assumption-based | assumption-based | assumption-based | no queue model |
| Containment | pause v2 | pause one Runtime | resume v1 if still viable | not tested as rollback |
| Accessibility outcome | unknown | unknown | unknown | no user evidence |

Do not turn qualitative language such as “low risk” into a number unless a defined, validated method produces that number.

## 7. Challenge the Simulator

Ask a read-only follow-up that attacks the assumptions:

```text
/chat "Studio Evolution Simulator" "Challenge the scenario assumptions recorded in your Arturo Tasks. Identify omitted stakeholders, feedback loops, capacity constraints, security boundaries, rare events, and evidence that could reverse each apparent conclusion."
/chat history "Studio Evolution Simulator"
```

Worker chat can continue from a bare `yes` while that Worker is the active process-local conversation. It still cannot execute a configuration change, publish an Event, or contact anyone, and its response remains unverified model output. Use `/chat status` to inspect the active recipient and `/chat end` before returning to plain-English objective input.

## 8. Add deterministic calculations separately

The declared assumptions permit simple arithmetic:

```text
20 requests/week × 25% ambiguous = 5 ambiguous requests/week
```

That calculation is reproducible, but the inputs are fictional. It does not prove five duplicates will occur.

For a genuine quantitative model, define outside Arturo:

- variables and units;
- formulas or transition rules;
- initial state;
- distributions and correlations;
- queue and resource behavior;
- time step and duration;
- random seed;
- number of replications;
- warm-up and termination rules;
- confidence intervals;
- calibration dataset;
- validation tests; and
- sensitivity and uncertainty analysis.

An LLM should not silently invent these choices.

## 9. Do not publish simulation Events into live Runtimes

Avoid using `/event publish` to “replay” historical or synthetic scenarios in the current Enterprise. Published Events are real Arturo records and running Runtimes may evaluate them and create real persistent Tasks.

The current CLI provides no dry-run flag, isolated Event bus, simulation namespace, transactional rollback, or automatic cleanup. Direct Simulator Tasks are safer for this chapter because they do not pretend to replay Runtime behavior.

Even direct Tasks are not ephemeral: they remain in `/tasks` and `/timeline`.

## 10. Record the human decision

After comparing the three outputs and external evidence, create a separate decision task:

```text
/create-human-task "Decide accessibility v2 pilot state" "Review Scenario A, B, and C outputs, their assumptions, the external comparison table, and known evidence gaps. Decide whether to continue, revise, or pause v2. Model output cannot make this decision."
/complete-human-task <scenario-decision-task-id> "Revise before further pilot. Define versioned Event handling and consumer evidence externally; keep v1 available and pause v2 if duplicate Tasks continue." --as "Studio Decision Owner"
/human-task <scenario-decision-task-id>
/timeline
```

Replace `<scenario-decision-task-id>` with the returned ID. The Human Task records the response but does not pause a Runtime automatically.

If the human directs containment, apply it explicitly using the v2 Runtime ID:

`/pause-function` is a low-level developer command shown by `/help all`, not a
primary terminal command.

```text
/function inspect "Accessibility Review v2 Function"
/pause-function <v2-runtime-id>
/function inspect "Accessibility Review v2 Function"
```

This is operational containment, not rollback of the Tasks and outputs already created.

## 11. Preserve a scenario evidence packet

The external packet should contain:

- decision being explored;
- accountable owner;
- baseline timestamp and IDs;
- declared facts and their sources;
- assumptions, units, ranges, and owners;
- scenarios and exclusions;
- exact prompts, Worker, model, configuration, and Task IDs;
- raw model outputs and provenance labels;
- deterministic calculations and code, if any;
- validation and calibration evidence;
- sensitivity results;
- known missing data and rare events;
- privacy and security review;
- human interpretation and dissent;
- final decision and permitted actions; and
- monitoring and containment plan.

Arturo's timeline does not assemble or validate this packet.

## What a real simulation engine requires

### Isolation

- cloned, immutable baseline state;
- separate Task, Event, Memory, approval, and artifact namespaces;
- no live Workers with external-action tools;
- denied network and side effects by default;
- explicit import and export boundaries; and
- guaranteed teardown without mutating production.

### Executable models

- typed state and Event schemas;
- deterministic transition logic where required;
- explicit stochastic processes;
- resource, queue, capacity, time, and failure models;
- policy evaluation against proposed versions; and
- reproducible seeds and software environments.

### Evidence

- authorized, minimized historical data;
- synthetic-data provenance;
- calibration and holdout validation;
- ground-truth definitions;
- uncertainty and confidence reporting;
- scenario coverage; and
- model limitations.

### Governance

- who may create, run, inspect, export, and approve simulations;
- privacy and purpose constraints on historical replay;
- cost and compute budgets;
- mandatory scenarios for high-risk changes;
- result-retention rules;
- links to evolution and migration proposals; and
- a prohibition on simulation output directly authorizing live action.

### Operational assurance

- reproducibility across runs;
- capacity and performance limits;
- failure injection;
- model and software versioning;
- monitoring for divergence between simulated and observed outcomes; and
- independent review.

## Historical replay is not automatically safe

Past Events may contain personal information, secrets, model output, historical bias, unlawful decisions, or conditions no longer applicable. Replaying them can:

- expose information to new Workers or models;
- reproduce discriminatory patterns;
- mistake policy violations for normal behavior;
- omit unrecorded real-world outcomes;
- overweight frequent events and miss rare severe ones; or
- leak live identifiers into a test environment.

Historical data requires authorization, minimization, transformation, access control, retention, and documented fitness for purpose. “It is already in the Event log” is not sufficient authority to reuse it.

## Model and cost considerations

The Simulator Worker uses its configured model. Arturo does not currently:

- choose the cheapest adequate model automatically;
- escalate to a paid model based on uncertainty;
- compare multiple providers independently;
- enforce a per-simulation token or monetary budget;
- cache equivalent runs as validated experiments; or
- reconcile provider invoices.

The footer's session-token count is useful observability but not a cost ceiling. A production simulation service needs explicit budgets, concurrency limits, termination conditions, and approval for paid or sensitive external processing.

## Target architecture — non-executable

The following illustrates a possible future interface. **Do not enter these commands in the current CLI.**

```text
# NOT IMPLEMENTED
/simulation create --based-on "Harbour Studio Sandbox" --proposal "Accessibility Review v2" --data-source "authorized-synthetic-fixture"

# NOT IMPLEMENTED
/simulation inspect <simulation-id>

# NOT IMPLEMENTED
/simulation run <simulation-id> --seed 42017 --replications 1000 --budget "NZD 25"

# NOT IMPLEMENTED
/simulation compare <baseline-run-id> <proposal-run-id>

# NOT IMPLEMENTED
/simulation promote-evidence <run-id> --to-change-proposal <proposal-id>

# NOT IMPLEMENTED
/simulation destroy <simulation-id>
```

A genuine implementation must enforce the isolation, evidence, governance, reproducibility, and cost properties described above; command names alone provide none of them.

## Current implementation boundaries

Arturo currently does **not** provide:

- a Simulation entity, run, branch, namespace, lifecycle, or result schema;
- cloned Enterprise state or isolation from live stores;
- historical Event replay or synthetic Event generation;
- configurable clocks, queues, resources, agents, formulas, distributions, seeds, or replications;
- deterministic policy comparison or proposed-configuration execution;
- calibration, validation, sensitivity analysis, confidence intervals, or accuracy measurement;
- scenario coverage, rare-event generation, failure injection, or counterfactual identification;
- simulation-specific privacy controls, budgets, access control, artifact storage, or cleanup;
- links from simulation evidence to change proposals or migration objects; or
- authority for model output to approve or apply live changes.

## Common mistakes

**Calling Simulator prose a prediction.** It is a hypothetical interpretation of supplied text.

**Inventing precise numbers.** Precision without a model and evidence creates false confidence.

**Publishing test Events into live Runtimes.** Current Event publication is not dry-run replay.

**Treating repeated prompts as Monte Carlo simulation.** Model sampling is not a declared probability model.

**Using historical Events without new authorization.** Reuse can create privacy, security, legal, and bias risks.

**Comparing scenarios with criteria chosen afterward.** Post-hoc scoring invites confirmation bias.

**Ignoring feedback loops.** A policy changes behavior, which changes future data; static replay may miss that response.

**Treating a clean simulation as safety proof.** Unmodeled conditions remain untested.

**Allowing simulation output to mutate production.** Evidence should inform an authorized human decision, not bypass it.

**Forgetting cost.** Large scenario sets can consume substantial local compute or paid-model tokens.

## Design challenge

Using fictional inputs only:

1. Define one Enterprise decision and precommit decision criteria.
2. Separate declared facts, assumptions, unknowns, and prohibited claims.
3. Record a Human Task authorizing a tabletop exercise only.
4. Register a uniquely routed Simulator Worker.
5. Run at least three scenarios using the same baseline assumptions.
6. Compare actual outputs without inventing a numerical score.
7. Add one deterministic calculation and label its fictional inputs.
8. Challenge every scenario with omitted stakeholders, feedback loops, and rare events.
9. Record the final decision in a Human Task.
10. Apply any Runtime containment explicitly rather than claiming automatic rollback.
11. Specify what a genuine isolated and validated simulation would require.

## Chapter summary

Current Arturo supports a governed tabletop pattern:

```text
inspect baseline → define decision and criteria → authorize scenario exercise
                 → run bounded Simulator Tasks → challenge assumptions
                 → compare external evidence → human decision
                 → explicit containment if required
```

This can improve thinking because it forces assumptions and failure modes into view. It cannot estimate outcomes reliably without an executable, calibrated, validated model and an isolated environment.

## Looking ahead

Chapter 33 examines Digital Twins. A continuously updated dashboard or model-generated summary is not automatically a twin; a credible twin must define what it represents, how it synchronizes, how fidelity is measured, and which actions it is forbidden to take.
