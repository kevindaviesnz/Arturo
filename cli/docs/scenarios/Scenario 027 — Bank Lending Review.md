# Scenario 027 — Bank lending review

## Goal and boundary

Kotuku Bank wants a responsible-lending review framed from a supplied document, gated, and decided by a credit officer. The input is a synthetic, fictional loan summary. No real applicant, credit bureau, or core-banking connector is present. Arturo approves or declines nothing.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Kotuku Bank"
                       · "Lend responsibly, with evidence and a person accountable for every credit decision."
                       · skip
/function            → 1 · "Credit Review"
                       · "Frame credit-assessment questions and route decisions to an accountable credit officer."
                       · skip
/add-human-worker    → "Credit Officer" · 1 (signs off sensitive work) · skip
/function start "Credit Review"
/staff               → yes to each Worker it proposes
```

## Register the supplied document as an Artefact

A synthetic summary lives at `cli/scenario_harness/assets/loan-summary.txt`.

```text
/governance policy add "Credit analysis requires officer sign-off" --effect require-approval --capability "analysis"
/artefact add "Synthetic loan summary" --enterprise "Kotuku Bank" --kind evidence --file "./scenario_harness/assets/loan-summary.txt" --created-by "Credit Officer"
/artefact inspect artefact-1
/artefact verify artefact-1@1
```

## Frame, approve, and decide

```text
/task                → 1 · "Using the synthetic loan summary only, frame a responsible-lending review: affordability evidence needed, income verification gaps, sensitivity to rate rises, hardship considerations, and the reasons a credit officer must decide. Do not approve or decline; do not invent figures beyond the summary." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/create-human-task "Credit decision" "Decide whether the application can proceed to a full assessment or what evidence is required first. Do not approve or decline the loan."
/complete-human-task <human-task-id> "Proceed to full assessment once income verification and a rate-rise sensitivity are provided; hardship indicators need a manual check." --as "Credit Officer"
/human-task <human-task-id>
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Safe completion condition

The review is framed from the exact supplied document, gated for officer sign-off, and a person records the credit decision. The self-reported figures are unverified; a qualified credit officer using verified evidence remains responsible for the lending decision.
