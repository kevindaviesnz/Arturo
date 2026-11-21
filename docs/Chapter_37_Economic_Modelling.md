# Chapter 37 — Economic Modelling

> **Summary:** Keep exact arithmetic separate from AI explanation.
> Current model-call limits are not a full budget or accounting ledger.

*A token count is not a cost model, a cost model is not a value model, and neither one decides what the Enterprise ought to do.*

## Current versus target architecture

Arturo currently displays a configured model and session-token count and stores Tasks with operational metadata. It does not provide:

- Worker prices or wage rates;
- per-Task monetary cost;
- Enterprise, Function, Product, customer, or project cost attribution;
- budgets or spending limits;
- invoices or provider-billing reconciliation;
- revenue, cash flow, margin, asset, liability, or ledger models;
- pricing or settlement;
- value or externality measurement; or
- monetary budgeting or general quality-based paid-model escalation.

A narrow opt-in local-first router exists for repeated structured-output failure, with a per-session call cap inspectable through `/model-routing`. `/next` can also retry or compare approved model aliases when a user explicitly requests it; paid aliases consume the same cap.

There is no supported `/workers inspect --economics`, `/worker cost-attribution`, or `/health --economics` command.

This chapter demonstrates an advisory economic worksheet using fictional amounts. It is not accounting, financial advice, or a forecast.

## Starting state

The `Harbour Studio Sandbox` has accumulated many AI and Human workflow examples. A sensible question is:

> What would different model-routing approaches cost, and what controls would prevent employees or Runtimes from creating unbounded token spend?

Inspect what Arturo actually exposes:

```text
/overview
/workers
/workers inspect "Studio Optimization Analyst"
/tasks
/task inspect <task-id>
/timeline
```

The footer may show a model such as `Ollama/llama3.2:latest` and `session tokens`. That number is useful operational visibility. It is not necessarily persistent across sessions, provider-rated, currency-denominated, reconciled to an invoice, or attributed to an Enterprise.

## Economic vocabulary

### Fixed cost

Cost that does not change directly with one additional Task over the relevant range:

- hardware purchase or lease;
- base infrastructure;
- salaries;
- security and compliance setup;
- software subscriptions; and
- model evaluation work.

### Variable cost

Cost that changes with usage:

- hosted-model tokens;
- electricity;
- storage and network transfer;
- per-request tools;
- human review time; and
- incident and rework volume.

### Marginal cost

The incremental cost of one additional unit of work. Local inference can have a low marginal cash cost while still consuming scarce compute, electricity, latency, and capacity.

### Opportunity cost

The value of the best alternative use of a scarce resource. A local GPU occupied by low-value work may delay higher-value work.

### Sunk cost

Past cost that cannot be recovered. It should not justify continuing a poor design merely because money has already been spent.

### Externality

A cost or benefit imposed outside the decision-maker's measured account:

- privacy exposure;
- environmental impact;
- user harm;
- accessibility burden;
- human cognitive load; or
- risk transferred to a partner.

### Value

Value is not synonymous with revenue. It may include quality, mission progress, risk reduction, time saved, resilience, learning, public benefit, or avoided harm. Some values should remain constraints rather than be monetized.

## 1. Define the economic decision

This fictional exercise compares two routing policies for 1,000 low-risk text Tasks per month:

- **Option L — local only:** use a local model for every Task.
- **Option H — hosted only:** use a hypothetical paid hosted model for every Task.
- **Option E — escalation:** use local first and escalate 10% of Tasks to the hypothetical hosted model.

No real provider price is used. Replace the assumptions with authoritative quotes, contracts, measured utilization, and invoice data before making a real decision.

## 2. Precommit safety and authority constraints

