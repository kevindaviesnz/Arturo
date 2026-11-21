# Scenario 048 — Smart port operations (capstone)

## Goal and boundary

Meridian Smart Port runs four collaborating Functions and keeps every physical action under a duty manager's control. Synthetic scenarios only — no terminal operating system, crane, gate, or vessel connector. A deny policy stands against any work that declares the `execution` capability; Arturo issues no physical instruction.

This capstone combines four Functions, an allow and a deny policy, scoped Memory, a daily Schedule, cross-function Delegation, an approval, and an accountable human decision.

## Create, staff, and start four Functions

```text
/reset               → yes
/enterprise          → 1 · "Meridian Smart Port"
                       · "Run the port safely and efficiently with evidence-led analysis and accountable human control of every physical action."
                       · skip
/function            → 1 · "Vessel Monitoring"
                       · "Frame vessel and weather signals and evidence gaps for port events."
                       · skip
/function            → 1 · "Berth Planning"
                       · "Frame berth-allocation options for accountable decisions."
                       · skip
/function            → 1 · "Cargo Analysis"
                       · "Analyse synthetic cargo and yard scenarios for accountable review."
                       · skip
/function            → 1 · "Response Coordination"
                       · "Prepare bounded response options and route physical-action decisions to a duty manager."
                       · skip
/add-human-worker    → "Port Duty Manager" · 1 (signs off sensitive work) · skip
/function start "Vessel Monitoring"
/function start "Berth Planning"
/function start "Cargo Analysis"
/function start "Response Coordination"
/staff               → yes to each Worker it proposes
```

## Add governance, memory, and a daily review

```text
/governance          → 1 (add a rule)
                       · "Response analysis requires duty-manager sign-off"
                       · 1 (wait for a person to say yes)
                       · analysis · 1 (every task of that kind)
/governance          → 1 (add a rule)
                       · "Autonomous crane and gate control is denied"
                       · 2 (refuse it — never let this run)
                       · execution · 1 (every task of that kind)
/governance          → 2 (see the rules in place)
/memory              → 1 (write something down)
                       · "Never propose a physical action without naming the evidence and the safety controls; every crane, gate, or vessel-movement decision is a human decision."
                       · Response Coordination
/schedule            → 1 (schedule a task)
                       · "Summarise overnight vessel and weather signals and the decisions awaiting the duty manager, labelling assumptions."
                       · 1 (every day) · 05:00 · Vessel Monitoring
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

The capability question sorts the list by exactly that difference, so the two
rules are visibly not the same kind of thing as you write them.

Every question that offers a list takes the name on the row as readily as its
number — `Response Coordination`, `Port Duty Manager`, `analysis`, `execution`.
A row's number moves as records are added or change state, so naming what you
mean is the answer that cannot come to mean something else.

## Delegate the analysis, approve, and decide

```text
/delegation          → 1 (ask one Function to do work for another)
                       · Response Coordination · Cargo Analysis
                       · "Analyse a synthetic scenario where a storm forecast coincides with two priority vessels arriving and a congested yard: evidence needed, high-level sequencing and safety options, cargo and access constraints, and the decisions a duty manager must make. Do not issue any physical instruction."
/delegation          → 2 (see what has been handed over)
/delegation          → 3 (look at one handover) · 1
/tasks
/approve
/task inspect <task-id>
/create-human-task         → "Port response decision"
                       · "Decide the sequencing and safety response and what must be confirmed before any physical action. Do not authorise crane, gate, or vessel movement."
                       · "Only a duty manager can authorise a physical action."
                       · Port Duty Manager
/complete-human-task       → "Hold non-essential moves ahead of the storm, confirm mooring and yard capacity, and stage a safe sequence for manual execution. No autonomous action authorised."
/human-tasks
/functions
/health "Response Coordination"
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Safe completion condition

Four Functions collaborate, the deny rule stands recorded against `execution`, monitoring runs on a clock, and a duty manager decides every physical action. Nothing physical is authorised; qualified port staff using real systems remain responsible.
