# Scenario 009 — Therapeutic target assessment

## Goal and boundary

NovaCure Therapeutics wants two ongoing Functions to collaborate on a hypothetical therapeutic-target assessment: Translational Assessment owns the briefing, and delegates bounded evidence framing to Evidence Synthesis.

No scientific databases or laboratory systems are connected. The exercise must not provide synthesis, dosing, experimental, animal, or clinical instructions.

## Create and staff two Functions in one Enterprise

```text
/reset               → yes
/enterprise          → 1 · "NovaCure Therapeutics"
                       · "Evaluate therapeutic research directions with scientific caution and accountable oversight."
                       · skip
/function            → 1 · "Evidence Synthesis"
                       · "Frame evidence requirements and uncertainty for nominated therapeutic targets."
                       · skip
/function            → 1 · "Translational Assessment"
                       · "Integrate bounded scientific inputs into traceable research-option briefings."
                       · skip
/add-human-worker    → "Research Lead" · 1 (signs off sensitive work) · skip
/function start "Evidence Synthesis"
/function start "Translational Assessment"
/staff               → yes to each Worker it proposes
```

`/staff` proposes and assigns Workers across both Functions — reply `yes` to each. The **receiving** Function (`Evidence Synthesis`) must be started and staffed, or delegation into it is refused.

## Delegate bounded work

```text
/delegation request "Prepare a non-operational evidence-gap map for hypothetical Target X, including mechanism uncertainty, contradictory evidence, safety unknowns, and sources that require verification" --from "Translational Assessment" --to "Evidence Synthesis"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


Copy the delegation ID (a UUID) and the Task ID from the delegation output. The delegated Task is consequential, so it is held for sign-off — approve it to run. The requesting Function retains accountability even though the receiving Function performs the bounded Task.

## Important limitations

- Delegation works only between Functions in the same Enterprise.
- The receiving Function must be running and have a staffed AI Worker.
- Completion means the Task returned a result, not that the science is correct.
- Unverified synthesis must not become autonomous learning.

## Safe completion condition

The delegation has a durable ID, linked Task, receiving Worker, evidence label, and completion Event. Qualified scientists must verify all sources and decide whether any research should proceed.