```text
/create-human-task "Authorize fictional model-economics analysis" "Review a synthetic comparison of local-only, hosted-only, and local-first escalation. Require fictional amounts, independent arithmetic, privacy and quality constraints, no purchasing, no API configuration, and no claim of forecast accuracy."
/complete-human-task <economics-authorization-task-id> "Authorized for advisory analysis only. Cost cannot override privacy, evidence, quality, safety, or human-authority requirements." --as "Studio Decision Owner"
/human-task <economics-authorization-task-id>
```

Create the task first and substitute the returned ID.

## 3. Create an Economic Review capability

```text
/function create "Economic Review Function" --enterprise "Harbour Studio Sandbox" --objective "Compare supplied fictional cost, value, incentive, uncertainty, and externality assumptions without authorizing spending or financial commitments."

/add-ai-worker "Studio Economic Analyst" --archetype analyst
/workers inspect "Studio Economic Analyst"
/workers
```

The Worker is global. Its label does not make it an accountant, economist, financial adviser, procurement officer, or budget owner.

Starting the Function is optional for direct Tasks:

```text
/function start "Economic Review Function"
/function inspect "Economic Review Function"
```

## 4. Build a fictional cost worksheet

All amounts below are invented New Zealand dollar assumptions for teaching only:

```text
Monthly Tasks: 1,000

Local fixed hardware/infrastructure allocation: NZD 300/month
Local variable electricity and operations:      NZD 0.005/Task

Hosted fixed platform cost:                      NZD 0/month
Hosted variable model cost:                      NZD 0.080/Task

Human review rate:                               10% of Tasks
Human review cost assumption:                    NZD 4/review

Escalation rate under Option E:                  10% of Tasks
Local-first attempt still occurs before escalation.
```

These assumptions omit taxes, currency movements, idle capacity, depreciation method, support, security, failure, retries, storage, network, evaluation, procurement, and opportunity cost.

## 5. Run bounded advisory analysis

Do not add an organization-scoped Governance policy to this direct Task merely for presentation. The installation now contains several active Enterprise records, and a direct `/task-cap` Task may have ambiguous Enterprise context. Use the Human authorization above and the unique capability, then record a separate post-output decision.

```text
/task-cap --capability analysis --bounded-task "FICTIONAL ECONOMIC ANALYSIS IN NZD. Tasks=1000/month. Local fixed=300/month; local variable=0.005 per local attempt. Hosted fixed=0; hosted variable=0.080 per hosted Task. Human review=10 percent of Tasks at 4 per review for all options. Option L local only. Option H hosted only. Option E local first for all Tasks and 10 percent also escalate to hosted. Calculate monthly direct cost and cost per Task, show formulas, separate shared human-review cost, test escalation rates 0, 10, 25, and 50 percent, identify omitted costs, quality and privacy constraints, incentive risks, and evidence required. Do not recommend purchasing or claim these assumptions are real."
/task inspect <economics-task-id>
```

The response is unverified model synthesis. Recalculate every number independently.

## 6. Verify the arithmetic

### Shared human-review cost

```text
1,000 Tasks × 10% × NZD 4 = NZD 400/month
```

### Option L — local only

```text
Local cost = 300 + (1,000 × 0.005) = 305
Total including human review = 305 + 400 = NZD 705/month
Cost per Task = 705 / 1,000 = NZD 0.705
```

### Option H — hosted only

```text
Hosted cost = 1,000 × 0.080 = 80
Total including human review = 80 + 400 = NZD 480/month
Cost per Task = 480 / 1,000 = NZD 0.480
```

### Option E — local first with 10% escalation

```text
Local cost = 300 + (1,000 × 0.005) = 305
Hosted escalation cost = 100 × 0.080 = 8
Total including human review = 305 + 8 + 400 = NZD 713/month
Cost per Task = 713 / 1,000 = NZD 0.713
```

Under these fictional assumptions, hosted-only is cheaper. This does not mean hosted-only is better: privacy, quality, reliability, latency, contractual, data-residency, and strategic-control constraints remain unmeasured.

It also demonstrates why “local is free” is misleading. Fixed local costs dominate at this assumed volume.

