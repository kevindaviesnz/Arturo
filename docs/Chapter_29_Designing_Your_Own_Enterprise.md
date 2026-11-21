# Chapter 29 — Designing Your Own Enterprise

> **Summary:** This chapter combines the supported building blocks
> so you can design a small, safe Arturo Enterprise of your own.

*The capstone is not a diagram. It is a small Enterprise you can build, exercise, inspect, and challenge honestly.*

## What this chapter proves

This chapter brings together the currently supported Arturo workflow:

```text
Enterprise → Business Functions → Runtimes → Workers → Tasks
                                      │            │
                                      ├─ Events    ├─ Governance and approval
                                      ├─ Health    └─ Results and provenance
                                      │
                                      └─ Memory, delegation, Human Tasks, chat, timeline
```

It does not prove that the resulting organization is production-ready, autonomous, secure, compliant, profitable, or correct. Arturo coordinates model and human work; the quality of the organization still depends on sound objectives, authoritative evidence, appropriate humans, deterministic controls, security, integrations, and operational discipline.

Use fictional or non-sensitive information for this capstone.

## Before you begin

Arturo persists state. The examples below add to whatever already exists; they do not reset Koru Kids, Koru Labs, Workers, Tasks, policies, Memory, Events, or Human Tasks created in earlier chapters.

Inspect the starting state:

```text
/overview
/enterprise list
/function list
/workers
/tasks
/governance
/approvals
/human-tasks
```

The generated IDs are currently machine-oriented identifiers such as `enterprise-3:function-1` and UUIDs. Names are usually easier to type where commands accept them, but names do not replace stable IDs and are not guaranteed to be unique in every store.

## 1. Create the Enterprise

This walkthrough uses a harmless fictional content-design organization:

```text
/enterprise create "Harbour Studio Sandbox" --mission "Turn supplied, non-sensitive source material into clear draft resources with visible evidence and human review boundaries."
/enterprise inspect "Harbour Studio Sandbox"
```

The Enterprise record provides identity and mission. Arturo does not currently have a separate Product entity, product lifecycle, customer model, revenue model, or product-health model. Describe proposed Products in your external design notes; do not claim Arturo has created them.

## 2. Create enduring Business Functions

Use explicit Objectives rather than repeating a generic description:

```text
/function create "Source Evidence Function" --enterprise "Harbour Studio Sandbox" --objective "Separate supplied source claims from assumptions and identify missing evidence."

/function create "Resource Design Function" --enterprise "Harbour Studio Sandbox" --objective "Create clear draft resources from supplied, non-sensitive source material and stated constraints."

/function create "Quality Review Function" --enterprise "Harbour Studio Sandbox" --objective "Review drafts for accuracy, clarity, accessibility, provenance, risk, and completeness."

/function create "Human Decision Function" --enterprise "Harbour Studio Sandbox" --objective "Route consequential release questions to an authorized human and preserve the recorded response."
```

Verify each definition:

```text
/enterprise inspect "Harbour Studio Sandbox"
/function inspect "Source Evidence Function"
/function inspect "Resource Design Function"
/function inspect "Quality Review Function"
/function inspect "Human Decision Function"
/function list
```

A Business Function is initially `declared`. Creating it does not automatically start a Runtime, assign a Worker, or produce work.

## 3. Register bounded Workers

```text
/add-ai-worker "Studio Evidence Researcher" --archetype researcher
/add-ai-worker "Studio Resource Drafter" --archetype creator
/add-ai-worker "Studio Quality Reviewer" --archetype reviewer
/add-human-worker "Studio Decision Owner" --archetype guardian --availability available
/workers
```

Inspect capability routing:

```text
/workers inspect "Studio Evidence Researcher"
/workers
/workers
/workers
```

AI archetypes deterministically provide capabilities and prompt guardrails. They do not prove expertise or output quality. Human Worker records do not verify identity, employment, authority, availability, or competence. Arturo currently supports AI and Human Workers, not physical equipment or service accounts as executable Worker types.

Workers are currently held in a global registry rather than being owned or isolated by an Enterprise. `/task-cap` selects the first available AI Worker matching the requested capability. In the accumulated tutorial state, an earlier Worker may therefore be selected instead of the newly registered Studio Worker. Always read `selected worker`, `Worker`, and `Routing` in the command output; do not infer Enterprise isolation from a Worker's name.

## 4. Start only the Runtimes you need

```text
/function start "Source Evidence Function"
/function start "Resource Design Function"
/function start "Quality Review Function"
/function inspect "Source Evidence Function"
/function list
```

