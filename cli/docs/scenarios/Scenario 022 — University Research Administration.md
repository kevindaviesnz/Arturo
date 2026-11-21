# Scenario 022 — University research administration

## Goal and boundary

Kauri University's Research Office wants grant-readiness checks that are gated, scheduled, shaped by a house rule, and signed off by a person. Synthetic assumptions only — no real applications, ethics records, or budgets are connected. Nothing is submitted.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Kauri University Research Office"
                       · "Support sound research administration with accountable human decisions on every submission."
                       · skip
/function            → 1 · "Grant Readiness"
                       · "Frame grant-readiness checks and route submission decisions to an accountable officer."
                       · skip
/add-human-worker    → "Research Office Manager" · 1 (signs off sensitive work) · skip
/function start "Grant Readiness"
/staff               → yes to each Worker it proposes
```

## Add governance, a house rule, and a weekly deadline review

```text
/governance policy add "Grant analysis requires manager sign-off" --effect require-approval --capability "analysis"
/memory add "Flag eligibility, ethics approval, data-management, and budget-justification gaps explicitly; never assume approvals exist." --scope "Grant Readiness"
/schedule add "List grant applications approaching their deadline and the readiness gaps still open, labelling assumptions." --every weekly --at "09:00" --timezone "Pacific/Auckland" --function "Grant Readiness"
/schedule list
```

## Draft, approve, and decide

```text
/task                → 1 · "Using synthetic assumptions only, draft a grant-readiness checklist for a research funding application: eligibility, ethics approval status, data-management plan, budget justification, and named gaps that must be resolved before submission. Do not claim access to a real application." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/create-human-task "Submission go/no-go" "Decide whether the application is ready to submit or what must be resolved first. Do not submit anything."
/complete-human-task <human-task-id> "Not ready: ethics approval and the data-management plan are outstanding; resubmit for review once both are attached." --as "Research Office Manager"
/human-task <human-task-id>
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Safe completion condition

A gated, scheduled, evidence-aware readiness checklist is produced and a manager records a go/no-go decision. Nothing is submitted; a qualified research officer remains responsible.