## 7. Calculate the fictional break-even volume

Ignoring shared human review because it is identical in both options:

```text
Local:  300 + 0.005N
Hosted: 0.080N

300 + 0.005N = 0.080N
300 = 0.075N
N = 4,000 Tasks/month
```

At exactly the assumed rates and utilization, local direct cost equals hosted direct cost around 4,000 Tasks per month. The break-even changes if any input changes, and local capacity may not scale linearly.

## 8. Test escalation sensitivity

For Option E:

```text
Total = local fixed + local variable + hosted escalations + human review
      = 300 + 5 + (1,000 × escalation_rate × 0.080) + 400
```

| Escalation rate | Hosted escalations | Fictional total | Cost per Task |
|---:|---:|---:|---:|
| 0% | 0 | NZD 705 | NZD 0.705 |
| 10% | 100 | NZD 713 | NZD 0.713 |
| 25% | 250 | NZD 725 | NZD 0.725 |
| 50% | 500 | NZD 745 | NZD 0.745 |

Cost rises predictably, but no assumption here measures whether escalation improves output enough to justify it.

## 9. Model quality and risk as constraints

Before comparing price, require evidence for:

- task success and failure definitions;
- groundedness and citation accuracy;
- harmful or prohibited output;
- privacy and confidentiality;
- latency and availability;
- retry and timeout behavior;
- human correction and rework;
- language and accessibility performance;
- domain-specific evaluation;
- prompt-injection resistance;
- data retention and provider terms; and
- incident response.

A cheaper Task that creates more rework or risk may have higher total cost.

Use a total-cost expression:

```text
total economic cost = model and infrastructure
                    + human review and correction
                    + retries and failures
                    + integration and operations
                    + security and compliance
                    + expected incident and harm cost
                    + opportunity cost
                    + externalities
```

Not every harm should be converted into money. Some become hard prohibitions.

## 10. Challenge incentives

```text
/chat "Studio Economic Analyst" "Challenge the fictional model-economics Task. Identify how per-Task budgets, chargeback, quotas, human-review targets, local-first routing, and paid escalation could be gamed. Include rebound effects, hidden rework, cost shifting, quality suppression, privacy externalities, and unfair allocation."
/chat history "Studio Economic Analyst"
```

The answer remains unverified model synthesis.

Possible incentive failures include:

- splitting one task into many budgeted Tasks;
- hiding retries;
- under-reporting tokens or tool calls;
- choosing weak local output to avoid paid escalation;
- escalating everything because another team pays;
- avoiding necessary human review to meet cost targets;
- moving cost into rework or incident response;
- consuming shared local capacity without chargeback;
- gaming value scores; and
- excluding users whose needs are more expensive.

## 11. Cost attribution principles

Attribution answers “who consumed the resource?” Allocation answers “who should bear the cost?” They are not always identical.

Possible rules include:

- direct usage;
- reserved capacity;
- peak demand;
- causal driver;
- equal membership share;
- ability to pay;
- beneficiary pays;
- polluter pays; or
- centrally funded public good.

A shared safety review may benefit the whole Enterprise even when one Function triggered it. Blind usage-based chargeback can discourage socially valuable work.

Current Arturo's global Workers and direct Tasks make Enterprise attribution especially weak. A direct `/task-cap` Task may not be attached to a Business Function Runtime, and the Worker may serve several Enterprises.

## 12. Budgets and spending controls

A production system should support layered budgets:

- per request;
- per Task;
- per Worker;
- per Function;
- per Product or customer;
- per Enterprise;
- per provider and model;
- daily, monthly, and contractual periods; and
- emergency reserve.

Enforcement should occur before and during execution:

1. estimate cost;
2. reserve budget;
3. obtain approval if required;
4. enforce token, time, tool, and retry ceilings;
5. stop or degrade safely;
6. record actual usage;
7. release unused reservation;
8. reconcile against provider data; and
9. alert on anomaly or forecast breach.

