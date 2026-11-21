# Scenario 017 — Public-sector FOI: delegation plus accountable human decision

## Goal and boundary

A Regional Council wants to frame an information request across two Functions, then route the redaction decision to a named officer. Arturo has no records system, email, or document store here. Nothing is released, redacted, or sent.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Regional Council"
                       · "Answer information requests lawfully, on time, and with the right redactions decided by a person."
                       · skip
/function            → 1 · "FOI Intake"
                       · "Frame the scope and search terms for an information request."
                       · skip
/function            → 1 · "FOI Response"
                       · "Prepare a bounded response outline and route redaction decisions to an accountable officer."
                       · skip
/add-human-worker    → "Information Officer" · 1 (signs off sensitive work) · skip
/function start "FOI Intake"
/function start "FOI Response"
/staff               → yes to each Worker it proposes
```

Reply `yes` to each proposed Worker across both Functions.

## Delegate scope framing to Intake

```text
/delegation request "Draft the search scope for a request about roadworks spending in the last financial year: likely record types, date range, teams to ask, and terms that need a human to confirm before searching. Do not claim access to any records." --from "FOI Response" --to "FOI Intake"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


`FOI Response` keeps accountability; `FOI Intake` performs the bounded Task. Copy the delegation UUID and the Task ID from the delegation output; the delegated Task is held for sign-off, so approve it to run.

## Record the accountable decision

```text
/create-human-task "Decide FOI redaction approach" "Review the drafted scope. Decide which categories need redaction review, what must be withheld pending legal advice, and the statutory deadline. Do not release anything."
/complete-human-task <human-task-id> "Scope accepted for search only. Personal data and third-party commercial terms need redaction review before any release; confirm the statutory deadline." --as "Information Officer"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

The scope is framed by delegation with accountability retained, and a named officer records the redaction approach. No record was searched, redacted, or released; a qualified officer applying the statute remains responsible.
