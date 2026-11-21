# Chapter 34 — Enterprise Optimisation

> **Note:** Arturo can compare choices supplied by a Human. It
> does not automatically find or apply the best company design.

*Optimization is choosing among constrained trade-offs—not asking an AI to “make the company better.”*

## Current versus target architecture

Arturo currently has an `optimizer` Worker archetype with an `optimization` capability. That Worker can produce advisory model synthesis.

Arturo does not currently provide:

- mathematical objective functions;
- hard constraint enforcement;
- a solver;
- historical trend queries;
- Enterprise or Product Health;
- Digital Twin or Simulation execution;
- experimental assignment or controlled rollout;
- causal inference;
- automated configuration proposals; or
- a closed loop that applies model recommendations.

This chapter demonstrates **optimization analysis**, not autonomous optimization.

Use fictional, non-sensitive inputs.

## Starting state

The `Harbour Studio Sandbox` now has evidence, design, quality, accessibility, migration, scenario, and snapshot-review examples. That growth creates a plausible concern: several reviews may duplicate effort.

The optimization question is deliberately bounded:

> Can the fictional studio reduce duplicate review work while preserving evidence quality, accessibility scrutiny, human release authority, and clear provenance?

Inspect current Arturo state first:

```text
/overview
/enterprise inspect "Harbour Studio Sandbox"
/function list
/workers
/tasks
/governance policy list
/approvals
/human-tasks
/events
/timeline
```

These commands do not provide review duration, labor cost, defect escape rate, accessibility outcome, customer value, or duplicated-effort measurements. Those need authoritative external evidence.

## Optimization vocabulary

### Decision variables

Things the decision can change, such as:

- which review occurs first;
- which cases require specialist review;
- which work can run in parallel;
- Worker capacity allocation;
- escalation thresholds; or
- batch size.

### Objective

The quantity or ordered outcomes being improved. “Efficiency” is too vague. A usable objective might be “reduce median review effort per synthetic draft.”

### Constraints

Conditions the solution may not violate:

- human release decision remains mandatory;
- no personal or confidential data;
- evidence status remains visible;
- accessibility review is not removed merely to save time;
- unsupported claims cannot be promoted to verified facts; and
- no external action is executed from Worker output.

### Guardrail metrics

Measures that should not degrade while the objective improves, such as:

- material issues found before release;
- unresolved evidence gaps;
- accessibility questions surfaced;
- human override rate;
- rework and incident rate; and
- cost and token consumption.

### Feasible set

Only alternatives satisfying every hard constraint should be compared. A faster but unauthorized or unsafe design is not an optimization candidate.

### Pareto trade-off

One candidate may be faster while another has stronger review coverage. If neither is better on every relevant dimension, the choice requires declared priorities and human judgment—not a hidden weighted score invented by a model.

## 1. Define the fictional baseline

Use a small external worksheet or design note:

```text
Fictional baseline assumptions — not observed Arturo metrics

Drafts per week:                         20
General quality reviews per draft:        1
Accessibility reviews per draft:          1
Human release decisions per draft:        1
Average AI review runs per draft:          2
Synthetic drafts needing specialist follow-up: 5 per week
```

The baseline implies:

```text
20 drafts × 2 AI review runs = 40 AI review runs per week
```

This arithmetic is deterministic. The inputs are fictional, so the result is not an observed workload.

## 2. Precommit objective and constraints

Record the proposed optimization exercise before adding capability:

```text
/create-human-task "Approve studio optimization analysis" "Review a fictional analysis of duplicate review work. Objective: reduce assumed AI review runs. Hard constraints: retain human release authority, evidence labels, accessibility scrutiny, privacy, and no external action. Approve analysis only, not configuration change."
/complete-human-task <optimization-proposal-task-id> "Approved for synthetic analysis only. Reject any option that removes accessibility scrutiny, hides evidence status, or bypasses the human release decision." --as "Studio Decision Owner"
/human-task <optimization-proposal-task-id>
```

Create the task first and substitute its returned ID.

This precommitment prevents a persuasive model response from silently redefining success.

## 3. Add a bounded optimization-analysis capability

```text
/function create "Enterprise Optimization Review Function" --enterprise "Harbour Studio Sandbox" --objective "Compare supplied synthetic operating alternatives against explicit objectives, constraints, guardrails, uncertainty, and human authority."

/add-ai-worker "Studio Optimization Analyst" --archetype optimizer
/workers inspect "Studio Optimization Analyst"
/workers
```

The uniquely named capability makes routing visible. The Worker is global, and the `optimizer` label does not make it a mathematical solver or grant authority to alter the Enterprise.