Runtimes evaluate Events and may create Tasks. Their interpretation is model-driven, so it is not a deterministic rule engine or guaranteed workflow. `Human Decision Function` can remain declared because Human Tasks are created explicitly in this exercise.

## 5. Add one safe, durable constraint

```text
/memory add "Draft resources must distinguish supplied facts from assumptions and recommendations." --scope "Quality Review Function"
/memory
```

Manual Memory is a human-entered assertion, not independently verified truth. It may be supplied to later Workers in the relevant scope. Never use Operational Memory for secrets, personal data, credentials, raw evidence, regulated records, or claims that need structured provenance.

If the constraint becomes wrong or obsolete, remove it using the displayed ID:

```text
/memory remove <memory-id>
```

## 6. Publish a bounded Event

```text
/event publish "Synthetic source pack submitted for studio review" --source "Source Evidence Function" --enterprise "Harbour Studio Sandbox"
/events
/tasks
```

Every running Runtime in the named Enterprise may evaluate a published Event. Zero, one, or several Tasks may result depending on its Objective, model response, routing, and available Workers. Event evaluation is not guaranteed to produce the same conclusion on every run. Enterprise-based Event targeting is routing behavior, not a complete tenant-security boundary; use only synthetic input and inspect every Runtime evaluation shown after publication.

For a predictable demonstration of capability routing, create Tasks directly:

```text
/task-cap --capability research --bounded-task "Using only this supplied fictional statement—'shorter instructions improved completion in one informal trial'—separate the observation from conclusions and list missing evidence."

/task-cap --capability writing --bounded-task "Draft a one-page internal guide explaining how to label supplied facts, assumptions, and recommendations. Do not invent sources or claim publication."
/tasks
```

Inspect the returned IDs:

```text
/task inspect <research-task-id>
/task inspect <writing-task-id>
```

Model results commonly show `Unverified model synthesis` and `External tools used: none`. Completion means the Worker returned output—not that the claims are true, the work was externally performed, or the resource is ready to release.

The selected Workers may be earlier globally registered Workers with the same capabilities. This is expected current behavior, not staffing proof for `Harbour Studio Sandbox`.

## 7. Apply Governance and approval

Add a supported capability-based gate:

```text
/governance policy add "Studio quality review requires approval" --effect require-approval --capability "review"
/governance policy inspect "Studio quality review requires approval"
/task-cap --capability review --bounded-task "Review the draft internal guide for unsupported claims, missing provenance, accessibility barriers, and ambiguous release language."
/approvals
```

The review Task should be `awaiting_approval`. Approve it using its ID:

```text
/approve <review-task-id>
/approval-status <review-task-id>
/task inspect <review-task-id>
```

`/approve` authorizes the queued Task to execute. It does not approve the result produced afterward. Configure a unique, non-placeholder `APPROVAL_SIGNING_SECRET` of at least 32 characters, or a valid `APPROVAL_SIGNING_SECRET_FILE`, and never commit it.

The current policy CLI matches attributes such as capability and applies effects such as `require-approval`. Thresholds, compound conditions, named sequential approvers, role verification, separation of duties, time windows, and post-output release approval require further implementation.

## 8. Record the post-output human decision

```text
/create-human-task "Decide whether the synthetic studio guide may be used" "Review the draft and AI review. Record required changes, evidence limitations, and whether the guide remains internal-only."
/human-tasks
/human-task <human-task-id>
/complete-human-task <human-task-id> "Keep internal-only. Add source references, accessibility review, version ownership, and a clear statement that recommendations require human verification." --as "Studio Decision Owner"
/human-task <human-task-id>
```

Terminal Human Tasks work without browser-link signing. `HUMAN_TASK_TOKEN_SECRET` is needed only for signed browser links. A standalone Human Task is not automatically linked to the earlier Tasks, a resource version, release artifact, or policy decision.

## 9. Delegate bounded work between Functions

The receiving Function must have a running Runtime. `Quality Review Function` was started earlier, and at least one compatible AI reviewer exists in the global Worker registry:

```text
/delegation request "Prepare a checklist for distinguishing supplied evidence from unsupported claims" --from "Resource Design Function" --to "Quality Review Function"
/delegation list
/delegation inspect <delegation-id>
/task inspect <delegated-task-id>
```

Delegation creates a persisted Task and retains accountability with the sending Function. Routing may select an earlier globally registered compatible Worker unless Runtime history or a staffing assignment supplies a more specific route. Completion returns model output carrying its evidence label. Cross-Enterprise delegation is not supported by the current CLI.

## 10. Talk to a Worker without granting action

```text
/chat "Studio Quality Reviewer" "Based only on the Arturo records available to you, summarize unresolved quality limitations and distinguish records from model inference."
/chat history "Studio Quality Reviewer"
```

