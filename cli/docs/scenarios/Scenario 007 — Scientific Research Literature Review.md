# Scenario 007 — Climate evidence synthesis

## Goal and boundary

Pacific Climate Research Institute wants an enduring capability that prepares traceable briefing questions about coastal flooding in New Zealand, triggered by an organisational Event. This exercise has no literature, geospatial, tide, weather, or government-data connector, so it cannot perform a real review.

## Create, staff, and seed trusted context

```text
/reset               → yes
/enterprise          → 1 · "Pacific Climate Research Institute"
                       · "Maintain useful, transparent, and uncertainty-aware climate evidence briefings."
                       · skip
/function            → 1 · "Climate Evidence Synthesis"
                       · "Frame coastal-risk evidence questions, distinguish supplied facts from uncertainty, and prepare work for scientific review."
                       · skip
/add-human-worker    → "Lead Scientist" · 1 (signs off sensitive work) · skip
/function start "Climate Evidence Synthesis"
/staff               → yes to each Worker it proposes
/memory add "Briefings must distinguish observed evidence, model projections, assumptions, and unresolved uncertainty." --scope "Climate Evidence Synthesis"
/memory
```

Human-entered Memory is eligible context but remains an unverified assertion. It should influence method, not predetermine a scientific conclusion.

## Publish a briefing request

```text
/event publish "Coastal flooding briefing requested" --source "Climate Evidence Synthesis" --enterprise "Pacific Climate Research Institute"
/tasks
```

A started, staffed Function evaluates the Event and **may** create bounded work — or may decide none is warranted, which is correct behaviour, not a failure. To carry the briefing through deterministically, create the bounded Task explicitly, then approve and read it:

```text
/task                → 1 · "Frame the evidence questions for a coastal-flooding briefing for a specified New Zealand region: observed versus projected data needed, tide and storm-surge uncertainty, key assumptions, and what must be verified against primary sources. Do not invent figures or claim data access." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/events
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Inspect operations

```text
/health "Climate Evidence Synthesis"
/timeline
/memory
```

Unverified model synthesis should be excluded from autonomous Runtime learning. Health describes Arturo's operational evidence, not the truth of a climate conclusion.

## Safe completion condition

Arturo produces an auditable question framework and evidence-gap list. Scientists must retrieve, verify, cite, and review the relevant primary sources before the briefing is used.
