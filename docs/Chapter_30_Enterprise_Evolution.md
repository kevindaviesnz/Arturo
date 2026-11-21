# Chapter 30 — Enterprise Evolution

> **Summary:** Companies change. Make changes in small, visible
> steps, keep Human authority, and preserve what happened. Some richer change
> controls in this chapter are future design.

*An AI-native Enterprise must change without pretending that every change is safe, reversible, or automatically governed.*

## Starting state

Chapter 29 built a functioning `Harbour Studio Sandbox`. This chapter evolves that design in response to a new requirement: every draft resource must undergo a dedicated accessibility review before a human considers release.

If you did not run Chapter 29, either complete it first or substitute the names and IDs from your own Enterprise. Continue to use fictional, non-sensitive information.

Inspect the current state before changing it:

```text
/overview
/enterprise inspect "Harbour Studio Sandbox"
/function list
/workers
/governance policy list
/memory
/tasks
/events
/timeline
```

This baseline matters because Arturo does not currently create a snapshot automatically before configuration changes.

## What Enterprise evolution means

Evolution is a controlled change to one or more parts of the operating system:

- the Enterprise's description;
- its collection of Business Functions;
- explanatory Function descriptions;
- active or paused Runtimes;
- available Workers and their capabilities;
- Governance policies;
- eligible Operational Memory;
- Event vocabulary and Task-routing behavior; or
- the human decisions surrounding those changes.

Not all of these have the same risk. Adding a dormant Function is different from changing an Objective used by a running Runtime. Pausing a Runtime is different from deleting its history. Updating prose is different from changing an Event contract consumed elsewhere.

Arturo's current implementation supports only part of that lifecycle. The chapter therefore separates executable evolution from target architecture.

## A practical change classification

Classify a proposed change before applying it:

| Change class | Example | Current Arturo support | Principal risk |
|---|---|---|---|
| Observational | Inspect Health and Tasks | Supported | Misinterpreting incomplete evidence |
| Descriptive | Update Enterprise or Function description | Supported | Prose diverges from the actual Objective or behavior |
| Additive | Add a Function, Worker, policy, or Memory entry | Supported | Duplicate capability, global Worker collisions, unexpected routing |
| Operational | Start, pause, resume, or stop a Runtime | Supported | Queued work, missed Events, unclear recovery semantics |
| Subtractive | Remove a policy or Memory entry | Partly supported | Removing a control or useful constraint without dependency analysis |
| Structural | Split, merge, rename, retire, or re-own a Function | Not implemented as a governed lifecycle | Broken dependencies and lost intent |
| Contractual | Change Event or delegation schemas | Not versioned | Silent consumer breakage |
| Data migration | Transform persisted Tasks, Events, Memory, or IDs | No migration framework | Corruption, incompatibility, incomplete rollback |

The last three classes belong primarily to Chapter 31's target architecture.

## Principle 1: Preserve identity deliberately

An Enterprise can change how it works while retaining a stable purpose. In the current CLI, `/enterprise update` can change only the description. Do not run it yet; first record the proposal and decision below.

The update command does not rename the Enterprise, change its mission, change its ID, or create a historical version. Its `Updated` timestamp changes, but Arturo does not preserve the earlier description as a queryable revision.

If the underlying mission truly changes, decide whether this is still the same Enterprise before editing external design records. The current CLI offers no governed mission-change or Enterprise-successor workflow.

## Principle 2: Propose before mutating

Configuration mutations such as `/function create`, `/function update`, `/enterprise update`, and policy removal are not themselves routed through Arturo's Task approval gate. `/approve` governs queued Tasks, not administrative configuration commands.

Use a Human Task to record a proposal and decision before applying a material change:

```text
/create-human-task "Review accessibility capability proposal" "Decide whether Harbour Studio Sandbox should add a dedicated Accessibility Review Function. Consider overlap with Quality Review, required evidence, Worker capability, Governance, rollout, and rollback."
/human-tasks
/human-task <proposal-task-id>
/complete-human-task <proposal-task-id> "Approved for a synthetic pilot. Add a separate Function and Worker, require pre-execution review approval, keep final release human-owned, and review routing after the pilot." --as "Studio Decision Owner"
/human-task <proposal-task-id>
```