Worker chat is read-only. It performs no email, publication, file modification, external messaging, or other action. A later reply such as `yes` is not currently treated as a conversational continuation that executes the Worker's suggestion; repeat the full `/chat` command when you need another response.

Clear the conversation if it is no longer useful:

```text
/chat clear "Studio Quality Reviewer"
```

## 11. Inspect Health and evidence

```text
/function inspect "Source Evidence Function"
/function inspect "Resource Design Function"
/function inspect "Quality Review Function"
/health "Quality Review Function"
/tasks
/memory
```

Health is computed from Arturo's available operational evidence. It is not product quality, customer value, financial performance, safety, compliance, or truth. Unverified outputs are excluded from autonomous learning; quarantined Memory is excluded from Worker context.

## 12. Reconstruct Arturo's internal trail

```text
/events
/timeline
/governance policy list
/approvals
/human-tasks
/delegation list
```

This reconstructs actions recorded inside Arturo: Event publication, Task lifecycle, routing, policy evaluation, approval, Human Task decisions, and delegation. It does not prove completeness, immutability, actor identity, external action, artifact lineage, legal retention, or compliance. Auditability must be designed and tested explicitly; it does not automatically emerge from having several logs.

## Supported today versus design work

| Concern | Current Arturo support | Still required for production |
|---|---|---|
| Enterprise identity | Persisted name, mission, status, generated ID | Tenant isolation, ownership, authorization, lifecycle controls |
| Business Functions | Definitions, Objectives, optional Runtimes | Valid operating model, deterministic integrations and controls |
| Workers | Global AI and Human records, archetype capabilities | Enterprise ownership and isolation, identity, authority, credentials, availability, tool permissions |
| Tasks | Queue, routing, lifecycle, output, provenance labels | SLAs, retries, idempotency, artifact handling, stronger execution isolation |
| Governance | Capability matching and approval effects | Rich policy conditions, roles, separation of duties, simulation, versioning |
| Approval | Signed pre-execution Task decision | Authenticated organizational authority and post-output release control |
| Human Tasks | Persisted terminal workflow and optional signed links | Structured linkage, assignment, notifications, access control, deadlines |
| Memory | Scoped manual and model-derived entries with eligibility labels | Confidentiality, structured evidence, retention, correction, review workflows |
| Events and timeline | Arturo-recorded operational history | Tamper evidence, completeness, external correlation, retention, audit assurance |
| Delegation | Persisted same-Enterprise Task-backed requests | Cross-Enterprise trust, contracts, schemas, authentication, delivery guarantees |
| Worker chat | Read-only, recorded model conversation | Threaded continuation, action proposals, approvals, tool execution, messaging |
| Health | Operational indicators from available Arturo evidence | Domain metrics, validated criteria, Enterprise and Product health |
| Models and cost | Worker model selection and session-token visibility | Automatic cheapest-model routing, escalation rules, hard budgets, billing reconciliation |
| Products | Conceptual only | Product entity, ownership, lifecycle, customers, releases, Product Health |

## The capstone review

Before describing the Enterprise to a colleague, customer, or investor, answer these questions with evidence:

1. Which commands were actually run, and which ideas remain architectural?
2. Which outputs are model synthesis, human-entered assertions, approved decisions, or externally verified evidence?
3. What can a Worker read, and what can it actually do?
4. Which actions are deterministic, and which depend on model interpretation?
5. What requires approval before execution, and what requires human review after output?
6. What sensitive information is prohibited from Arturo?
7. Which external systems and trust boundaries are missing?
8. What happens when a model, Worker Runtime, secret, database, or external dependency fails?
9. What does Health genuinely measure, and what must it not be used to claim?
10. Can an independent reviewer trace the decision and identify everything the Arturo trail does not contain?
11. What is the cost ceiling, and who may authorize use of a paid model or external tool?
12. Which cleanup, retention, correction, and incident-response processes exist outside the demo?

If an answer relies on “the AI will work it out,” it is not yet an operating control.

## Ending state

You now have a small but real Arturo Enterprise: four Business Functions, three running Runtimes, bounded AI and Human Workers, Tasks, a capability-based approval gate, a recorded human decision, scoped non-personal Memory, an Event, a persisted delegation, read-only Worker chat, operational Health, and an inspectable internal timeline.

Just as importantly, you have a precise list of what remains unimplemented. That honesty is not a weakness in an investor demonstration. It shows that Arturo's valuable foundations—organizational capability, governed execution, human participation, evidence labels, and operational traceability—are being built without confusing fluent model output with authority, proof, or completed external work.