The current `APPROVAL_SIGNING_SECRET` protects approval-chain integrity; it does not create a spending budget or verify an invoice.

## 13. Designing local-first paid escalation

The user's desired policy can be stated conceptually:

```text
1. Classify task sensitivity, criticality, and required evidence.
2. Reject tasks no permitted model may handle safely.
3. Try the lowest-cost permitted model that meets minimum capability.
4. Evaluate result using deterministic checks and task-specific evidence.
5. Escalate only on a declared trigger.
6. Obtain spending or data-transfer approval when required.
7. Compare the escalated result rather than blindly replacing the first.
8. Record model, reason, usage, monetary cost, and outcome.
9. Learn routing policy only from verified results.
```

Potential escalation triggers include:

- schema validation failure;
- missing required evidence;
- calibrated uncertainty threshold;
- independent verifier disagreement;
- high-impact classification;
- user-requested expert review;
- local-model unavailability; or
- measured task-specific quality failure.

“The local answer looks weak” is too subjective unless converted into a reviewed rule.

Arturo does not implement this router today.

## 14. Record the accountable conclusion

```text
/create-human-task "Review fictional model-economics analysis" "Review verified arithmetic, assumptions, omitted costs, quality and privacy constraints, escalation sensitivity, incentives, and authoritative evidence requirements. Decide what may be claimed and what further measurement is required."
/complete-human-task <economics-decision-task-id> "Treat all figures as fictional. Measure real local utilization, energy, operations, hosted invoices, quality, retries, rework, and privacy requirements before choosing a routing policy. Implement hard budgets before enabling paid escalation." --as "Studio Decision Owner"
/human-task <economics-decision-task-id>
/timeline
```

Create the task first and substitute the returned ID. The decision does not configure a provider, API key, router, or budget.

## Economic value without false monetization

Use several methods depending on the decision:

- cost-effectiveness: cost per verified useful outcome;
- cost-utility: cost against a declared utility measure;
- return on investment: net measured benefit relative to investment;
- avoided cost: credible reduction in expected loss or workload;
- willingness to pay: observed customer preference, not model invention;
- mission scorecard: non-monetary outcomes and constraints; and
- distributional analysis: who gains and who bears cost.

Avoid fabricated “revenue per AI Task.” Value usually emerges downstream and may be shared across many activities.

## Time, uncertainty, and discounting

Economic decisions span time. A credible model states:

- analysis horizon;
- nominal or real amounts;
- inflation and exchange-rate assumptions;
- discount rate and justification;
- uncertainty ranges;
- scenario probabilities and sources;
- terminal assumptions;
- irreversibility; and
- option value of waiting.

Do not let an LLM invent a discount rate or probability without explicit evidence and ownership.

## Federation economics

Chapter 36's network needs rules for:

- which participant pays for shared infrastructure;
- who pays for retries or malformed requests;
- how AI usage is metered;
- whether safety and accessibility work is a shared public good;
- credits for contributed data or capability;
- penalties and dispute resolution;
- currency, tax, and invoice handling;
- participant exit balances; and
- prevention of free riding and monopoly power.

Current Arturo has no settlement or inter-Enterprise cost model.

## Target architecture — non-executable

The following illustrates a possible future interface. **Do not enter these commands in the current CLI.**

```text
# NOT IMPLEMENTED
/economics rate-card add --provider <provider-id> --model <model-id> --effective <date> --artifact <signed-rate-card>

# NOT IMPLEMENTED
/economics budget set --enterprise "Harbour Studio Sandbox" --period monthly --amount "NZD 500"

# NOT IMPLEMENTED
/economics cost estimate --task <task-id>

# NOT IMPLEMENTED
/economics cost actual --task <task-id> --reconcile-provider

# NOT IMPLEMENTED
/economics attribution report --by enterprise,function,worker,model --period <period>

# NOT IMPLEMENTED
/economics router policy create --local-first --escalate-on <verified-trigger-policy>

# NOT IMPLEMENTED
/economics value evaluate --initiative <initiative-id> --include-externalities

# NOT IMPLEMENTED
/economics anomaly inspect <anomaly-id>
```

