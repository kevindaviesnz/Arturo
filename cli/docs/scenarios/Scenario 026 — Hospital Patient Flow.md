# Scenario 026 — Hospital patient flow

## Goal and boundary

Riverside Hospital runs three collaborating Functions to move patients through care, with clinicians accountable for every clinical decision. **Use no real patient data.** Synthetic, anonymised framing only — no diagnosis, triage decision, or clinical instruction is produced. Arturo discharges no one.

## Create, staff, and start three Functions

```text
/reset               → yes
/enterprise          → 1 · "Riverside Hospital Flow"
                       · "Move patients through care safely, with clinicians accountable for every clinical decision."
                       · skip
/function            → 1 · "Triage Support"
                       · "Frame triage questions and evidence needs for clinical review."
                       · skip
/function            → 1 · "Bed Management"
                       · "Frame bed-allocation options and constraints for accountable decisions."
                       · skip
/function            → 1 · "Discharge Planning"
                       · "Frame discharge-readiness questions and route decisions to a clinician."
                       · skip
/add-human-worker    → "Charge Nurse" · 1 (signs off sensitive work) · skip
/function start "Triage Support"
/function start "Bed Management"
/function start "Discharge Planning"
/staff               → yes to each Worker it proposes
```

Reply `yes` to each proposed Worker across all three Functions.

## Add governance, a daily review, and delegate the framing

```text
/governance policy add "Clinical analysis requires clinician sign-off" --effect require-approval --capability "analysis"
/schedule add "Summarise beds likely to free today and discharges awaiting a clinician decision, labelling assumptions." --every daily --at "07:00" --timezone "Pacific/Auckland" --function "Bed Management"
/delegation request "Frame the discharge-readiness questions for a synthetic medically-stable patient awaiting a home-support package: safety checks, follow-up needs, information a clinician must confirm, and the point a human must decide. No real patient data; no clinical instructions." --from "Discharge Planning" --to "Triage Support"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Record the clinical decision

```text
/create-human-task "Discharge decision" "Decide whether the synthetic patient is ready for discharge planning to proceed and what a clinician must confirm first. Do not discharge anyone."
/complete-human-task <human-task-id> "Proceed to plan only; a clinician must confirm home-support capacity, medication reconciliation, and follow-up before any discharge." --as "Charge Nurse"
/human-task <human-task-id>
/functions
/timeline
```

## Safe completion condition

Three Functions collaborate, clinical analysis is gated, and a clinician records the discharge decision. No real patient was assessed or discharged; qualified clinicians remain responsible for every clinical decision.
