# Scenario 042 — Real-estate development feasibility

## Goal and boundary

Cityline Developments runs three collaborating Functions to assess a site, with a director deciding every commitment. Synthetic scenarios only — no land registry, consent authority, or financial connector. Arturo commits to no purchase or design.

## Create, staff, and start three Functions

```text
/reset               → yes
/enterprise          → 1 · "Cityline Developments"
                       · "Develop responsibly with evidence-led feasibility and accountable human decisions on every commitment."
                       · skip
/function            → 1 · "Site Feasibility"
                       · "Frame feasibility questions and route go/no-go decisions to an accountable director."
                       · skip
/function            → 1 · "Planning Analysis"
                       · "Analyse synthetic planning and consent scenarios for accountable review."
                       · skip
/function            → 1 · "Financial Modelling"
                       · "Frame financial-feasibility questions for accountable review."
                       · skip
/add-human-worker    → "Development Director" · 1 (signs off sensitive work) · skip
/function start "Site Feasibility"
/function start "Planning Analysis"
/function start "Financial Modelling"
/staff               → yes to each Worker it proposes
```

## Schedule a review and delegate the planning analysis

```text
/schedule add "List the feasibility decisions coming up and the evidence still outstanding, labelling assumptions." --every weekly --at "09:00" --timezone "Pacific/Auckland" --function "Site Feasibility"
/delegation request "Analyse a synthetic mixed-use site: planning and consent uncertainties, infrastructure and access constraints, community and environmental considerations, and the decisions a director must make. Do not commit to a purchase or design." --from "Site Feasibility" --to "Planning Analysis"
/delegation list
/delegation inspect <delegation-id>
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Record the go/no-go decision

```text
/create-human-task "Feasibility go/no-go" "Decide whether the site proceeds to detailed feasibility and what evidence must be confirmed first. Do not commit to a purchase."
/complete-human-task <human-task-id> "Proceed to detailed feasibility only after consent risk, ground conditions, and a financial sensitivity are confirmed. No commitment made." --as "Development Director"
/human-task <human-task-id>
/functions
/timeline
```

## Safe completion condition

Three Functions collaborate, planning analysis is delegated and gated, and a director records the go/no-go. No purchase or design is committed; a qualified team using real site, consent, and financial data remains responsible.
