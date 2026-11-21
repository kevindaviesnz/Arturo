# Arturo Builds Arturo

## A counterfactual reconstruction for investor demonstration

## Summary

This demonstration asks:

> How might Arturo's development have been organised if Arturo had already
> existed?

It uses real kinds of development problems, but rebuilds the story as a
demonstration. Arturo did not literally build itself.

This demonstration uses real categories of problems encountered while building Arturo and reconstructs how the work could have been organised if Arturo had existed from the beginning.

Open every presentation with this disclosure:

> This is a counterfactual reconstruction using real development experiences. It shows how Arturo would have organised the work if it had existed at the beginning. It is not a claim that Arturo historically built itself.

The purpose is comparison, not theatre. Commands run against live Arturo state, model wording may vary, and no showcase metrics or external evidence are fabricated.

## The comparison investors should see

| Conventional development experience | Reconstructed Arturo operation |
|---|---|
| A founder notices a problem in a conversation or terminal | A durable Event records the signal |
| The founder works out which discipline should respond | Running Functions evaluate relevance |
| Context is repeated across separate AI conversations | Functions preserve bounded work, capability, routing, and status |
| Model reasoning and application rules can become mixed | Model synthesis is separated from deterministic Governance |
| A response may sound complete without being verified | Evidence provenance and uncertainty remain visible |
| Decisions remain in chat history or personal memory | Human Tasks and approvals preserve accountable decisions |
| Documentation is updated as a separate clean-up activity | Documentation operates as an ongoing Function |
| It is difficult to reconstruct why the product changed | Events, Functions, approvals, and Timeline provide an audit path |

## Demo architecture

The reconstructed Arturo Enterprise uses six ongoing Functions:

1. **Product Strategy Function** — converts the mission and observed problems into bounded product priorities.
2. **Runtime Engineering Function** — designs the execution system without confusing plans with completed code changes.
3. **Quality and Verification Function** — tests claims, reproduces defects, and defines completion evidence.
4. **Security and Governance Function** — defines trust boundaries and deterministic controls.
5. **Documentation and Education Function** — keeps executable guidance aligned with supported behaviour.
6. **Investor Readiness Function** — explains value, evidence, limitations, milestones, and funding needs without overstating the product.

Workers are replaceable execution capacity. Functions retain purpose and accountability.

## 1. Start an isolated demonstration

From `cli/`, create a state directory that is already excluded by `.gitignore`:

```bash
mkdir -p .data/arturo-builds-arturo
ARTURO_DATA_DIRECTORY=.data/arturo-builds-arturo ARTURO_RUNTIME_DATABASE_PATH=.data/arturo-builds-arturo/runtime.db npm run ui
```

The remaining configuration—including local-model and signing-secret settings—comes from the untracked `cli/.env`. Do not use production data or credentials.

Inside Arturo:

```text
/overview
```

### Presenter point

The empty view is real. Arturo is about to create its own organisational model rather than loading fabricated demo statistics.

## 2. Establish Arturo as an Enterprise

```text
/enterprise create "Arturo" --mission "Build and operate the governed operating system for AI-native companies."
/enterprise inspect "Arturo"
```

### Verify

- Arturo exists as durable Enterprise identity.
- It has a mission but no ongoing Functions, Workers, Tasks, or policies yet.
- The Enterprise is not itself a workflow or an AI persona.

## 3. Reconstruct the capabilities that should have existed from day one

```text
/function create "Product Strategy" --enterprise "Arturo" --objective "Turn Arturo's mission, user experience, and operating evidence into bounded product priorities with explicit trade-offs."
/function create "Runtime Engineering" --enterprise "Arturo" --objective "Design and implement Arturo's execution runtime while preserving deterministic controls, inspectability, and failure recovery."
/function create "Quality and Verification" --enterprise "Arturo" --objective "Reproduce defects, challenge product claims, verify supported behaviour, and define observable completion evidence."
/function create "Security and Governance" --enterprise "Arturo" --objective "Protect trust boundaries and ensure consequential AI work remains constrained by deterministic policy and accountable humans."
/function create "Documentation and Education" --enterprise "Arturo" --objective "Keep Arturo's commands, examples, concepts, limitations, and teaching journey aligned with implemented behaviour."
/function create "Investor Readiness" --enterprise "Arturo" --objective "Present Arturo's value, evidence, limitations, commercial hypotheses, milestones, and funding needs accurately."
/functions
```

### Comparison checkpoint

Conventionally, these responsibilities existed implicitly in the founder's head and in separate conversations. Arturo turns them into inspectable, enduring ownership before creating work.

## 4. Add AI execution capacity and human authority

```text
/add-ai-worker "Product Evidence Analyst" --archetype analyst
/add-ai-worker "Runtime Planning Worker" --archetype planner
/add-ai-worker "Verification Reviewer" --archetype reviewer
/add-ai-worker "Documentation Worker" --archetype creator
/add-ai-worker "Security Guardian" --archetype guardian
/add-human-worker "Founder" --archetype guardian --availability available
/workers
```

### Verify

- Worker names describe organisational roles, not model brands.
- AI and Human Workers are visibly different.
- Archetypes deterministically grant capability categories; they do not prove expertise or professional authority.
- Adding a Worker does not silently give it email, shell, repository-write, or publication authority.

## 5. Activate the Functions that will respond to the first historical signal

