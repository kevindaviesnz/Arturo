# Scenario 003 — Legal contract review

## Goal and boundary

Harbour Legal wants an enduring capability for preliminary commercial-contract issue spotting, with the principal lawyer retaining professional responsibility. Do not use client names, contract text, privileged advice, or personal information in this exercise.

Arturo has no contract document or legal-research connector here. Model output is not legal advice and cannot establish what a real agreement says.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Harbour Legal"
                       · "Provide careful, independent and client-centred legal services."
                       · skip
/function            → 1 · "Commercial Contract Review"
                       · "Identify material commercial contract issues and prepare a traceable briefing for principal-lawyer review."
                       · skip
/add-human-worker    → "Principal Lawyer" · 1 (signs off sensitive work) · skip
/function start "Commercial Contract Review"
/staff               → yes to each Worker it proposes
```

Reply `yes` to each proposed Worker.

## Add deterministic governance

```text
/governance policy add "Legal analysis requires principal review" --effect require-approval --capability "analysis"
/governance policy inspect "Legal analysis requires principal review"
```

This is a deterministic business rule — it holds matching work for a person, and does not depend on model reasoning. Approvals require a valid `APPROVAL_SIGNING_SECRET` or `APPROVAL_SIGNING_SECRET_FILE` before testing signed approvals.

## Create, approve, and inspect the analysis

```text
/task                → 1 · "Using synthetic assumptions only, identify the material commercial issues a principal lawyer should check in a software supply agreement: liability, indemnities, IP ownership, data protection, termination, and service levels. Separate general issue-spotting from claims needing the actual contract text. Do not give legal advice or claim to have read a real agreement." · 1 (nothing to work from)
/approval-status <task-id>
/approve <task-id>
/tasks
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


Approval authorises execution; it does not validate the legal conclusion. The result carries the evidence label `Unverified model synthesis`, which must remain excluded from autonomous learning.

## Inspect the operating record

```text
/timeline
/health "Commercial Contract Review"
/memory
```

A new or unevidenced Function may correctly report `Unknown` or degraded operational Health.

## Safe completion condition

The audit trail shows staffing, policy evaluation, the human decision, Task execution, and evidence status. Only an authorised lawyer reviewing the actual agreement and reliable sources may provide final advice.