A real implementation needs versioned signed prices, usage metering, currency and tax handling, budget reservation, enforcement, reconciliation, attribution, quality evidence, privacy-aware routing, authorization, and audit.

## Current implementation boundaries

Arturo currently does **not** provide:

- Cost, Price, Rate Card, Budget, Reservation, Usage, Invoice, Payment, Revenue, Value, Asset, Liability, or Externality entities;
- token prices, tool prices, wages, infrastructure costs, depreciation, energy, or human-time measurement;
- persistent cross-session monetary usage accounting;
- per-Task, Worker, Function, Product, customer, Enterprise, provider, or federation attribution;
- multi-currency, tax, inflation, discounting, exchange-rate, or accounting-period support;
- estimates, actuals, forecasts, variance, anomaly, invoice, or ledger reconciliation;
- hard token, tool, retry, time, concurrency, or monetary budgets;
- local-first routing, uncertainty-based escalation, spending approval, or provider comparison;
- quality-adjusted cost, causal value, ROI, fairness, distribution, incentive, or externality measurement;
- network pricing, metering, invoice, settlement, credit, penalty, or dispute workflows; or
- proof that a model-generated economic figure is accurate, current, complete, or suitable for a decision.

## Common mistakes

**Calling a local model free.** Hardware, energy, operations, capacity, and risk remain.

**Treating session tokens as an invoice.** They lack durable prices, attribution, currency, and reconciliation.

**Using invented provider prices.** Prices and terms change and must come from authoritative current sources.

**Ignoring human review and rework.** Model cost can be a small part of total cost.

**Comparing price without quality constraints.** Cheap failure can be expensive downstream.

**Monetizing every value.** Rights, safety, dignity, accessibility, and legal duties may be constraints.

**Confusing attribution with allocation.** Usage does not always determine who should pay.

**Letting the consuming team avoid the bill.** Cost shifting creates overuse.

**Using cost targets to suppress escalation.** Employees and models can game budgets by hiding uncertainty.

**Enabling paid models before hard limits.** Retry loops and unrestricted usage can create large bills.

**Treating economic rationale as sufficient authority.** Spending, contracts, and regulated decisions need proper approval.

## Design challenge

Using fictional prices only:

1. Define local-only, hosted-only, and local-first escalation options.
2. List fixed, variable, marginal, opportunity, sunk, and external costs.
3. Record human authorization for advisory analysis.
4. Register a uniquely routed Economic Analyst.
5. Calculate direct cost independently and test volume and escalation sensitivity.
6. Define quality, privacy, reliability, and human-authority constraints.
7. Add rework, retry, incident, and human-review cost categories.
8. Identify incentive and chargeback failure modes.
9. Design layered budget reservation, enforcement, and reconciliation.
10. Define objective paid-escalation triggers.
11. Record a human conclusion that distinguishes fictional assumptions from measured evidence.

## Chapter summary

Current Arturo supports only an advisory pattern:

```text
define fictional assumptions → authorize analysis → bounded Economic Analyst Task
                             → verify arithmetic → test sensitivity
                             → add quality, risk, incentives, and externalities
                             → human conclusion → no automatic spending action
```

Economic discipline requires authoritative rates, measured usage, full cost, explicit value, hard constraints, fair attribution, aligned incentives, budgets, reconciliation, and accountable choice. The most important lesson is simple: optimize total verified value within constraints—not tokens, Tasks, or apparent price in isolation.

## Looking ahead

Chapter 38 combines evolution, migration, scenario analysis, snapshot fidelity, optimization, strategy, federation, and economics into the idea of a Self-Improving Enterprise. The central question will be which learning loops are verified and governed, and which are merely self-reinforcing model output.
