# Scenario 004 — Insurance claim triage

## Goal and boundary

Southern Shield Insurance wants a synthetic triage exercise for a storm-damage claim. Arturo may organise questions and risks, but it has no policy wording, claim file, photographs, weather evidence, repair estimates, fraud data, or customer history.

Do not enter real claimant or property information. This scenario does not decide coverage, fraud, settlement, or entitlement. Its point is the **deterministic gate**: sensitive work waits for a named human, who can reject it before any model output is treated as a decision.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Southern Shield Insurance"
                       · "Handle claims consistently, fairly, and using sufficient evidence."
                       · skip
/function            → 1 · "Claim Triage"
                       · "Triage reported claims into evidence needs and coverage questions for an accountable claims manager."
                       · skip
/add-human-worker    → "Claims Manager" · 1 (signs off sensitive work) · skip
/function start "Claim Triage"
/staff               → yes to each Worker it proposes
```

Reply `yes` to each proposed Worker. `/staff` records that this Function's work
needs a human sign-off, so the triage Task below is held before it runs.

## Queue a synthetic claim, then reject it

```text
/task                → 1 · "Using synthetic assumptions only, triage a reported storm-damage claim involving a roof, internal ceiling water damage, and a fence. List evidence required, possible coverage questions, vulnerability and fair-treatment considerations, and reasons an authorised claims manager must decide the next step. Do not decide coverage or allege fraud." · 1 (nothing to work from)
/approvals
/approval-status <task-id>
```

The Task is held in **Awaiting approval** before any model call. Exercise
rejection when the evidence is insufficient:

```text
/reject <task-id> "Policy wording, loss evidence, and customer-impact information are missing."
/approval-status <task-id>
/tasks
/timeline
```

To test the approved path instead, wait until `/tasks` shows the Task blocked
awaiting approval, then run `/approve <task-id>` — approval authorises
the bounded triage to run; it is not a coverage decision. Signed approval and
rejection require a valid `APPROVAL_SIGNING_SECRET` or
`APPROVAL_SIGNING_SECRET_FILE`.

## What to verify

- The Task enters `Awaiting approval` before execution — the gate is deterministic, not a model judgement.
- Rejection records the reason and prevents execution (`/tasks` shows it rejected/blocked, not completed).
- No model-generated prose is presented as a coverage decision.
- `/timeline` contains the policy/approval and decision records.

## Safe completion condition

Arturo demonstrates traceable triage and deterministic control. A properly authorised claims professional using the applicable policy, evidence, law, and fair-treatment process remains responsible for the real decision.
