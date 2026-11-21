# Chapter 38 — Self-Improving Enterprises

> **Summary:** Arturo may suggest improvements from eligible
> evidence. It must not silently change its own code, rules, or Governance.

*A system that feeds its own unverified output back into itself is not self-improving; it is self-reinforcing.*

## Current versus target architecture

Arturo does not currently provide an autonomous end-to-end improvement cycle. It has no first-class Improvement Proposal, Experiment, Model Evaluation, Deployment, Rollback, or Improvement History entity.

Current Arturo does provide several important foundations:

- Runtimes can evaluate Events and may create Tasks.
- Tasks record routing, lifecycle, result, and evidence status.
- eligible Runtime outcomes can be measured.
- Runtime learning can retain Operational Memory under controlled conditions.
- unverified model synthesis is excluded from autonomous Runtime learning and follow-up work.
- quarantined model-derived Memory is excluded from Worker context.
- humans can enter scoped Memory manually.
- Governance can gate matching Tasks before execution.
- Human Tasks can record post-output decisions.
- Events and the timeline expose part of the operational history.

These controls make unsafe feedback less likely. They do not establish that Arturo improves itself.

Use fictional, non-sensitive inputs.

## Starting state

Create a small isolated-by-design example—not a secure tenant—to observe current behavior without publishing into all the Runtimes accumulated in `Harbour Studio Sandbox`:

```text
/enterprise create "Harbour Improvement Sandbox" --mission "Explore governed improvement-review workflows using fictional evidence and no autonomous configuration changes."

/function create "Improvement Evidence Review Function" --enterprise "Harbour Improvement Sandbox" --objective "Review supplied fictional operating observations and identify candidate questions without treating model synthesis as verified learning."

/function start "Improvement Evidence Review Function"
/function inspect "Improvement Evidence Review Function"
```

Enterprise routing limits Event evaluation to running Runtimes in the named Enterprise, but the installation is not a fully isolated tenant. Workers and several stores remain globally visible or selectable.

## What improvement means

An improvement claim needs evidence that a change caused better outcomes within constraints.

At minimum:

```text
improvement claim = defined baseline
                  + versioned change
                  + valid comparison
                  + measured benefit
                  + non-degraded guardrails
                  + uncertainty
                  + accountable decision
```

More Tasks, more Memory, lower token use, higher approval rate, or more confident prose are not inherently improvements.

## Learning levels

Use explicit maturity levels:

| Level | Behavior | Current Arturo status |
|---:|---|---|
| 0 | Record operational history | partly supported |
| 1 | Human inspects records and identifies a question | supported |
| 2 | AI generates advisory improvement candidates | supported as unverified synthesis |
| 3 | Verified outcomes create bounded learning | partial foundations exist |
| 4 | System creates evidence-linked change proposals | not implemented |
| 5 | Isolated experiments compare versioned candidates | not implemented |
| 6 | Human-approved staged deployment and rollback | not implemented |
| 7 | System executes pre-authorized reversible improvements | not implemented |
| 8 | System rewrites mission, authority, or irreversible commitments | should remain prohibited or exceptionally governed |

Do not describe Level 2 advisory output as Level 7 self-improvement.

## Evidence ladder

Classify evidence before it enters a feedback loop:

1. **Model synthesis:** generated text without external verification.
2. **Human assertion:** entered by a person but not independently verified.
3. **Recorded operational observation:** captured by a relevant system, with provenance and limitations.
4. **Verified outcome:** checked against an authoritative source and acceptance criteria.
5. **Controlled comparison:** baseline and candidate evaluated under a valid design.
6. **Replicated evidence:** result reproduced across suitable conditions.

Higher autonomy should require stronger evidence. A model cannot promote its own synthesis up this ladder merely by restating it.

## 1. Authorize advisory candidate generation

Register bounded participants:

```text
/add-ai-worker "Improvement Candidate Analyst" --archetype optimizer
/add-human-worker "Improvement Decision Owner" --archetype guardian --availability available
/workers
```

Record the permitted scope:

```text
/create-human-task "Authorize fictional improvement analysis" "Authorize one advisory Task over supplied fictional observations. The AI may identify questions and candidate tests but may not add Memory, change configuration, publish Events, apply policy, contact anyone, or claim verified improvement."
/complete-human-task <improvement-authorization-task-id> "Authorized for advisory analysis only. All learning and configuration decisions remain human-owned and require verified evidence." --as "Improvement Decision Owner"
/human-task <improvement-authorization-task-id>
```

Create the Human Task first and substitute its returned ID.

## 2. Generate a bounded candidate

Use a fictional observation with explicit limitations:

