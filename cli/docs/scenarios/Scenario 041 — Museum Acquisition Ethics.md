# Scenario 041 — Museum acquisition ethics

## Goal and boundary

Harbour Museum wants provenance and ethics questions framed from a supplied record, gated, and decided by a curator. The input is a synthetic provenance note. No collections system or legal connector is present. Arturo approves no acquisition and asserts no title.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Harbour Museum"
                       · "Acquire ethically, with documented provenance and a curator accountable for every decision."
                       · skip
/function            → 1 · "Acquisition Review"
                       · "Frame provenance and ethics questions from supplied records and route decisions to an accountable curator."
                       · skip
/add-human-worker    → "Chief Curator" · 1 (signs off sensitive work) · skip
/function start "Acquisition Review"
/staff               → yes to each Worker it proposes
```

## Add governance, a house rule, and the supplied record

A synthetic provenance note lives at `cli/scenario_harness/assets/provenance.txt`.

```text
/governance policy add "Acquisition analysis requires curator sign-off" --effect require-approval --capability "analysis"
/memory add "Never assert clear title or cultural-heritage status; list missing documentation and always require a qualified provenance and legal review." --scope "Acquisition Review"
/artefact add "Provenance note" --enterprise "Harbour Museum" --kind evidence --file "./scenario_harness/assets/provenance.txt" --created-by "Chief Curator"
/artefact verify artefact-1@1
```

## Analyse from the exact record, approve, and decide

```text
/task create "Analyse the supplied provenance note only: what documentation is missing, the ethics and legal questions raised (title, export, cultural-heritage status), the due-diligence steps needed, and why a curator must decide. Do not assert clear title or approve acquisition." --input-artefact artefact-1@1
/approve <task-id>
/task inspect <task-id>
/create-human-task "Acquisition decision" "Decide whether due diligence can proceed and what documentation and reviews are required first. Do not approve acquisition."
/complete-human-task <human-task-id> "Do not proceed until export records, title evidence, and a cultural-heritage assessment are obtained and legally reviewed. Planning only." --as "Chief Curator"
/human-task <human-task-id>
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Safe completion condition

Provenance is analysed from the exact supplied record, gated, and a curator records the decision. No title is asserted and no acquisition is approved; qualified provenance and legal specialists remain responsible.
