# Scenario 015 — HR policy drafting with a scoped house style

## Goal and boundary

Meridian People Co wants plain-language HR policy outlines that a qualified person always signs off. Model output is not legal advice. This scenario shows scoped Operational Memory shaping method without predetermining the answer.

## Set up and staff the Function

```text
/reset               → yes
/enterprise          → 1 · "Meridian People Co"
                       · "Write clear, fair HR policies that a qualified person always signs off."
                       · skip
/function            → 1 · "Policy Drafting"
                       · "Draft plain-language HR policy outlines for human review, never presented as legal advice."
                       · skip
/add-human-worker    → "HR Director" · 1 (signs off sensitive work) · skip
/function start "Policy Drafting"
/staff               → yes to each Worker it proposes
```

## Record the house style as scoped Memory

```text
/memory add "House style: plain language, no legal advice, always list where jurisdiction-specific legal review is required." --scope "Policy Drafting"
/memory
```

Human-entered Memory is eligible context but remains an unverified assertion scoped to this Function — it influences method, not the conclusion.

## Draft, approve, and read the outline

```text
/task                → 1 · "Draft a plain-language outline of a remote-work policy: scope, eligibility, expectations, equipment, security, and the points that need jurisdiction-specific legal review. Do not give legal advice or cite specific statutes as settled." · 1 (nothing to work from)
/approve <task-id>
/task inspect <task-id>
/timeline
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving. The approval chain is created when the runtime picks the Task up,
a moment after it is queued, so approving immediately reports that there is
nothing to approve yet.


## What to verify

- The outline reflects the house style (plain language; flags legal-review points).
- The result is labelled `Unverified model synthesis`.
- Memory stays scoped to `Policy Drafting` with visible provenance.

## Safe completion condition

Arturo produces a review-ready outline with legal-review points flagged. A qualified HR/legal professional remains responsible for the final policy.