```text
/task-cap --capability optimization --bounded-task "FICTIONAL IMPROVEMENT ANALYSIS. Supplied observation: five synthetic draft-review Tasks produced repeated requests for clearer evidence labels. No validated user outcome, timing, cost, or error data exists. Separate observation from inference. Propose at most three testable hypotheses, required authoritative evidence, baseline and guardrails, synthetic experiment design, stopping conditions, failure modes, and reasons not to change anything. Do not claim improvement, add Memory, or recommend autonomous configuration."
/task inspect <candidate-task-id>
```

The result is normally `Unverified model synthesis`. It is a source of candidate questions, not learning evidence.

Direct `/task-cap` Tasks are not automatically attached to `Improvement Evidence Review Function`, so do not expect its Runtime Health or outcome counters to treat this Task as Function evidence.

## 3. Observe the Runtime's evidence boundary

Publish a separate bounded Event to the Improvement Enterprise:

```text
/event publish "Synthetic review-pattern observation submitted for improvement analysis" --source "Improvement Evidence Review Function" --enterprise "Harbour Improvement Sandbox"
/events
/tasks
/timeline
```

The single running Runtime in this Enterprise may decide to create a Task. Model-driven Event evaluation is nondeterministic; inspect the `Runtime evaluations` output rather than assuming a Task exists.

If it creates a Task, wait for completion and inspect it:

```text
/task inspect <runtime-generated-task-id>
/function inspect "Improvement Evidence Review Function"
/timeline
```

With ordinary local model output and no external tools, the result should remain unverified. Arturo should record that unverified synthesis was excluded from Runtime learning and autonomous follow-up, commonly through `runtime.outcome.measurement_skipped`.

That skipped measurement is a successful safety outcome, not a failed self-improvement feature.

## 4. Inspect Memory before adding anything

```text
/memory
```

Look for:

- `Evidence` status;
- `Execution` eligibility or quarantine;
- scope;
- source;
- creation time; and
- whether the text is an observation, rule, inference, or conclusion.

Do not copy the AI candidate into Memory. Doing so manually would change its execution status from excluded model synthesis to a human-entered assertion eligible for Worker context without independently verifying the claim.

That provenance laundering is one of the most important failure modes in a learning system.

## 5. Add only a procedural constraint

If the Human decision owner wants a durable rule, add a non-result procedural constraint:

```text
/memory add "Improvement proposals must keep supplied observations separate from model-generated explanations." --scope "Improvement Evidence Review Function"
/memory
```

The entry should display:

```text
Evidence: Human-entered assertion — not independently verified
Execution: Eligible for Worker context
```

Eligibility does not mean truth. The human is accepting responsibility for introducing the constraint into future context.

Remove it if it becomes obsolete or harmful:

```text
/memory remove <procedural-memory-id>
```

Removal affects future context but cannot retract text already present in previous prompts, Tasks, chat, or Events.

## 6. Challenge the candidate

```text
/chat "Improvement Candidate Analyst" "Red-team your recorded candidate Task. Identify self-confirming evidence, reward hacking, proxy gaming, prompt contamination, selection bias, missing stakeholders, regression risk, rollback limits, and observations that would falsify each hypothesis."
/chat history "Improvement Candidate Analyst"
```

The same model challenging itself is not independent verification. Use the response to find questions for qualified people and authoritative systems.

## 7. Design verification outside Arturo

For one candidate, define:

- baseline version;
- candidate version;
- exact change;
- authoritative outcome source;
- primary measure;
- guardrail measures;
- eligibility and exclusions;
- assignment method;
- sample-size rationale;
- duration;
- model, prompt, tool, and data versions;
- privacy and security controls;
- stopping and rollback criteria;
- analysis plan;
- independent reviewer; and
- required evidence strength.

Arturo has no experiment engine, artifact registry, or statistical evaluation framework to execute this design.

## 8. Separate the improvement roles

Avoid one model or person controlling the whole loop:

| Role | Responsibility | Must not also do automatically |
|---|---|---|
| Observer | capture authoritative state | redefine success |
| Proposer | generate candidate change | validate own claim |
| Evaluator | compare baseline and candidate | hide adverse results |
| Risk reviewer | assess safety and constraints | approve own exceptions |
| Decision owner | approve, reject, or defer | fabricate evidence |
| Deployer | apply an authorized version | change scope silently |
| Monitor | detect outcome and regression | rewrite historical baseline |

Current Arturo does not enforce this separation of duties. Worker archetypes are not access-control roles.

## 9. Record the post-output decision

```text
/create-human-task "Review fictional improvement candidate" "Review the candidate Task, red-team response, evidence ladder, proposed experiment, risks, and missing authoritative outcomes. Decide whether to reject, revise, or authorize an external synthetic experiment."
/complete-human-task <improvement-decision-task-id> "Authorize only an external synthetic experiment. Do not change Runtime configuration or treat model output as learning. Require independent outcome verification and guardrail review." --as "Improvement Decision Owner"
/human-task <improvement-decision-task-id>
/timeline
```

