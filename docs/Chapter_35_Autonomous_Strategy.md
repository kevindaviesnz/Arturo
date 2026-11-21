# Chapter 35 — Autonomous Strategy

> **Summary:** AI can suggest strategic options, but important
> company direction must remain governed and accountable to Humans.

*Arturo can help generate strategic options; it cannot legitimately choose the organization's purpose or commit the organization to a course of action.*

## Current versus target architecture

The current Arturo CLI does not implement:

- a Strategy, Proposal, Initiative, Portfolio, Budget, or Commitment entity;
- autonomous detection of a strategic issue;
- Runtime-originated configuration proposals;
- attached evidence bundles;
- strategy approval workflows;
- evolution history;
- resource-allocation authority; or
- automatic adoption of a recommendation.

There is no supported `/function propose-evolution`, `/function evolution-proposal`, or `/function evolution-history` command.

What Arturo can do today is support **governed strategic option generation**: a human defines a bounded question, an AI Worker produces unverified options, another review challenges them, and a Human Task records the accountable decision.

That is advisory strategy—not autonomous strategy.

Use fictional, non-sensitive information.

## Starting state

The `Harbour Studio Sandbox` has accumulated several pilot capabilities. The strategic question is:

> Should the Studio keep Quality Review and Accessibility Review as distinct capabilities, consolidate them, or retain parallel specialization with clearer boundaries?

This is strategic because it affects organizational capability boundaries, Worker use, Governance, cost, evidence, and future evolution. It is not merely a single Task-routing decision.

Inspect actual Arturo records before asking a model to reason:

```text
/enterprise inspect "Harbour Studio Sandbox"
/function inspect "Quality Review Function"
/function inspect "Accessibility Review Function"
/function inspect "Accessibility Review v2 Function"
/function list
/workers
/tasks
/governance policy list
/approvals
/human-tasks
/events
/timeline
```

These records do not reveal market demand, customer needs, staff capability, legal obligations, budget, accessibility outcomes, competitor behavior, or the quality of external alternatives. Record those evidence gaps explicitly.

## What strategy is

Strategy makes linked choices about:

- purpose and intended beneficiaries;
- where the organization will and will not operate;
- capabilities to build, preserve, partner for, or stop;
- scarce resource allocation;
- acceptable risk and constraints;
- time horizon and sequencing;
- distinctive advantage;
- measures of progress; and
- how the organization will learn and adapt.

A list of attractive ideas is not a strategy. A strategy includes exclusions and opportunity cost.

## Strategic authority boundary

Different activities require different authority:

| Activity | AI advisory role | Human or organizational authority required |
|---|---|---|
| Summarize supplied evidence | permitted, provenance required | verify completeness and accuracy |
| Generate options | permitted as unverified synthesis | define legitimate option space |
| Identify assumptions and risks | permitted | validate with authoritative evidence |
| Recommend an option | advisory only | accountable decision owner selects or rejects |
| Change Enterprise or Function configuration | no automatic authority | authorized administrator applies explicit commands |
| Allocate budget or hire | no authority | financial and employment authority |
| Contact partners or customers | no authority in current chat | authorized communication workflow |
| Enter an agreement | no authority | authorized signatory and legal process |
| Change mission or legal purpose | no supported command or authority | constitutional or organizational governance |

The boundary must be enforced by permissions and deterministic controls, not merely stated in a prompt.

## 1. Define the strategic question and exclusions

Create an external strategy brief:

```text
Decision:
Choose the next operating model for Quality and Accessibility Review.

Time horizon:
Next synthetic pilot cycle only.

Options required:
A. Keep current separation.
B. Consolidate into one review capability.
C. Retain specialization but redesign boundaries and handoffs.

Non-negotiable constraints:
- human release authority remains;
- accessibility scrutiny cannot be removed to save cost;
- model synthesis cannot become verified evidence;
- no personal or confidential data;
- no external commitment or communication;
- no configuration change from AI output.

Known evidence gaps:
- no validated quality or accessibility outcome data;
- no measured duplicate effort;
- no customer or affected-user research;
- no complete cost model;
- no dependency graph.
```

Setting the option space and exclusions before model output reduces goal drift.

## 2. Record human authorization to generate options

```text
/create-human-task "Authorize studio strategic-options analysis" "Review the bounded question, options, constraints, and evidence gaps. Authorize AI option generation only; do not authorize adoption, spending, communication, or configuration change."
/complete-human-task <strategy-authorization-task-id> "Authorized for advisory option generation using synthetic and Arturo-recorded information only. Final choice and all commitments remain human-owned." --as "Studio Decision Owner"
/human-task <strategy-authorization-task-id>
```

