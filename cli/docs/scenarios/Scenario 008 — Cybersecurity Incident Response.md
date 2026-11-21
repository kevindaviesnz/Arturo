# Scenario 008 — Cybersecurity incident response

## Goal and boundary

Harbour Bank NZ wants to demonstrate how Arturo gates high-risk incident work. Use synthetic descriptions only. Arturo has no SIEM, identity, endpoint, network, ticketing, threat-intelligence, or containment connector in this scenario.

Never paste credentials, access tokens, personal data, customer records, exploitable details, or live incident evidence into this exercise.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Harbour Bank NZ"
                       · "Protect customer services through controlled, evidence-led security operations."
                       · skip
/function            → 1 · "Incident Response"
                       · "Triage synthetic security alerts into evidence needs and authorised decision points without executing containment."
                       · skip
/add-human-worker    → "Incident Commander" · 1 (signs off sensitive work) · skip
/function start "Incident Response"
/staff               → yes to each Worker it proposes
```

Reply `yes` to each proposed Worker.

## Add a deterministic deny boundary

```text
/governance policy add "Automated containment is denied" --effect deny --capability "execution"
/governance policy list
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

These policies are deterministic business rules; they do not depend on model reasoning. The deny rule stands against the `execution` capability.

## Triage under approval

```text
/task                → 1 · "Using a synthetic alert description only, prepare an incident triage plan for unusual employee authentication activity. Separate known facts, hypotheses, evidence requests, severity criteria, customer-impact questions, and authorised containment decision points. Do not claim access to telemetry and do not execute containment." · 1 (nothing to work from)
/approve <task-id>
/tasks
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


Approval permits analysis only; it does not permit containment. Signed approval requires a valid `APPROVAL_SIGNING_SECRET` or `APPROVAL_SIGNING_SECRET_FILE`.

## Inspect the denied boundary

```text
/governance policy inspect "Automated containment is denied"
/timeline
```

This scenario intentionally registers no containment Worker and issues no containment Task. Do not broaden a Worker's capabilities merely to make a dangerous synthetic action execute.

## Safe completion condition

Arturo produces a controlled triage plan and an audit trail without claiming telemetry access or taking action. Authorised incident responders using verified evidence remain responsible for containment, notification, recovery, and regulatory obligations.