Start the Function if you want it represented as an active Runtime:

```text
/function start "Enterprise Optimization Review Function"
/function inspect "Enterprise Optimization Review Function"
```

## 4. Govern the analysis Task

Add Governance before asking for recommendations:

```text
/governance policy add "Studio optimization analysis requires approval" --effect require-approval --capability "optimization"
/governance policy inspect "Studio optimization analysis requires approval"
```

The policy gates the analysis Task. It does not validate the objective, enforce constraints inside model output, or govern later administrative commands.

## 5. Compare explicit candidates

Use the same fictional baseline for all candidates:

- **Candidate A — current design:** every draft receives general and accessibility review.
- **Candidate B — sequential triage:** every draft receives a combined first review; five assumed complex drafts receive specialist accessibility follow-up.
- **Candidate C — remove specialist review:** one general review per draft, with no dedicated accessibility follow-up.

Candidate C violates the precommitted accessibility constraint and should be rejected before scoring.

Run the advisory analysis:

```text
/task-cap --capability optimization --bounded-task "SYNTHETIC OPTIMIZATION ANALYSIS. Baseline assumptions: 20 drafts/week; Candidate A uses 2 AI review runs per draft; Candidate B uses 1 combined review per draft plus specialist accessibility follow-up for 5 drafts/week; Candidate C removes specialist accessibility review. Hard constraints: retain accessibility scrutiny, visible evidence status, human release authority, privacy, and no external action. Reject infeasible candidates before comparison. Show deterministic arithmetic separately from assumptions; compare plausible benefits, failure modes, guardrail evidence, token-cost questions, sensitivity, and unknowns. Do not apply changes or claim measured improvement."
/approvals
/approve <optimization-task-id>
/approval-status <optimization-task-id>
/task inspect <optimization-task-id>
```

Replace `<optimization-task-id>` with the returned ID.

The output is unverified model synthesis. Even when its arithmetic is correct, its conclusions about quality, safety, or feasibility need evidence.

## 6. Verify deterministic arithmetic yourself

For the fictional assumptions:

```text
Candidate A: 20 drafts × 2 reviews = 40 runs/week
Candidate B: 20 combined reviews + 5 specialist reviews = 25 runs/week
Candidate C: 20 drafts × 1 review = 20 runs/week

Candidate B reduction from A:
(40 - 25) / 40 = 0.375 = 37.5%
```

Candidate C is numerically cheapest but infeasible because it violates a hard constraint. Candidate B's 37.5% is an assumed workload reduction, not a measured cost or outcome improvement.

Test sensitivity:

| Specialist follow-ups | Candidate B runs | Reduction from 40 |
|---:|---:|---:|
| 0 | 20 | 50% |
| 5 | 25 | 37.5% |
| 10 | 30 | 25% |
| 20 | 40 | 0% |

The proposed benefit disappears if every draft needs specialist follow-up. That dependency should be validated before any pilot.

## 7. Challenge the objective

Use read-only Worker chat:

```text
/chat "Studio Optimization Analyst" "Challenge the optimization objective and constraints in your recorded Task. Identify Goodhart effects, hidden labor, tail risks, accessibility harms, fairness concerns, rebound effects, token costs, and evidence that could make Candidate B worse than Candidate A."
/chat history "Studio Optimization Analyst"
```

The response remains model synthesis and performs no action.

Important questions include:

- Could a combined review miss issues a specialist catches?
- Does triage merely move effort into rework or human escalation?
- Will Workers learn to label fewer cases complex to improve the metric?
- Are minority or unusual needs disproportionately triaged away?
- Does shorter review produce longer correction cycles?
- Does reduced AI usage increase scarce human workload?
- Does a local model produce lower-quality triage than the assumed model?
- Would paid-model escalation erase the expected savings?

## 8. Define a real pilot externally

Arturo has no experiment-assignment or rollout engine. A valid pilot design must be maintained outside the CLI and should define:

- eligible synthetic cases;
- baseline and candidate assignment;
- randomization or matching method;
- sample-size rationale;
- duration;
- versioned prompts and models;
- outcome and guardrail definitions;
- blinded or independent review where practical;
- stopping rules;
- privacy and security constraints;
- incident and rollback procedures;
- cost measurement; and
- analysis plan set before results.

Do not test a consequential operating change on real people, money, machinery, patient care, student outcomes, or regulated decisions merely because the model recommends it.

## 9. Record human selection