Create the task first and substitute its returned ID.

This Human Task does not create an experiment, change configuration, or mark evidence verified.

## 10. Apply changes only through explicit evolution

If valid external evidence later supports a change:

1. capture the before-state;
2. record the exact evidence and verifier;
3. create a change proposal externally;
4. obtain appropriate organizational authorization;
5. add a successor or bounded change explicitly;
6. apply Governance before consequential work;
7. pilot with stopping conditions;
8. monitor authoritative outcomes;
9. contain or roll back where technically possible; and
10. record the final decision and residual effects.

Do not instruct an AI Worker to execute administrative commands from its own recommendation. Arturo's Task approval gate does not automatically govern configuration mutations.

## 11. Track multi-cycle drift

Maintain an external improvement ledger:

| Cycle | Trigger | Candidate | Evidence level | Approved scope | Outcome | Guardrails | Decision |
|---|---|---|---:|---|---|---|---|
| imp-001 | repeated synthetic label request | test clearer evidence labels | 1 | external synthetic experiment only | pending | pending | not deployed |

Review the trajectory across cycles:

- Has the mission changed indirectly?
- Are humans reviewing more or merely clicking approve?
- Are exceptions becoming normal?
- Are costs shifting between Functions?
- Are models evaluating outputs generated by related models?
- Are hard cases being excluded to improve metrics?
- Is rollback becoming harder?
- Are affected stakeholders losing influence?
- Is the system accumulating unverifiable Memory?
- Is capability or authority concentrating in one Worker or provider?

Current `/health` has no multi-cycle improvement trend or Enterprise-level drift model.

## Feedback-loop hazards

### Provenance laundering

A person copies model output into manual Memory, making it eligible context without verification.

### Self-confirmation

The model proposes a change, generates the evaluation criteria, scores the result, and declares success.

### Model collapse

Future learning relies increasingly on synthetic outputs rather than independent real-world evidence.

### Reward hacking

Workers optimize the metric or approval process rather than the intended outcome.

### Selection bias

Hard cases disappear from evaluation, making performance appear to improve.

### Prompt injection persistence

Malicious text in Events, Tasks, artifacts, or external responses is summarized into durable Memory and influences future Workers.

### Automation bias

Humans approve fluent recommendations without examining evidence.

### Capability ratchet

Each cycle adds tools or permissions, while removal and revocation remain weak.

### Irreversible side effects

Messages, payments, publications, physical actions, or disclosed data cannot be undone by rolling back configuration.

## Verification requirements

Learning eligibility should depend on explicit checks:

- authoritative source identity;
- source and capture timestamp;
- schema and range validation;
- provenance chain;
- independent confirmation where appropriate;
- human or deterministic verifier identity;
- conflict and uncertainty handling;
- privacy and consent;
- effective date and expiry;
- scope;
- supersession; and
- revocation or correction.

Current Memory entries do not model this full lifecycle.

## Safe failure and kill controls

A future self-improvement subsystem needs:

- global pause;
- per-Enterprise and per-Function pause;
- disable-learning mode;
- disable-proposal mode;
- disable-deployment mode;
- budget cutoff;
- model and tool revocation;
- Memory quarantine and revalidation;
- rollback to a signed known-good version;
- prevention of reapplying a rejected change;
- incident preservation; and
- independent emergency authority.

Current Runtime pause affects Event evaluation for one Runtime. It is not a global learning kill switch or rollback.

## Domains that require stronger prohibition

Do not enable autonomous self-modification for:

- clinical diagnosis or treatment;
- child safeguarding;
- legal rights and public authority;
- credit, benefits, employment, or housing decisions;
- safety-critical machinery;
- security-control weakening;
- financial transfers;
- surveillance or targeting;
- model permission expansion; or
- mission and constitutional constraints.

High-stakes improvement may still be possible through controlled research, independent validation, formal authorization, staged deployment, and external oversight. It should not be a Runtime's unilateral learning loop.

## Economics of self-improvement

Improvement cycles consume model tokens, human review, experimentation, infrastructure, and organizational attention. Arturo does not currently provide:

- improvement-cycle budgets;
- expected-value calculations;
- local-first and paid-model escalation;
- experiment cost attribution;
- cost of false improvement;
- cumulative change cost; or
- provider-billing reconciliation.

An improvement system can spend more optimizing than the improvement is worth. Budget and stopping rules should be set before exploration begins.

## Target architecture — non-executable

The following illustrates a possible future interface. **Do not enter these commands in the current CLI.**