This records a human response but does not apply the proposed change. A standalone Human Task also lacks a structured link to the later configuration commands. Preserve the relationship in an external change record until Arturo supports first-class change proposals.

After the proposal is approved, update the descriptive context and verify it:

```text
/enterprise update "Harbour Studio Sandbox" --description "A fictional studio sandbox that turns supplied source material into draft resources with dedicated evidence, quality, accessibility, and human review."
/enterprise inspect "Harbour Studio Sandbox"
```

## Principle 3: Prefer additive evolution first

Add the new capability without deleting or silently repurposing the existing Quality Review Function:

```text
/function create "Accessibility Review Function" --enterprise "Harbour Studio Sandbox" --objective "Review synthetic draft resources for accessibility barriers, missing user evidence, and unresolved accommodation questions."
/function inspect "Accessibility Review Function"
/function list
```

The new Function starts as `declared`. At this point the architecture has changed, but no Runtime is evaluating Events for it.

Why add before replacing?

- Existing Functions and Tasks remain inspectable.
- The new capability can be piloted independently.
- Its Objective can be compared with Quality Review for overlap.
- A Runtime can be paused if behavior is unsuitable.
- No unsupported delete or retirement command is required.

Add a specifically routable AI Worker:

```text
/add-ai-worker "Studio Accessibility Reviewer" --archetype reviewer
/workers inspect "Studio Accessibility Reviewer"
/workers
```

The primary registration command grants the standard `review` capability.
The Worker name describes its intended focus, but does not create a custom
capability or prove accessibility expertise.

## Principle 4: Start with a bounded pilot

Start the new Runtime and inspect it before publishing an Event:

```text
/function start "Accessibility Review Function"
/function inspect "Accessibility Review Function"
/function list
```

Run a direct, synthetic pilot Task:

```text
/task-cap --capability review --bounded-task "Review this fictional instruction—'Click the green button to continue'—for accessibility barriers. Identify missing context and user testing; do not claim conformance."
/tasks
/task inspect <pilot-task-id>
```

The result remains model synthesis, normally with `External tools used: none`. It is not an accessibility audit, conformance report, user test, or release approval.

## Principle 5: Add Governance explicitly

Add a capability-based approval gate:

```text
/governance policy add "Studio accessibility review requires approval" --effect require-approval --capability "review"
/governance policy inspect "Studio accessibility review requires approval"
```

Run a second pilot to exercise the new policy:

```text
/task-cap --capability review --bounded-task "Review the revised fictional instruction—'Choose Continue to move to the next step'—for remaining accessibility questions and missing evidence."
/approvals
/approve <governed-task-id>
/approval-status <governed-task-id>
/task inspect <governed-task-id>
```

The first pilot occurred before the policy existed; adding a policy does not retroactively govern completed Tasks. The second approval permits the Task to execute but does not approve its output afterward.

Configure a unique, non-placeholder `APPROVAL_SIGNING_SECRET` of at least 32 characters, or a valid `APPROVAL_SIGNING_SECRET_FILE`, before recording approvals. Never commit signing secrets.

## Principle 6: Preserve post-output human authority

Record the pilot decision after inspecting the result:

```text
/create-human-task "Evaluate accessibility pilot" "Review the synthetic Accessibility Review output. Decide whether the capability should remain active, what evidence is missing, and whether its output may affect release decisions."
/complete-human-task <pilot-review-task-id> "Keep the pilot active for advisory review only. Require testing with affected users and a qualified human before any release decision." --as "Studio Decision Owner"
/human-task <pilot-review-task-id>
```

Create the Human Task first with `/create-human-task`; replace `<pilot-review-task-id>` with the returned ID. Human Tasks do not currently assign configuration changes, enforce follow-up, or connect structurally to the Runtime and policy.

## Principle 7: Evolve Memory conservatively

Add a non-sensitive, non-result constraint scoped to the new Function:

```text
/memory add "Accessibility reviews must distinguish model observations from evidence obtained from affected users." --scope "Accessibility Review Function"
/memory
```

Manual Memory is not independently verified. It may influence later Worker context, so review it as carefully as code or policy.