```text
/function start "Product Strategy"
/function start "Quality and Verification"
/function start "Documentation and Education"
/function inspect "Product Strategy"
/function inspect "Quality and Verification"
/function inspect "Documentation and Education"
```

### Presenter point

Starting a Function activates its internal operating process. A running Function can evaluate organisational Events and create warranted Tasks; it is not a long-running prompt pretending to be a department.

## 6. Publish a real historical development problem

The first reconstruction uses the repeated staffing-plan validation failures encountered during Arturo's development.

```text
/event publish "Historical staffing plan validation failures reconstructed for product review" --source "Quality and Verification" --enterprise "Arturo"
/events
/tasks
```

Model-generated Function evaluations will vary. Inspect what each running Function considered relevant. Do not imply that every generated Task is correct merely because Arturo created it.

### Comparison checkpoint

Without Arturo, the founder repeatedly relayed errors between the terminal, implementation, tests, documentation, and AI assistant. In the reconstruction, one durable Event can be independently evaluated by Product Strategy, Quality, and Documentation according to their objectives.

## 7. Guarantee a governed, capability-routed comparison

Create a deterministic approval rule before requesting the analysis:

```text
/governance policy add "Historical product conclusions require founder review" --effect require-approval --capability "analysis"
/governance policy inspect "Historical product conclusions require founder review"
/task create "Compare the conventional response to Arturo's historical staffing-plan validation failures with the response an Arturo-operated company would use. Identify ownership, verification, documentation, governance, and learning gaps. Use only the supplied reconstruction context, label assumptions, and do not claim code changes or external research."
/tasks
/approvals
```

Copy the new governed Task ID, then inspect and approve it:

```text
/approval-status <task-id>
/approve <task-id>
/approval-status <task-id>
/task inspect <task-id>
```

### What this proves

- Work is routed by the required `analysis` capability.
- Governance is evaluated before execution.
- A human authorises execution; approval does not certify the resulting answer.
- The result remains labelled as model synthesis unless external evidence is actually supplied.
- The Function preserves task, Worker, routing, status, and output beyond one conversation.

## 8. Record the accountable product decision

The model can analyse the comparison, but it cannot decide Arturo's historical product position on the founder's behalf.

```text
/create-human-task "Decide the Arturo Builds Arturo demo claim" "Review the reconstruction and decide which claim investors may be shown. Choose between: Arturo historically built itself; Arturo now operates parts of its own development; or this is a counterfactual demonstration of how Arturo would have organised its development from day one. Record the rationale and required disclosure."
/human-tasks
```

Copy the Human Task ID and complete it as the Founder:

```text
/complete-human-task <human-task-id> "Approved claim: this is a counterfactual reconstruction using real development experiences. It demonstrates how Arturo would have organised its own development from day one and must not be presented as literal history." --as "Founder"
/human-task <human-task-id>
```

### Comparison checkpoint

The presentation claim is now an attributable human decision, not wording silently selected by a model.

## 9. Inspect the operating record

```text
/overview
/governance
/timeline
/events
/tasks
/human-tasks
/memory
/health "Quality and Verification"
/model-routing
```

Explain the boundaries visible in the output:

- Health measures Arturo's operating evidence, not market success or product truth.
- A completed Task is not automatically a verified result.
- Unverified synthesis must not become autonomous Operational Memory.
- Session tokens and the model-routing view expose cost-control behaviour.
- No email, publication, repository edit, or external action occurred.

## Ten-minute investor cut

Prepare sections 1–5 before the meeting. During the meeting:

1. Give the counterfactual disclosure and show the comparison table.
2. Run section 6 to publish the historical Event.
3. Show the resulting Function evaluations and Tasks.
4. Run section 7 through approval and inspect the result.
5. Show the completed Human Task from section 8.
6. Finish with `/overview` and `/timeline`.

If the local model is slow, use an already completed Task but still publish a new Event so the investor sees live organisational response. Never substitute fabricated output.

## Additional reconstruction Events

Use these in later demonstrations rather than overloading the first meeting:

```text
/event publish "Historical worker capability mismatch reconstructed for routing review" --source "Quality and Verification" --enterprise "Arturo"
/event publish "Historical malformed model JSON reconstructed for runtime recovery review" --source "Runtime Engineering" --enterprise "Arturo"
/event publish "Historical documentation and command drift reconstructed for conformance review" --source "Documentation and Education" --enterprise "Arturo"
/event publish "Historical approval-secret setup failure reconstructed for onboarding review" --source "Security and Governance" --enterprise "Arturo"
/event publish "Historical delegation reported completion without executable work reconstructed for integrity review" --source "Quality and Verification" --enterprise "Arturo"
```

Start the named source Function before using an Event. These are reconstruction inputs, not proof that Arturo performed the original historical work.

## Safe completion condition

The demonstration is complete when the investor can trace:

```text
historical signal → Event → Function evaluation → Function → capability routing
                  → deterministic Governance → Human approval → model output
                  → accountable Human Task → Timeline
```

No investor should leave believing that the reconstruction is literal history, that model synthesis is verified evidence, or that Arturo executed an external action.

## Live-demo review log

After every rehearsal or investor meeting, update the demonstration based on observed Arturo output:

| Date | Audience | Step reached | Failure or confusion | Evidence captured | Change required |
|---|---|---|---|---|---|
| [date] | [internal/investor] | [section] | [observation] | [Function/Event/Task ID] | [documentation/product change] |

The demo itself should improve through the same Event, Function, decision, and verification discipline that it presents.