Create the task first and substitute the returned ID.

This Human Task records an instruction. Arturo has no Strategy object linking it automatically to later analysis Tasks.

## 3. Add a bounded strategic-analysis capability

```text
/function create "Strategic Options Review Function" --enterprise "Harbour Studio Sandbox" --objective "Generate and challenge bounded strategic options from supplied evidence while preserving uncertainty, constraints, exclusions, and human decision authority."

/add-ai-worker "Studio Strategic Options Analyst" --archetype advisor
/workers inspect "Studio Strategic Options Analyst"
/workers
```

The unique capability makes routing visible. The Worker is global and has no corporate office, fiduciary duty, signing authority, budget, or permission to act externally.

Starting a Runtime is optional for direct Tasks:

```text
/function start "Strategic Options Review Function"
/function inspect "Strategic Options Review Function"
```

Do not interpret an active Runtime as an autonomous board or executive.

## 4. Govern option generation

```text
/governance policy add "Studio strategic-options analysis requires approval" --effect require-approval --capability "advice"
/governance policy inspect "Studio strategic-options analysis requires approval"
```

The policy gates the analysis Task before it runs. It does not approve its recommendation afterward or prevent a human administrator from independently issuing configuration commands.

## 5. Generate options with evidence discipline

```text
/task-cap --capability advice --bounded-task "STRATEGIC OPTIONS ANALYSIS. Question: should Harbour Studio keep Quality Review and Accessibility Review separate, consolidate them, or retain specialization with redesigned boundaries? Constraints: human release authority; accessibility scrutiny retained; model synthesis remains unverified; no personal data; no external commitment; no configuration action. Known gaps: no validated outcome data, no measured duplicate effort, no user research, no complete cost model, no dependency graph. For Options A, B, and C provide: strategic logic, required capabilities, explicit sacrifices, assumptions, evidence for and against, risks, affected stakeholders, reversible pilot, leading indicators, stopping conditions, and unknowns. Include a status-quo option. Do not choose, contact anyone, spend money, or claim evidence not supplied."
/approvals
/approve <strategy-analysis-task-id>
/approval-status <strategy-analysis-task-id>
/task inspect <strategy-analysis-task-id>
```

Replace `<strategy-analysis-task-id>` with the returned ID.

The result is unverified model synthesis. A structured answer can still be incomplete, biased, strategically naive, or based on unstated assumptions.

## 6. Build an evidence-to-claim ledger

For each material statement, classify provenance externally:

| Claim | Source | Status | Verification owner | Decision use |
|---|---|---|---|---|
| Reviews duplicate effort | model inference | unverified | Studio Decision Owner | hypothesis only |
| Accessibility requires affected-user evidence | human constraint | not independently verified in Arturo | qualified reviewer | constraint pending source |
| Option C preserves specialization | option definition | declared | decision owner | valid by construction |
| Consolidation reduces cost | no cost data | unsupported | finance/operations | prohibited |

Do not let several weak claims become “strong evidence” merely because the model repeats them consistently.

## 7. Red-team the options

Use read-only chat to challenge the analysis:

```text
/chat "Studio Strategic Options Analyst" "Red-team your recorded strategic-options Task. Identify hidden stakeholders, conflicts, power shifts, accessibility harms, incentive problems, execution dependencies, second-order effects, competitor responses, opportunity costs, irreversible commitments, and evidence that would reverse each option. Distinguish Arturo records from model inference."
/chat history "Studio Strategic Options Analyst"
```

Chat does not create a formal second independent reviewer. It uses the same Worker and model context, so correlated blind spots remain.

For meaningful challenge, seek independent humans, affected stakeholders, domain specialists, and—where appropriate—separately configured models with explicitly compared provenance. Arturo does not orchestrate that panel today.

## 8. Check strategic coherence

Assess each option against the same questions:

1. Which Enterprise purpose does it advance?
2. What will the Enterprise stop or decline?
3. Which distinctive capability does it strengthen?
4. Which resource becomes the bottleneck?
5. What must be true for the option to work?
6. Which stakeholder bears cost or risk?
7. What evidence would falsify the strategic logic?
8. Which decisions are reversible, and until when?
9. What leading indicators precede outcomes?
10. What prevents metric gaming or mission drift?
11. What happens if the model, Worker, or external dependency fails?
12. Who is accountable for implementation and review?

A recommendation that avoids trade-offs is likely incomplete.

## 9. Separate option generation from commitment

The following are commitments and must not follow automatically from the AI Task:

- creating, renaming, splitting, merging, or stopping Functions;
- adding or removing Governance;
- changing Objectives or mission;
- hiring, dismissing, or assigning people;
- purchasing model access or tools;
- promising delivery dates;
- publishing a roadmap;
- contacting customers or partners;
- signing a contract; or
- representing a decision as approved.

