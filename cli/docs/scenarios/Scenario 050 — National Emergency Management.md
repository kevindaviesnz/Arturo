# Scenario 050 — National emergency management (capstone finale)

## Goal and boundary

National Emergency Coordination runs five collaborating Functions and keeps every commitment and public message under the National Controller's control. Synthetic scenarios only — no alerting, logistics, or agency connector. A deny policy stands against any work that declares the `execution` capability; Arturo commits no resources and issues no alert.

This finale brings together five Functions, an allow and a deny policy, scoped Memory, a daily Schedule, an exact-version Artefact, cross-function Delegation, an approval, and an accountable human decision — the full operating pattern in one exercise.

## Create, staff, and start five Functions

```text
/reset               → yes
/enterprise          → 1 · "National Emergency Coordination"
                       · "Coordinate national response with evidence-led analysis and accountable human control of every commitment and public message."
                       · skip
/function            → 1 · "Situation Monitoring"
                       · "Frame hazard signals and evidence gaps for national events."
                       · skip
/function            → 1 · "Impact Analysis"
                       · "Analyse synthetic impact and needs scenarios for accountable review."
                       · skip
/function            → 1 · "Resource Coordination"
                       · "Frame resource-allocation options for accountable decisions."
                       · skip
/function            → 1 · "Public Information"
                       · "Prepare bounded public-information outlines for human approval."
                       · skip
/function            → 1 · "Recovery Planning"
                       · "Frame recovery-planning questions for accountable review."
                       · skip
/add-human-worker    → "National Controller" · 1 (signs off sensitive work) · skip
/function start "Situation Monitoring"
/function start "Impact Analysis"
/function start "Resource Coordination"
/function start "Public Information"
/function start "Recovery Planning"
/staff               → yes to each Worker it proposes
```

## Add governance, memory, a schedule, and a draft advisory

A synthetic advisory lives at `cli/scenario_harness/assets/public-advisory.txt`.

```text
/governance policy add "Response analysis requires controller sign-off" --effect require-approval --capability "analysis"
/governance policy add "Autonomous public alerts are denied" --effect deny --capability "execution"
/governance policy list
/memory add "Never issue a public alert or commit resources; frame evidence, equity, and safety questions and require the controller for every commitment and message." --scope "Public Information"
/schedule add "Summarise the national picture and the decisions awaiting the controller, labelling assumptions." --every daily --at "06:00" --timezone "Pacific/Auckland" --function "Situation Monitoring"
/artefact add "Draft public advisory" --enterprise "National Emergency Coordination" --kind specification --file "./scenario_harness/assets/public-advisory.txt" --created-by "National Controller"
/artefact verify artefact-1@1
```

Those two rules differ in reach, and the difference is the point. `analysis` is a
capability Arturo infers from what you type, so the require-approval rule acts on
the Tasks below. `execution` is not, and deliberately so: inferring a
consequential capability from a turn of phrase would make a Task demand something
nobody staffed and fail closed over a word it happened to contain. So the deny
rule cannot be triggered by anything typed here. It stands against work that
declares `execution` outright — a Procedure, a Workflow's operator step, an
Event-driven follow-up, or a Worker that holds it. Expect no refusal in this run:
the rule is a standing boundary, not something the transcript demonstrates.

## Delegate the analysis, approve, and decide

```text
/delegation request "Analyse a synthetic scenario where a major storm threatens two regions at once: evidence needed, high-level impact and needs, resource and equity constraints, public-safety information needs, and the decisions the controller must make. Do not commit resources or issue any alert." --from "Resource Coordination" --to "Impact Analysis"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
/create-human-task "National response decision" "Decide the response priorities and public-information approach, and what must be confirmed before committing resources or issuing any alert. Do not commit resources or issue an alert."
/complete-human-task <human-task-id> "Pre-position resources subject to confirmed supply and access; prepare the public advisory for exact-version sign-off; issue nothing until verified. No commitment or alert made." --as "National Controller"
/human-task <human-task-id>
/functions
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Safe completion condition

Five Functions collaborate, the deny rule stands recorded against `execution`, an advisory is registered for exact-version review, and the National Controller decides every commitment and message. Nothing is committed and no alert is issued; qualified emergency-management authorities using verified information remain responsible.
