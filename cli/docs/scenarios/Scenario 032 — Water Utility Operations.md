# Scenario 032 — Water utility operations

## Goal and boundary

Aqua Regional runs three collaborating Functions and keeps every network action under a duty operator's control. Synthetic scenarios only — no SCADA, sensor network, or control connector. A deny policy stands against any work that declares the `execution` capability; Arturo issues no control instruction.

## Create, staff, and start three Functions

```text
/reset               → yes
/enterprise          → 1 · "Aqua Regional"
                       · "Deliver safe water with evidence-led analysis and accountable human control of every network action."
                       · skip
/function            → 1 · "Network Monitoring"
                       · "Frame monitoring signals and evidence gaps for network events."
                       · skip
/function            → 1 · "Water Quality Analysis"
                       · "Analyse synthetic water-quality scenarios for accountable review."
                       · skip
/function            → 1 · "Response Coordination"
                       · "Prepare bounded response options and route network decisions to a duty operator."
                       · skip
/add-human-worker    → "Duty Operator" · 1 (signs off sensitive work) · skip
/function start "Network Monitoring"
/function start "Water Quality Analysis"
/function start "Response Coordination"
/staff               → yes to each Worker it proposes
```

## Add governance and delegate the analysis

```text
/governance policy add "Response analysis requires operator sign-off" --effect require-approval --capability "analysis"
/governance policy add "Automated valve control is denied" --effect deny --capability "execution"
/delegation request "Analyse a synthetic scenario where turbidity rises at a treatment inlet after heavy rain: evidence needed, high-level response options, public-health considerations, and the decisions a duty operator must make. Do not issue control instructions." --from "Response Coordination" --to "Water Quality Analysis"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
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

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Record the operator's decision

```text
/create-human-task "Network response decision" "Decide whether a response is warranted, what monitoring must confirm it, and the public-health safeguards required. Do not authorise any network action."
/complete-human-task <human-task-id> "Increase sampling and confirm turbidity against a second sensor; prepare a boil-water-notice decision for public-health sign-off. No valve action authorised." --as "Duty Operator"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

Three Functions collaborate, the deny rule stands recorded against `execution`, the analysis is delegated and gated, and a duty operator decides. No network action is authorised; qualified operators using verified telemetry remain responsible.