Worker archetype guardrails prohibit claiming external action without confirmation, but organizational permissions must independently prevent it.

## 10. Record the accountable decision

```text
/create-human-task "Choose studio review strategy" "Review the strategic-options Task, red-team response, evidence-to-claim ledger, stakeholder input, constraints, and evidence gaps. Choose an option, request revision, or defer. Record rationale, sacrifices, evidence requirements, and prohibited commitments."
/complete-human-task <strategy-decision-task-id> "Defer structural change. Retain separate Functions during a synthetic pilot, clarify handoffs, collect independent accessibility and effort evidence, and reconsider after predefined review criteria are met." --as "Studio Decision Owner"
/human-task <strategy-decision-task-id>
/timeline
```

Create the task first and substitute its returned ID.

This decision does not automatically update Functions, Runtimes, Workers, policies, or budgets. Any later change must follow Enterprise Evolution and Migration controls explicitly.

## 11. Preserve origin attribution manually

Current Arturo does not have a Proposal object with a `proposedBy` field. Preserve origin in the external strategy record:

```text
Strategy record: studio-review-001
Question initiated by: human — Studio Decision Owner
Options generated by: AI — Studio Strategic Options Analyst
Model: copy from Worker/Task record
Supporting Arturo Task: <strategy-analysis-task-id>
Human decision task: <strategy-decision-task-id>
Decision: defer structural change
Configuration mutations: none
```

If a Runtime-created Task unexpectedly surfaces a strategic idea, record the exact Runtime, triggering Event, Task, Worker, model, prompt context, and human who classified it as strategic. Do not retrospectively label ordinary model output an “autonomous strategy proposal.”

## Can a Runtime initiate strategy today?

Running Runtimes can evaluate Events and create Tasks based on model decisions. This does not amount to first-class autonomous strategy because Arturo lacks:

- a strategic-trigger definition;
- a Proposal schema;
- authority classification;
- evidence attachment and verification;
- isolation from operational Task queues;
- a dedicated post-output strategy gate;
- portfolio conflict and resource checks;
- adoption workflow; and
- origin-preserving evolution history.

Model-generated follow-up work is also constrained by evidence eligibility: unverified model synthesis is excluded from autonomous Runtime learning and follow-up. That is a valuable safety boundary, not an autonomous-strategy feature.

## Levels of strategic autonomy

Use a maturity scale rather than one ambiguous label:

| Level | Capability | Current status |
|---:|---|---|
| 0 | Humans formulate and decide strategy | external to Arturo |
| 1 | AI summarizes supplied strategic evidence | possible, unverified |
| 2 | AI generates bounded options and critiques assumptions | supported advisory pattern |
| 3 | System detects candidate strategic issues from validated evidence | not implemented |
| 4 | System creates governed, evidence-linked proposals | not implemented |
| 5 | System runs isolated simulations and recommends portfolio allocation | not implemented |
| 6 | System executes reversible strategy within pre-authorized limits | not implemented |
| 7 | System changes mission or irreversible commitments autonomously | should remain prohibited or exceptionally governed |

Moving up a level requires evidence and controls, not confidence in a larger model.

## Principal-agent and goal-drift risks

An AI strategic agent may optimize a proxy that differs from organizational purpose. Risks include:

- favoring measurable growth over hard-to-measure trust;
- recommending more AI because AI activity is visible to it;
- hiding uncertainty to increase proposal acceptance;
- shaping future inputs to validate its earlier recommendation;
- accumulating capability and influence;
- optimizing for short-term model-evaluated success;
- excluding stakeholders absent from the prompt; and
- treating legal or ethical constraints as negotiable costs.

Mitigations include hard authority boundaries, independent evidence, stakeholder participation, origin attribution, adversarial review, conflict-of-interest analysis, limited tool access, no self-approval, reversible pilots, and periodic human reconsideration of the objective itself.

## Strategy and Operational Memory

Do not add a model recommendation to Operational Memory as though it were an adopted strategy. Memory entries may influence future Workers.

If a human enters a durable strategic constraint manually, it remains a human assertion rather than a versioned board decision. Arturo lacks effective dates, supersession, approval linkage, document attachment, and conflict resolution for strategic Memory.

Keep authoritative strategy, resolutions, budgets, and commitments in appropriate governed systems.

## Strategy, models, and cost

Arturo now supports opt-in local-first escalation for repeated structured-output schema failure. It does not currently escalate strategic work when evidence, uncertainty, or complexity warrants it. It also lacks:

- task-criticality classification;
- strategic-analysis token budgets;
- paid-model spending approval;
- independent multi-model comparison;
- quality benchmarks;
- provider invoice reconciliation; and
- confidentiality routing by data class.

A future router should consider privacy, evidence, model fitness, cost, latency, and independence. A more expensive model is not automatically more strategically correct.

## Target architecture — non-executable

The following illustrates a possible future interface. **Do not enter these commands in the current CLI.**

```text
# NOT IMPLEMENTED
/strategy issue create --enterprise "Harbour Studio Sandbox" --trigger <validated-evidence-id>

# NOT IMPLEMENTED
/strategy proposal generate <issue-id> --authority advisory-only --include-status-quo

# NOT IMPLEMENTED
/strategy proposal inspect <proposal-id> --show-origin --show-evidence --show-assumptions

# NOT IMPLEMENTED
/strategy proposal red-team <proposal-id> --independent-reviewers 3

# NOT IMPLEMENTED
/strategy simulate <proposal-id> --simulation <validated-simulation-id>

# NOT IMPLEMENTED
/strategy decide <proposal-id> --as <authorized-human-id>

# NOT IMPLEMENTED
/strategy history --enterprise "Harbour Studio Sandbox"
```

A genuine implementation needs authenticated authority, Proposal and Evidence models, immutable origin, independent review, conflict management, portfolio and budget constraints, stakeholder participation, simulation, adoption and rollback workflows, and links to formal organizational decisions.

## Current implementation boundaries

Arturo currently does **not** provide:

- Strategy, Issue, Proposal, Initiative, Portfolio, Budget, Resolution, Commitment, or Outcome entities;
- autonomous strategic issue detection from validated evidence;
- Runtime-originated, evidence-linked configuration proposals;
- origin-preserving proposal and evolution history;
- independent reviewer orchestration or conflict-of-interest controls;
- board, executive, fiduciary, shareholder, member, public, or delegated authority models;
- budgets, resource allocation, hiring, procurement, contracts, partner communication, or roadmap publication;
- strategic simulation, Digital Twin evidence, causal forecasts, market data, competitor intelligence, or customer research;
- automatic adoption, staged execution, rollback, or portfolio monitoring;
- strategy-specific privacy, confidentiality, legal privilege, retention, or disclosure controls; or
- proof that AI-generated options are lawful, ethical, feasible, differentiated, beneficial, or aligned with organizational purpose.

## Common mistakes

**Calling human-prompted option generation autonomous strategy.** A human initiated the question and command.

**Letting the model define both objective and constraints.** It can quietly choose what counts as success.

**Treating pre-execution approval as adoption.** `/approve` only lets the analysis Task run.

**Recording only the recommendation, not origin and evidence.** Future reviewers need to know what was human, model-generated, or verified.

**Asking the same model to red-team itself and calling that independent.** Correlated blind spots remain.

**Omitting the status quo.** Change is not automatically better than deliberate non-change.

**Ignoring opportunity cost.** Every strategic choice consumes scarce attention, money, and capability.

**Adding unapproved strategy to Memory.** It may influence future work without formal adoption.

**Allowing option generation to contact or commit externally.** Advisory analysis has no signing or communication authority.

**Assuming a paid model supplies accountability.** Model quality and organizational authority are separate.

## Design challenge

Using fictional information only:

1. Define one strategic question, time horizon, three options, and a status quo.
2. State non-negotiable constraints and prohibited commitments before model output.
3. Record human authorization for option generation only.
4. Register a uniquely routed advisory Worker and govern its Task.
5. Require sacrifices, assumptions, falsification evidence, and reversible pilots for every option.
6. Build an evidence-to-claim ledger.
7. Red-team the analysis and identify why it is not independent review.
8. Seek affected-stakeholder and specialist evidence outside Arturo.
9. Record a human decision, including deferral or rejection as valid outcomes.
10. Preserve human and AI origin attribution externally.
11. List every commitment requiring separate authority and implementation.

## Chapter summary

Current Arturo supports this governed advisory sequence:

```text
human defines question, options, constraints, and exclusions
      → human authorizes analysis
      → governed AI option-generation Task
      → evidence classification and red-team challenge
      → stakeholder and specialist input
      → accountable human decision
      → separately governed evolution, if any
```

The system may eventually detect and propose strategic issues, but it must never blur proposal with adoption. The more consequential the strategy, the stronger the requirements for authority, evidence, participation, independent challenge, reversibility, and honest attribution.

## Looking ahead

Chapter 36 extends the problem across Federated Enterprise Networks. Independent organizations need explicit protocols, trust, contracts, and shared governance; one Enterprise's strategic model cannot command the rest of the network.
