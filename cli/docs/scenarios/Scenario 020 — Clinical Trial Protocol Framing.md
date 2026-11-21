# Scenario 020 — Clinical trial protocol framing

## Goal and boundary

Aurora Clinical wants ethics and safety questions framed for a hypothetical phase-1 protocol, with independent human oversight of every decision. No patient data, dosing, procedures, or clinical instructions are produced. This is planning framing only.

## Create, staff, and start two Functions

```text
/reset               → yes
/enterprise          → 1 · "Aurora Clinical"
                       · "Design trials ethically, with independent human oversight of every protocol decision."
                       · skip
/function            → 1 · "Protocol Design"
                       · "Frame non-operational protocol questions and route them to accountable review."
                       · skip
/function            → 1 · "Ethics Framing"
                       · "Frame ethics and safety questions for nominated protocol drafts."
                       · skip
/add-human-worker    → "Ethics Chair" · 1 (signs off sensitive work) · skip
/function start "Protocol Design"
/function start "Ethics Framing"
/staff               → yes to each Worker it proposes
```

## Add governance, then delegate the framing

```text
/governance policy add "Protocol analysis requires ethics sign-off" --effect require-approval --capability "analysis"
/delegation request "Frame the ethics and safety questions for a hypothetical phase-1 protocol: inclusion/exclusion uncertainty, consent risks, stopping rules, and data-monitoring needs. Non-operational only; no dosing, procedures, or clinical instructions." --from "Protocol Design" --to "Ethics Framing"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


The delegated framing is held for sign-off, so approve it to run.

## Record the ethics chair's decision

```text
/create-human-task "Ethics chair decision" "Decide whether the framing is adequate to plan a formal ethics submission, and list what independent safety and statistical review must precede it. Do not authorise any trial activity."
/complete-human-task <human-task-id> "Adequate for planning only; independent DSMB design, statistical review, and full ethics submission are required before any trial activity." --as "Ethics Chair"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

Ethics framing is delegated with accountability retained and signed off for planning only. No trial activity is authorised; qualified investigators, statisticians, and an ethics board remain responsible.