If the wording proves harmful or obsolete, remove the exact entry by ID:

```text
/memory remove <accessibility-memory-id>
```

Removal changes future context eligibility; it does not erase the Event history showing that Memory was added, nor does it remove text already copied into prior Task prompts or outputs.

## Principle 8: Treat Runtime lifecycle as an operational control

The primary terminal supports starting and inspecting a Runtime, but not
pausing it. The low-level developer surface shown by `/help all` includes
pause, resume, and stop commands. Use them only for development or a carefully
controlled local exercise.

They require the Runtime ID displayed by `/function inspect`, not the Business
Function definition ID:

```text
/function inspect "Accessibility Review Function"
/pause-function <accessibility-runtime-id>
/function inspect "Accessibility Review Function"
/resume-function <accessibility-runtime-id>
/function inspect "Accessibility Review Function"
```

Pausing prevents that Runtime from evaluating new Events while preserving its definition and history. It does not cancel or roll back Tasks already created, revoke Worker access, remove policies, or undo outputs.

`/stop-function <runtime-id>` is also supported, but stopping is not archival retirement. The Business Function definition remains, and the current CLI does not perform dependency checks before the transition.

## Principle 9: Refine descriptions without pretending Objectives changed

The current update command changes a Function's description only:

```text
/function update "Quality Review Function" --description "Reviews synthetic drafts for general accuracy, clarity, provenance, risk, and completeness while dedicated accessibility questions route separately."
/function inspect "Quality Review Function"
```

The Objective remains the Objective created earlier. If the new description contradicts it, Arturo will display inconsistent organizational intent. There is currently no supported `/function update --objective`, rename, split, merge, or version command.

For a material Objective change, create a proposed successor Function and keep both definitions visible while dependencies are assessed. Chapter 31 explains the versioning and migration architecture that would be required; most of its commands are not yet implemented.

## Principle 10: Test Event behavior after evolution

Publish a synthetic Event only after the new Runtime and Governance are visible:

```text
/event publish "Revised synthetic guide submitted after accessibility capability pilot" --source "Resource Design Function" --enterprise "Harbour Studio Sandbox"
/events
/tasks
/timeline
```

Every running Runtime in the named Enterprise may evaluate the Event. The new Accessibility Runtime may create a Task, but model-driven evaluation is not a guaranteed subscription or deterministic routing rule. Inspect the `Runtime evaluations` section rather than assuming the new capability participated.

If exact Event consumers, schemas, required fields, versions, delivery guarantees, and retry behavior matter, implement and test them outside the current free-text Event mechanism.

## Measuring the change without fooling yourself

Compare operational evidence before and after the pilot:

```text
/function inspect "Accessibility Review Function"
/health "Accessibility Review Function"
/tasks
/approvals
/human-tasks
/memory
/events
/timeline
```

Useful questions include:

1. Did the intended capability route to the intended Worker?
2. Did the new policy block the second Task before execution?
3. Did the human decision occur after output as well as approval before execution?
4. Did the new Runtime create duplicate or irrelevant Tasks from Events?
5. Did model output distinguish evidence from inference?
6. Did any existing Runtime or Worker behavior change unexpectedly?
7. What does the timeline omit about the configuration change?

Arturo Health cannot answer whether the evolution improved accessibility, customer outcomes, cost, safety, or commercial performance. It reports only the operational evidence currently modeled.

## Removing a pilot control safely

Arturo supports policy removal:

```text
/governance policy list
/governance policy remove "Studio accessibility review requires approval"
/governance policy list
```

Do not run that sequence merely to tidy the demo. Removing the policy immediately changes Governance for future matching Tasks and is not itself approval-gated. First record why the control is being removed, identify affected work, and decide what replaces it.

There is no equivalent supported command to delete or archive a Business Function, Enterprise, Worker, Task, Event, approval decision, delegation, or Human Task. That limitation favors preservation, but it is not a complete retention or records-management policy.

## The missing evolution ledger

The timeline captures many operational Events, but it is not a complete configuration history. Do not assume it records old and new values for every Enterprise description, Function description, Worker registration, Runtime transition, policy mutation, or Memory mutation.

Until first-class evolution records exist, maintain an external change ledger containing:

- change identifier and timestamp;
- proposer and accountable decision owner;
- reason and expected outcome;
- exact before-state and proposed after-state;
- affected Enterprises, Functions, Runtimes, Workers, policies, Memory, Events, and external systems;
- evidence and assumptions;
- privacy, security, legal, ethical, operational, financial, and technical risks;
- test and acceptance criteria;
- rollout sequence and observation window;
- rollback or containment plan;
- actual outcome and unexpected effects; and
- final decision to retain, revise, pause, or supersede the change.

## Current implementation boundaries

Arturo currently does **not** provide:

- first-class change proposals linked to configuration mutations;
- automatic approval gates for administrative commands;
- versioned Enterprise, Function, Objective, policy, Memory, Worker, Event, or Runtime definitions;
- before-and-after diffs, snapshots, branches, staged environments, promotion, or rollback;
- dependency graphs showing Event consumers, delegation clients, Memory users, or affected external systems;
- Function rename, Objective update, split, merge, archive, retirement, successor, or deletion workflows;
- Enterprise rename, mission evolution, archive, successor, or deletion workflows;
- Worker ownership by Enterprise, replacement migration, decommissioning, or revocation workflows;
- Event schemas, compatibility checks, consumer versions, dual publishing, or migration deadlines;
- Task draining, cancellation, replay, idempotent migration, or rollback of model side effects;
- automatic comparison of pre-change and post-change outcomes; or
- a tamper-evident, complete configuration audit ledger.

## Common mistakes

**Changing production behavior without a baseline.** Without before-state evidence, improvement and regression are indistinguishable from memory and optimism.

**Assuming `/approve` governs configuration changes.** Current approval gates apply to Tasks, not administrative mutation commands.

**Editing a description as though it changed the Objective.** The fields are separate, and contradictory text creates ambiguity rather than evolution.

**Adding capability without checking overlap.** A new Function can duplicate an existing Objective and cause several Runtimes to create similar Tasks.

**Assuming a new Worker belongs to the new Enterprise.** Workers are global and may be selected elsewhere by capability.

**Adding Governance after the first consequential Task.** Policies are not retroactive.

**Treating pause as rollback.** Pausing affects future Runtime evaluation; it does not undo Tasks, outputs, Memory, or Events.

**Removing a policy as cleanup.** Policy removal changes future authorization and requires its own governed organizational decision.

**Treating the timeline as a complete change ledger.** Operational Events do not preserve every configuration diff or external consequence.

**Silently changing Event meaning.** Free-text labels have no versioned schema or compatibility protection.

## Design challenge

Evolve an Enterprise of your own using synthetic data:

1. Capture its baseline with inspect and list commands.
2. Classify the proposed change using the seven change classes above.
3. Record a Human Task proposal before mutating configuration.
4. Prefer an additive Function or Worker pilot over silently repurposing an existing capability.
5. Add Governance before the first governed pilot Task.
6. Define pre-change and post-change evidence, plus a containment or rollback plan.
7. Exercise pause and resume using the Runtime ID.
8. Publish a bounded Event and inspect every Runtime evaluation.
9. Identify which facts Arturo recorded and which require an external evolution ledger.
10. Decide explicitly whether to retain, revise, pause, or supersede the pilot.

## Chapter summary

Safe Enterprise evolution is not unrestricted self-modification. In current Arturo it is a disciplined sequence:

```text
Inspect → classify → propose → human decision → add → govern → pilot
       → inspect evidence → pause or retain → record limitations
```

The executable pieces are useful: additive Functions and Workers, explicit Runtimes, capability-based Governance, Human Tasks, scoped Memory, Events, Health, and lifecycle controls. The missing pieces are equally important: configuration proposals, dependency analysis, versioning, migration, rollback, retirement, and a complete evolution ledger.

The safest evolving Enterprise is not the one that changes most autonomously. It is the one that can explain what changed, why, under whose authority, with what evidence, what was affected, and how harm will be contained if the change is wrong.

## Looking ahead

Chapter 31 examines Versioning and Migration. Its conceptual mechanisms—versioned contracts, dual publishing, dependency tracking, governed retirement, and migration status—are target architecture unless a command is explicitly identified as currently supported.
