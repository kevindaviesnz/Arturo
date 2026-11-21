# Scenario 030 — Conservation operations

## Goal and boundary

Kahurangi Conservation runs three collaborating Functions and keeps every field action under a ranger's control. Synthetic scenarios only — no sensor network, trap-line database, or field connector. A deny policy stands against any work that declares the `execution` capability; Arturo issues no field instruction.

## Create, staff, and start three Functions

```text
/reset               → yes
/enterprise          → 1 · "Kahurangi Conservation"
                       · "Protect the estate with evidence-led planning and accountable human control of every field action."
                       · skip
/function            → 1 · "Field Monitoring"
                       · "Frame monitoring signals and evidence gaps for conservation events."
                       · skip
/function            → 1 · "Threat Analysis"
                       · "Analyse synthetic pest and fire-risk scenarios for accountable review."
                       · skip
/function            → 1 · "Operations Planning"
                       · "Prepare bounded response options and route field decisions to a ranger."
                       · skip
/add-human-worker    → "Head Ranger" · 1 (signs off sensitive work) · skip
/function start "Field Monitoring"
/function start "Threat Analysis"
/function start "Operations Planning"
/staff               → yes to each Worker it proposes
```

## Add governance, a house rule, and a daily review

```text
/governance policy add "Response analysis requires ranger sign-off" --effect require-approval --capability "analysis"
/governance policy add "Autonomous field action is denied" --effect deny --capability "execution"
/memory add "Never propose an intervention without naming the evidence and the non-target risks; every field action is a human decision." --scope "Operations Planning"
/schedule add "Summarise overnight sensor alerts and the threats awaiting a ranger decision, labelling assumptions." --every daily --at "06:30" --timezone "Pacific/Auckland" --function "Field Monitoring"
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

## Delegate the analysis, approve it, and decide

```text
/delegation request "Analyse a synthetic scenario where trap-line data suggests a rising predator population near a nesting site: evidence needed, high-level response options, non-target risks, and the field decisions a ranger must make. Do not issue field instructions." --from "Operations Planning" --to "Threat Analysis"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
/create-human-task "Field response decision" "Decide whether a response is warranted, what evidence must be confirmed, and the non-target safeguards required. Do not authorise any field action."
/complete-human-task <human-task-id> "Confirm the trap-line trend against a second data source first; if confirmed, plan a targeted response with non-target safeguards and iwi consultation. No field action authorised yet." --as "Head Ranger"
/human-task <human-task-id>
/functions
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Safe completion condition

Three Functions collaborate, the deny rule stands recorded against `execution`, monitoring runs on a clock, a house rule shapes method, and a ranger decides. No field action is authorised; qualified rangers using verified evidence remain responsible.
