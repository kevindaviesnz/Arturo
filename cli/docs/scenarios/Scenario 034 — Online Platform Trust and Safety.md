# Scenario 034 — Online platform trust & safety

## Goal and boundary

Beacon Platform Trust wants moderation framed as process, gated, and decided by a person — never automated enforcement. **Use no real users or content.** Fully synthetic, anonymised examples only. Arturo identifies no one and enforces nothing.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Beacon Platform Trust"
                       · "Moderate consistently and fairly, with a person accountable for every enforcement decision."
                       · skip
/function            → 1 · "Policy Framing"
                       · "Frame content-moderation questions into process and evidence needs for an accountable lead."
                       · skip
/add-human-worker    → "Trust & Safety Lead" · 1 (signs off sensitive work) · skip
/function start "Policy Framing"
/staff               → yes to each Worker it proposes
```

## Add governance and a strict house rule

```text
/governance policy add "Enforcement analysis requires lead sign-off" --effect require-approval --capability "analysis"
/memory add "Never identify a real user or make an enforcement decision; frame process, thresholds, and appeal rights, and require a human for every action." --scope "Policy Framing"
```

## Reject an over-specific draft, then approve a process-only one

```text
/task                → 1 · "Analyse, using a fully synthetic and anonymised example only, the moderation process for suspected coordinated inauthentic behaviour: signals to gather, false-positive risks, proportionate responses, appeal rights, and why a human must decide. Do not identify anyone or decide enforcement." · 1 (nothing to work from)
/approval-status <task-id>
/reject <task-id> "Example names a specific account pattern; reframe as anonymised process only before analysis."
/task                → 1 · "Revised analysis, fully synthetic and anonymised: analyse only the moderation process steps, signal thresholds, proportionality ladder, appeal rights, and the point a human must decide. No identities, no enforcement." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## Record the enforcement-approach decision

```text
/create-human-task "Enforcement approach decision" "Decide the proportionate response ladder and what evidence and human review each step requires. Do not enforce against anyone."
/complete-human-task <human-task-id> "Adopt a graduated response with human review before any account-level action, and a documented appeal path. Planning only; no enforcement authorised." --as "Trust & Safety Lead"
/human-task <human-task-id>
/timeline
```

## Safe completion condition

Moderation is framed as anonymised process, an over-specific draft is rejected, and a lead records the enforcement approach. No user is identified and nothing is enforced; a trained trust & safety team applying the real policy remains responsible.
