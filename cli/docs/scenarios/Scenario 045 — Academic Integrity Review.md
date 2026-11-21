# Scenario 045 — Academic integrity review

## Goal and boundary

Rimu University wants suspected-integrity cases framed as fair process, gated, and decided by a panel — never an automated finding. **Use no real students.** Fully synthetic, anonymised examples only. Arturo makes no finding and identifies no one.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Rimu University Integrity"
                       · "Uphold academic integrity fairly, with a person accountable for every finding."
                       · skip
/function            → 1 · "Integrity Review"
                       · "Frame academic-integrity questions as fair process and route findings to an accountable panel chair."
                       · skip
/add-human-worker    → "Panel Chair" · 1 (signs off sensitive work) · skip
/function start "Integrity Review"
/staff               → yes to each Worker it proposes
```

## Add governance and a fair-process house rule

```text
/governance policy add "Integrity analysis requires chair sign-off" --effect require-approval --capability "analysis"
/memory add "Never identify a real student or make a finding; frame process, evidence standards, and appeal rights, and require a human panel for every finding." --scope "Integrity Review"
```

## Reject an identifying draft, then approve an anonymised one

```text
/task                → 1 · "Analyse, using a fully synthetic and anonymised example only, how a suspected-collusion case should be handled as fair process: evidence standards, the student's right to respond, proportionality, appeal rights, and why a panel must decide. Do not make a finding or identify anyone." · 1 (nothing to work from)
/approval-status <task-id>
/reject <task-id> "Example includes identifying details; reframe as anonymised process before analysis."
/task                → 1 · "Revised analysis, fully synthetic and anonymised: analyse only the fair-process steps, evidence standards, right to respond, proportionality, and appeal rights, and the point a panel must decide. No identities, no finding." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Record the process decision

```text
/create-human-task "Process decision" "Decide the evidence standard and procedural safeguards a hearing requires, and how appeal rights are communicated. Do not make a finding."
/complete-human-task <human-task-id> "Require a documented evidence standard, the student's right to respond, and a written appeal path before any hearing. Planning only." --as "Panel Chair"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

The process is framed as anonymised and fair, an identifying draft is rejected, and a panel chair records the safeguards. No finding is made and no one is identified; a properly constituted panel applying the policy remains responsible.
