# Scenario 049 — Integrated health system (capstone)

## Goal and boundary

Southern Health Network runs four collaborating Functions, with clinicians accountable for every clinical decision. **Use no real patient data.** Synthetic scenarios only — no PAS, EHR, or bed-management connector. Arturo changes no pathway and asserts no clinical outcome.

This capstone combines four Functions, a require-approval policy, scoped Memory, a daily Schedule, an exact-version Artefact review, cross-function Delegation, an approval, and an accountable clinical decision.

## Create, staff, and start four Functions

```text
/reset               → yes
/enterprise          → 1 · "Southern Health Network"
                       · "Coordinate care safely with evidence-led analysis and clinicians accountable for every clinical decision."
                       · skip
/function            → 1 · "Demand Monitoring"
                       · "Frame demand and capacity signals and evidence gaps for system events."
                       · skip
/function            → 1 · "Capacity Planning"
                       · "Frame capacity-planning options for accountable decisions."
                       · skip
/function            → 1 · "Pathway Analysis"
                       · "Analyse synthetic patient-pathway scenarios for accountable review."
                       · skip
/function            → 1 · "Quality Review"
                       · "Review exact documents and record signed decisions before use."
                       · skip
/add-human-worker    → "Clinical Director" · 1 (signs off sensitive work) · skip
/function start "Demand Monitoring"
/function start "Capacity Planning"
/function start "Pathway Analysis"
/function start "Quality Review"
/staff               → yes to each Worker it proposes
```

Wait until `/tasks` shows the delegated Task **Blocked — awaiting approval**
before approving: the approval chain is created when the runtime picks it up, a
moment after it is queued. Bare `/approve` lists what is waiting, and with one
clinician able to decide it does not ask who — the decision is recorded against
the Clinical Director, not against whoever typed it.

## Add governance, memory, a schedule, and a document to review

A synthetic protocol lives at `cli/scenario_harness/assets/escalation-protocol.txt`.

```text
/governance          → 1 (add a rule)
                       · "Pathway analysis requires clinical sign-off"
                       · 1 (wait for a person to say yes)
                       · analysis · 1 (every task of that kind)
/governance          → 2 (see the rules in place)
/memory              → 1 (write something down)
                       · "Never assert clinical outcomes or identify a real patient; frame evidence, equity, and safety questions and require a clinician for every clinical decision."
                       · Pathway Analysis
/schedule            → 1 (schedule a task)
                       · "Summarise capacity pressures and the decisions awaiting the clinical director, labelling assumptions."
                       · 1 (every day) · 06:30 · Demand Monitoring
/artefact            → 1 (attach a file) · "Draft escalation protocol"
                       · 3 (specification)
                       · "./scenario_harness/assets/escalation-protocol.txt"
                       · Clinical Director
                       · "Received for clinical review; not produced by Arturo."
/artefact            → 7 (check a file still matches what Arturo recorded)
```

The rule is keyed on `analysis`, which Arturo **can** recognise in a Task you
type, so it acts on the delegated analysis below. The capability question sorts
the list by exactly that: a rule on one of the lower group still holds, but not
over anything typed here.

Every question that offers a list takes the name on the row as readily as its
number — `Pathway Analysis`, `Clinical Director`, `analysis`. A row's number
moves as records are added or change state, so naming what you mean is the
answer that cannot come to mean something else.

## Delegate the analysis, approve, and decide

```text
/delegation          → 1 (ask one Function to do work for another)
                       · Capacity Planning · Pathway Analysis
                       · "Analyse a synthetic winter-surge scenario where emergency demand exceeds inpatient capacity: evidence needed, high-level flow and escalation options, equity and safety considerations, and the decisions a clinical director must make. No real patient data; no clinical instructions."
/delegation          → 2 (see what has been handed over)
/tasks
/approve
/task inspect <task-id>
/create-human-task         → "Escalation decision"
                       · "Decide the escalation approach and what must be confirmed before any change, and whether the draft escalation protocol is fit to review. Do not change any pathway."
                       · "Only a clinician can decide a clinical escalation."
                       · Clinical Director · artefact-1@1
/complete-human-task       → "Confirm safe staffing and equity impact before escalating; send the draft protocol for exact-version clinical review. No pathway changed."
                       · 1 (no file produced)
/human-tasks
/functions
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Safe completion condition

Four Functions collaborate, pathway analysis is gated, a protocol is registered for exact-version review, and a clinical director decides. No pathway is changed and no patient is identified; qualified clinicians using real systems remain responsible.
