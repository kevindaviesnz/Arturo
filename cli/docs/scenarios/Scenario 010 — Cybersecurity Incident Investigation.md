# Scenario 010 — Security incident investigation

## Goal and boundary

Harbour Financial Group wants an enduring investigation Function that reacts to synthetic customer-database alerts, then escalates the accountable decision to a named human. This scenario focuses on Event evaluation, Function routing, Timeline, Health, and human escalation.

No real telemetry or containment tools are connected. Use no secrets, customer data, indicators from a live incident, or exploitable details.

## Create, staff, and start the Function

```text
/reset               → yes
/enterprise          → 1 · "Harbour Financial Group"
                       · "Investigate security concerns using verified evidence and controlled escalation."
                       · skip
/function            → 1 · "Security Incident Investigation"
                       · "Triage security signals, identify evidence gaps, and prepare bounded investigation work without executing containment."
                       · skip
/add-human-worker    → "Incident Commander" · 1 (signs off sensitive work) · skip
/function start "Security Incident Investigation"
/staff               → yes to each Worker it proposes
```

Reply `yes` to each proposed Worker.

## Publish a synthetic alert and run the work

```text
/event publish "Customer database anomaly detected" --source "Security Incident Investigation" --enterprise "Harbour Financial Group"
/tasks
```

The running Function evaluates the Event and **may** create bounded work — or may decide none is warranted. To carry the triage through deterministically, create the bounded Task explicitly, then approve and read it:

```text
/task                → 1 · "Using a synthetic alert only, prepare a triage plan for a suspected customer-database anomaly: known facts, hypotheses, evidence to request, severity criteria, customer-impact questions, and authorised decision points. Do not claim telemetry access or execute containment." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/events
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


A completed Task does not prove the incident was understood.

## Inspect Health, then escalate the decision

```text
/health "Security Incident Investigation"
/create-human-task "Decide investigation escalation" "Review the synthetic investigation record. State what verified telemetry and authority are required before containment, notification, or customer-impact decisions."
/complete-human-task <human-task-id> "Escalate for authorised review; identity, endpoint, network, database, and customer-impact evidence remain required." --as "Incident Commander"
/human-task <human-task-id>
/timeline
```

Health can be `Unknown` or degrading when outcomes are absent or unverified. Operational Health does not mean the organisation is secure.

## Safe completion condition

The scenario creates traceable operational records and an accountable escalation without claiming a breach or executing a response action.