```text
# NOT IMPLEMENTED
/improvement observe --enterprise "Harbour Improvement Sandbox" --evidence-policy <policy-id>

# NOT IMPLEMENTED
/improvement proposal create --trigger <verified-observation-id> --authority advisory-only

# NOT IMPLEMENTED
/improvement proposal inspect <proposal-id> --show-origin --show-evidence --show-memory-impact

# NOT IMPLEMENTED
/improvement experiment design <proposal-id> --environment isolated-synthetic

# NOT IMPLEMENTED
/improvement experiment run <experiment-id> --budget <budget-id>

# NOT IMPLEMENTED
/improvement verify <experiment-id> --independent-review <review-id>

# NOT IMPLEMENTED
/improvement deploy <proposal-id> --stage <stage-id> --rollback <rollback-id>

# NOT IMPLEMENTED
/improvement pause --scope enterprise --reason <incident-id>

# NOT IMPLEMENTED
/improvement history --enterprise "Harbour Improvement Sandbox" --show-cumulative-drift
```

A safe implementation requires verified evidence, immutable versioned proposals, isolated experiments, separation of duties, authority, budgets, staged deployment, rollback, monitoring, Memory impact analysis, cumulative-drift detection, and emergency control.

## Current implementation boundaries

Arturo currently does **not** provide:

- Improvement, Proposal, Experiment, Evaluation, Deployment, Rollback, Verification, or Improvement History entities;
- autonomous strategic or configuration proposal generation;
- verified external outcome ingestion or evidence promotion workflows;
- experiment assignment, statistics, causal inference, replication, or independent verification;
- versioned prompts, models, tools, Functions, policies, Memory, or configuration bundles;
- staged deployment, canary rollout, rollback, artifact restoration, or side-effect compensation;
- separation-of-duty enforcement for proposer, evaluator, approver, deployer, and monitor;
- global learning, proposal, deployment, or budget kill switches;
- cumulative improvement drift, mission drift, reward hacking, or model-collapse detection;
- improvement-driven model escalation, monetary improvement budgets, or cost reconciliation; or
- proof that a retained lesson or configuration change caused a safe, durable improvement.

A narrow local-first router exists only for repeated structured-output failure. It does not select or deploy improvements.

## Common mistakes

**Calling repeated model output learning.** Repetition does not increase evidence quality.

**Copying AI output into manual Memory.** This can launder provenance and re-enable excluded content.

**Treating an outcome-measurement skip as failure.** Excluding unverified synthesis is a safety success.

**Letting the proposer define and score success.** Separate proposal from evaluation.

**Approving before output and calling it verification.** `/approve` authorizes execution; it does not validate the result.

**Using more Tasks or Memory as improvement metrics.** Activity is not outcome.

**Applying configuration from advisory output.** Administrative mutation needs separate authority and evidence.

**Evaluating only easy cases.** Selection bias can manufacture apparent gains.

**Ignoring cumulative drift.** Individually reasonable cycles can alter mission and risk over time.

**Assuming rollback undoes external action.** Disclosed data and real-world effects may be irreversible.

**Allowing improvement to expand its own permissions.** Authority changes require independent Governance.

## Design challenge

Using fictional observations only:

1. Create the Improvement Sandbox and one running Runtime.
2. Define an evidence ladder and minimum evidence for learning.
3. Record human authorization for one advisory candidate Task.
4. Generate candidates without claiming improvement.
5. Publish one bounded Event and observe whether Runtime learning is skipped for unverified synthesis.
6. Inspect Memory provenance and add only a procedural human assertion.
7. Red-team provenance laundering, reward hacking, selection bias, and injection persistence.
8. Design an external controlled comparison with guardrails and stopping rules.
9. Separate proposer, evaluator, approver, deployer, and monitor roles.
10. Record the human decision without applying configuration.
11. Define multi-cycle drift review, budgets, kill controls, and prohibited domains.

## Chapter summary

Current Arturo supports a cautious human-governed learning boundary:

```text
record Events and Tasks → label provenance → exclude unverified synthesis
                       → quarantine ineligible model lessons
                       → human may add scoped procedural Memory
                       → inspect, challenge, and decide explicitly
                       → no automatic configuration mutation
```

A genuinely self-improving Enterprise requires more than feedback. It requires independent reality: authoritative observations, verified outcomes, controlled comparison, explicit authority, separation of duties, bounded deployment, rollback or containment, cumulative-drift monitoring, and the ability to stop learning safely.

## Looking ahead

Chapter 39 considers the future of AI-native organizations. The credible future is not one in which organizations remove humans from purpose and accountability; it is one in which automation becomes more capable while evidence, authority, participation, and control become more explicit.
