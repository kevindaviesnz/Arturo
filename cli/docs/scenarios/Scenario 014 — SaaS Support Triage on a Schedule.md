# Scenario 014 — SaaS support triage on a schedule

## Goal and boundary

Larkfield Software wants recurring support triage: work that arrives because it is 08:30, plus a bounded rubric drafted now. Arturo has no ticket system, customer records, or email connector here. Nothing contacts a customer.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Larkfield Software"
                       · "Support customers quickly and honestly, with a person accountable for every judgement call."
                       · skip
/function            → 1 · "Support Triage"
                       · "Turn inbound support signals into prioritised, evidence-aware triage for an accountable support lead."
                       · skip
/add-human-worker    → "Support Lead" · 1 (signs off sensitive work) · skip
/function start "Support Triage"
/staff               → yes to each Worker it proposes
```

Reply `yes` to each proposed Worker.

## Put the recurring review on a clock

```text
/schedule add "Summarise overnight support tickets and flag those needing a same-day human reply, labelling every assumption." --every daily --at "08:30" --timezone "Pacific/Auckland" --function "Support Triage"
/schedule list
```

A Schedule creates a dormant Task immediately; it cannot run before its first due occurrence, so nothing has happened yet. The Function is never scheduled — the Task is; the Function supplies the staffing and capability context.

## Draft and approve the triage rubric now

```text
/task                → 1 · "Draft a triage rubric for inbound support tickets: severity levels, information needed from the customer, escalation criteria, and when a human must reply. Do not claim access to the ticket system or customer data." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


The result is `Unverified model synthesis` — a starting rubric for a person to adopt or change, not a live triage decision.

## Safe completion condition

A recurring Task is scheduled with an explicit timezone, and a bounded rubric is produced and approved. No customer was contacted and no ticket system was read.
