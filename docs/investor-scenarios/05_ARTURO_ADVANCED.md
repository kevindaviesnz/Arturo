# Level 5 — Arturo

## Advanced investor and technical-diligence demonstration

**Time:** approximately twenty-five minutes plus questions.

**Purpose:** combine Arturo's operating primitives in a counterfactual
reconstruction of its own development.

This is the final scenario, not the opening demo. Run it only after the
audience understands the simpler Enterprise, Worker, Function, Event, Governance,
and collaboration examples.

## Mandatory disclosure

Open with:

> This is a counterfactual reconstruction using real development experiences.
> It shows how Arturo would have organised the work if it had existed at the
> beginning. It is not a claim that Arturo historically built itself.

## Start isolated state

From `cli/`:

```bash
mkdir -p .data/investor-05-arturo
ARTURO_DATA_DIRECTORY=.data/investor-05-arturo \
ARTURO_RUNTIME_DATABASE_PATH=.data/investor-05-arturo/runtime.db \
npm run ui
```

## Demonstration sequence

### 1. Establish Arturo as an Enterprise

```text
/enterprise create "Arturo" --mission "Build and operate the governed operating system for AI-native companies."
/enterprise inspect "Arturo"
```

### 2. Ask for advisory organisational guidance

```text
/next "Arturo"
```

Review a few recommendations and answer `no`. Explain that model advice does
not silently alter the organisation.

If external routing is configured and explicitly authorised, choose that model
first with `/model` — it is the only place the model is chosen, and the choice
holds until you run it again:

```text
/model
/next "Arturo" --feedback "Arturo is in private investor and design-partner evaluation. Recommend only independent capabilities required for product validation and a later controlled pilot. Do not assume customers, production infrastructure, or a public developer ecosystem."
```

Again answer `no`.

### 3. Declare the reviewed operating model

```text
/function create "Product Strategy" --enterprise "Arturo" --objective "Turn Arturo's mission, user experience, and operating evidence into bounded product priorities with explicit trade-offs."
/function create "Runtime Engineering" --enterprise "Arturo" --objective "Design and implement Arturo's execution runtime while preserving deterministic controls, inspectability, and failure recovery."
/function create "Quality and Verification" --enterprise "Arturo" --objective "Reproduce defects, challenge product claims, verify supported behaviour, and define observable completion evidence."
/function create "Security and Governance" --enterprise "Arturo" --objective "Protect trust boundaries and ensure consequential AI work remains constrained by deterministic policy and accountable humans."
/function create "Documentation and Education" --enterprise "Arturo" --objective "Keep commands, examples, limitations, and teaching guidance aligned with implemented behaviour."
/function create "Investor Readiness" --enterprise "Arturo" --objective "Present Arturo's value, evidence, limitations, commercial hypotheses, milestones, and funding needs accurately."
```

### 4. Add execution capacity and Human authority

```text
/add-human-worker
```

Name them `Founder` and choose the role that signs off.

```text
/staff
```

Accept the AI Workers Arturo proposes across the six Functions. The plan is
model-generated: the names and the number vary between runs, and Arturo notes
any capability a plan leaves uncovered. Registering a Worker does not put it to
work — `/staff` is what assigns Workers to the Functions that own the outcomes.

```text
/workers
```

### 5. Start relevant Functions

```text
/function start "Product Strategy"
/function start "Quality and Verification"
/function start "Documentation and Education"
```

### 6. Publish a reconstructed historical signal

```text
/event publish "Historical staffing plan validation failures reconstructed for product review" --source "Quality and Verification" --enterprise "Arturo"
/tasks
```

Explain that generated wording may be imperfect and that generated Tasks are
not claims that code was changed.

### 7. Govern a controlled analysis

```text
/governance
```

Choose `1` and answer: the rule is `Historical product conclusions require
founder review`, it should **wait for a person to say yes**, it covers
**analysis** work, and it applies to **every task of that kind**.

```text
/task create "Compare the conventional response to Arturo's historical staffing-plan validation failures with the response an Arturo-operated company would use. Treat Arturo as a software Enterprise and product, not a person. Treat staffing-plan validation as a software workflow defect, not human-resources workforce planning. Identify ownership, verification, documentation, governance, and learning gaps. Use only supplied context and label assumptions."
/tasks
```

Wait until the Task shows **Awaiting approval** — the approval chain is created
when the runtime picks the Task up, a moment after it is queued.

```text
/approvals
```

Copy the Task ID:

```text
/approve <task-id>
/approval-status <task-id>
/task inspect <task-id>
```

Inspect the answer critically. Approval permitted execution; it did not approve
the answer.

### 8. Preserve the founder's claim decision

```text
/create-human-task "Decide the Arturo Builds Arturo demo claim" "Decide what may be presented to investors and record the required counterfactual disclosure."
/human-tasks
/complete-human-task <human-task-id> "Approved claim: this is a counterfactual reconstruction using real development experiences. It must not be presented as literal history." --as "Founder"
/human-task <human-task-id>
```

### 9. Finish with operating evidence

```text
/overview
/events
/tasks
/timeline
/model-routing
```

## Closing statement

Say:

> The earlier scenarios showed individual Arturo capabilities. This final
> scenario shows them operating as a system: organisational ownership,
> event-driven work, replaceable AI capacity, deterministic Governance, Human
> authority, evidence labels, audit history, and economically bounded model
> choice.

> Arturo is currently a private Phase 2 evaluation build, not a production
> multi-tenant service. The next objective is a controlled commercial pilot
> supported by stronger identity, deployment isolation, persistent cost
> attribution, integrations, durable Artefacts, and evaluator evidence.

## Further reading

- [Arturo Builds Arturo reconstruction](../ARTURO_BUILDS_ARTURO.md)

## Investor takeaway

Arturo is an organisational control plane for governed AI-native operations,
not a claim that model-generated text is automatically correct or autonomous.
