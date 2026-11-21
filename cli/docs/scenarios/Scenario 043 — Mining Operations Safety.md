# Scenario 043 — Mining operations safety

## Goal and boundary

Ironvale Mining runs two collaborating Functions and keeps every operational action under a mine manager's control. Synthetic scenarios only — no monitoring or control connector. A deny policy stands against any work that declares the `execution` capability; Arturo issues no operational instruction.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Ironvale Mining"
                       · "Operate safely with evidence-led analysis and accountable human control of every operational action."
                       · skip
/function            → 1 · "Operations Planning"
                       · "Frame operational-planning questions and route decisions to an accountable mine manager."
                       · skip
/function            → 1 · "Geotechnical Analysis"
                       · "Analyse synthetic geotechnical scenarios for accountable review."
                       · skip
/add-human-worker    → "Mine Manager" · 1 (signs off sensitive work) · skip
/function start "Operations Planning"
/function start "Geotechnical Analysis"
/staff               → yes to each Worker it proposes
```

## Add governance, a house rule, and delegate the analysis

```text
/governance policy add "Operational analysis requires manager sign-off" --effect require-approval --capability "analysis"
/governance policy add "Autonomous blasting is denied" --effect deny --capability "execution"
/memory add "Never propose an operational action without naming the evidence and the safety controls; every blast or ground-support decision is a human decision." --scope "Operations Planning"
/delegation request "Analyse a synthetic scenario where slope-monitoring data suggests movement near an active bench: evidence needed, high-level stabilisation options, exclusion-zone considerations, and the decisions a mine manager must make. Do not issue an operational instruction." --from "Operations Planning" --to "Geotechnical Analysis"
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


## Record the ground-control decision

```text
/create-human-task "Ground-control decision" "Decide what monitoring must confirm the movement and the exclusion and support measures required. Do not authorise any operational action."
/complete-human-task <human-task-id> "Establish an exclusion zone and increase monitoring; no work resumes near the bench until a geotechnical engineer signs off. No blast authorised." --as "Mine Manager"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

The deny rule stands recorded against `execution`, the geotechnical analysis is delegated and gated, and a mine manager records the ground-control decision. No operational action is authorised; qualified engineers using real monitoring data remain responsible.