```text
/create-human-task "Decide studio optimization pilot" "Review the advisory optimization Task, verified arithmetic, sensitivity table, constraint check, and external pilot requirements. Decide whether to reject, revise, or authorize a synthetic pilot."
/complete-human-task <optimization-decision-task-id> "Authorize only an external synthetic pilot of Candidate B. Preserve Candidate A as baseline, measure specialist misses and human rework, and stop if accessibility coverage declines." --as "Studio Decision Owner"
/human-task <optimization-decision-task-id>
/timeline
```

Create the task first and replace `<optimization-decision-task-id>` with its returned ID.

The Human Task records a decision but does not configure Candidate B, assign cases, change Worker routing, or implement stopping rules.

## 10. Do not mutate live configuration automatically

The Optimizer Worker cannot directly:

- edit a Business Function;
- change an Objective;
- add or remove a policy;
- reassign Workers;
- pause a Runtime;
- publish an Event;
- send a message;
- modify a file; or
- apply a rollout.

That restriction is valuable. Any approved configuration change must follow Chapter 30's evolution discipline and Chapter 31's migration discipline using explicit commands and external evidence.

Administrative commands are not automatically gated by the Task approval policy. A user can still manually change configuration, which is why organizational authorization and least-privilege access remain necessary.

## 11. Measure outcomes without abusing Health

Current `/health` accepts one Business Function name or ID:

```text
/health "Enterprise Optimization Review Function"
/function inspect "Enterprise Optimization Review Function"
```

It does not accept the previously documented `--trend 6months` or `--all-indicators` flags. Current Health does not measure review effort, issue-detection quality, accessibility outcomes, human rework, cost, customer value, or the pilot's causal effect.

Keep an external optimization ledger:

| Cycle | Baseline version | Candidate version | Objective | Constraints | Outcome evidence | Guardrail evidence | Decision |
|---|---|---|---|---|---|---|---|
| opt-001 | A | B | reduce review runs | accessibility and human authority retained | synthetic pilot pending | synthetic pilot pending | approved for pilot only |

Track cumulative change across cycles; a sequence of locally reasonable changes can create harmful long-term drift.

## Objective hierarchy

Enterprise optimization should not collapse every concern into one weighted score. Prefer an explicit hierarchy:

```text
1. Satisfy legal, ethical, safety, privacy, and authority constraints.
2. Meet minimum quality and accessibility guardrails.
3. Preserve resilience and human override.
4. Within the feasible set, improve the chosen operational objective.
5. Among materially equivalent options, prefer lower cost and complexity.
```

Weights can conceal unacceptable trade-offs. A solution should not compensate for a severe safety violation by being sufficiently cheap.

## Goodhart's law and proxy failure

When a measure becomes a target, behavior may optimize the measure rather than the real outcome.

Examples:

- reducing `review runs` by combining shallow reviews;
- reducing `time to completion` by closing Tasks prematurely;
- increasing `Tasks completed` by splitting work into trivial units;
- reducing `human escalations` by hiding uncertainty;
- reducing `token cost` by using an inadequate model; or
- improving `approval rate` by routing difficult cases elsewhere.

Use multiple guardrails, qualitative review, random audit, and outcome evidence. Rotate or revise proxies when people or models learn to game them.

## Local versus Enterprise optimization

A Function can improve its own metric while harming another Function or the Enterprise:

- Resource Design produces more drafts, overwhelming Quality Review.
- Quality Review reduces turnaround by escalating more work to humans.
- Accessibility Review minimizes false negatives by flagging everything.
- Cost control selects a weaker model, increasing rework.

Arturo currently has no Enterprise Health or cross-Function objective optimizer to reconcile these effects. Humans must inspect the full operating system and authoritative external outcomes.

## Robustness, resilience, and tails

Optimizing average performance is insufficient. Evaluate:

- worst credible case;
- high-percentile delay or cost;
- rare severe harm;
- dependency outage;
- model failure and malformed output;
- missing approval secret;
- Worker unavailability;
- database or connector failure;
- demand spikes;
- adversarial or unusual inputs; and
- recovery time.

A slightly slower design with graceful failure can be better than a fragile average-case optimum.

## Fairness and distribution

An average improvement can hide unequal impact. Compare outcomes across relevant, lawfully defined groups and edge cases without placing sensitive personal data into Arturo.

Fairness evaluation requires context, legitimate group definitions, adequate sample sizes, privacy protection, appropriate metrics, and affected-community participation. An Optimizer Worker's prose is not a fairness audit.

## Model and cost optimization

Arturo's current model choice belongs to each Worker. It does not automatically:

- start with the cheapest local model;
- estimate task difficulty;
- escalate on uncertainty;
- compare output quality across models;
- request spending approval;
- enforce per-Task or organizational monetary budgets;
- prevent retry storms;
- reconcile provider invoices; or
- attribute total cost to a Function or Product.

A future cost-aware router should treat quality, privacy, latency, reliability, and evidence needs as constraints—not optimize token price alone.

## Target architecture — non-executable

The following illustrates a possible future interface. **Do not enter these commands in the current CLI.**

```text
# NOT IMPLEMENTED
/optimization create --enterprise "Harbour Studio Sandbox" --objective "review_effort" --direction minimize

# NOT IMPLEMENTED
/optimization constraint add <optimization-id> --metric "accessibility_issue_recall" --minimum 0.95

# NOT IMPLEMENTED
/optimization candidate add <optimization-id> --configuration "combined-triage-v1"

# NOT IMPLEMENTED
/optimization simulate <optimization-id> --simulation <validated-simulation-id>

# NOT IMPLEMENTED
/optimization pilot <optimization-id> --environment synthetic --stop-rule <rule-id>

# NOT IMPLEMENTED
/optimization evaluate <optimization-id> --include-guardrails --include-cost --include-distribution

# NOT IMPLEMENTED
/optimization propose-evolution <optimization-id> --candidate <candidate-id>
```

A genuine implementation needs typed objectives, enforceable constraints, authoritative metrics, experimental design, isolated simulation, candidate and model versions, uncertainty, approval, cost control, staged rollout, rollback, and cumulative-drift monitoring.

## Current implementation boundaries

Arturo currently does **not** provide:

- an Optimization entity, cycle, objective, constraint, candidate, experiment, or result schema;
- mathematical, constraint, scheduling, routing, or multi-objective solvers;
- historical trend flags or custom Health indicators through the current CLI;
- Enterprise or Product Health;
- authoritative operational, quality, cost, safety, fairness, or outcome metrics;
- causal inference, experiment assignment, statistical evaluation, or sequential testing;
- Simulation or Digital Twin execution;
- staged, canary, cohort, percentage, or environment rollout;
- automatic Worker, policy, Objective, Function, or Runtime configuration changes;
- automatic cheapest-model routing, uncertainty escalation, budgets, or billing reconciliation;
- cumulative optimization history or drift detection; or
- proof that an Optimizer recommendation is feasible, safe, fair, beneficial, or optimal.

## Common mistakes

**Using “improve performance” as the objective.** It is neither measurable nor constrained.

**Optimizing before verifying the baseline.** Bad measurements produce confidently wrong improvements.

**Using one metric.** Local gains can hide quality, safety, fairness, resilience, or cost degradation.

**Scoring infeasible options.** Hard constraints should eliminate them before trade-off comparison.

**Treating model arithmetic as authoritative.** Recompute deterministic claims independently.

**Treating advisory output as an applied change.** The Worker performs no mutation.

**Calling `/approve` approval of the recommendation.** It authorizes the Task before the recommendation exists.

**Using Arturo Health as the pilot outcome.** Current Health does not measure the relevant domain metrics.

**Ignoring cumulative drift.** Repeated small optimizations can move the Enterprise far from its original intent.

**Optimizing model cost alone.** Cheap inadequate output can increase downstream cost and risk.

## Design challenge

Using fictional data only:

1. Define a bounded decision variable and one measurable objective.
2. Precommit hard constraints and at least four guardrail metrics.
3. Record human authorization for advisory analysis.
4. Register a uniquely routed Optimizer Worker.
5. Define at least three candidates and reject one as infeasible before scoring.
6. Run a governed analysis Task and independently verify every calculation.
7. Perform sensitivity analysis on the most influential assumption.
8. Challenge Goodhart effects, distributional impacts, feedback loops, and tail risks.
9. Design an external synthetic pilot with stopping rules.
10. Record the human decision without claiming Arturo applied it.
11. Specify cumulative monitoring and model-cost controls.

## Chapter summary

Current Arturo supports a safe advisory pattern:

```text
inspect → define objective and hard constraints → authorize analysis
        → governed Optimizer Task → verify arithmetic and assumptions
        → challenge trade-offs → design external pilot → human decision
        → explicit evolution only if separately approved
```

Optimization is not “maximize a number.” It is finding an acceptable choice within legal, ethical, safety, quality, privacy, authority, resilience, and cost constraints—and remaining willing to reject every candidate when the evidence is inadequate.

## Looking ahead

Chapter 35 asks whether an Enterprise can formulate strategy autonomously. The same boundary will apply: AI can generate strategic options, but authority, evidence, commitments, resource allocation, and accountable choice require stronger controls than persuasive prose.
