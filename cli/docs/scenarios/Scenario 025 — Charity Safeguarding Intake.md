# Scenario 025 — Charity safeguarding intake

## Goal and boundary

Harbour Youth Trust wants a careful, process-only framing of safeguarding concerns, where every referral is a human decision. **Use no real names, identities, or allegations.** This is a synthetic, anonymised process exercise only. Arturo makes no referral and reaches no conclusion about any person.

Every command below is typed on its own. Arturo asks for what it needs; there are no switches to copy.

## Set up the charity and the Function

```text
/reset
```

Answer `yes`.

```text
/enterprise
```

Choose `1`, then answer:

- Name: `Harbour Youth Trust`
- What it does: `Keep young people safe with careful process and accountable human decisions on every concern.`
- Anything more: `A registered charity supporting at-risk young people. It never records real identities in Arturo.`

```text
/function
```

Choose `1`, then answer:

- Name: `Safeguarding Intake`
- What it keeps doing: `Frame safeguarding concerns into evidence needs and route referral decisions to an accountable lead.`
- Anything more: `Process framing only. Every referral decision belongs to a trained lead.`

## Add the accountable lead

```text
/add-human-worker
```

- Name: `Safeguarding Lead`
- Role: choose `1` — signs off sensitive work
- Email: `lead@example.com`, or `skip`

The role matters here. Only an approval-capable person can sign off the work this Function produces; someone added with no sign-off role cannot, and that only surfaces later at `/approve`.

## Staff the Function

```text
/staff
```

Accept the AI Workers Arturo proposes. **The plan is model-generated, so the names and how many are proposed differ every run** — do not script them.

Registering a Worker is not the same as putting it to work. `/staff` is what attaches Workers to the Function, and it also records the approval coverage you just accepted as a Governance rule — one covering the Function's work that reaches outside Arturo. That rule, and its limits, matter in a moment.

## Add governance and a strict house rule

```text
/governance
```

Choose `1`, then answer:

- What the rule is for: `Safeguarding analysis requires lead sign-off`
- What should happen: `1` — wait for a person to say yes
- Which work it covers: pick **analysis**, from the group headed "Arturo can spot these in a task you type"
- Risk level: `1` — every task of that kind

The list is split for a reason. A rule keyed on a capability Arturo cannot recognise in a typed task will not match one, though it still applies to work that declares the capability another way.

```text
/memory
```

Choose `1`, then:

- The note: `Never name a real child or worker; frame concerns as process only; every referral decision is a human decision.`
- Where it applies: choose `Safeguarding Intake` — only this Function's work

## Reject an over-specific draft

```text
/task
```

Choose `1`, then describe the work:

> Analyse, using a fully synthetic and anonymised example only, how a reported safeguarding concern should be handled as a process: what to record, the immediate questions to ask, who must be informed, and thresholds for external referral. Do not name anyone or allege wrongdoing.

Choose `1` when asked what it should work from — it has everything it needs.

Arturo may note **partial coverage**: the staffed Worker it chose does not itself hold `analysis`. That is the honest state of a team-staffed Function, not an error. Add a Worker whose archetype covers it if the work depends on it.

```text
/tasks
```

Wait until the Task reads **Blocked — awaiting approval**. The approval chain is created when the runtime picks the Task up, a moment after it is queued, so checking immediately will correctly show nothing.

```text
/approval-status <task-id>
```

Read the `Waiting because` line. It names the rule that is holding the work:

```text
Waiting because  Safeguarding analysis requires lead sign-off (policy-...)
```

**The rule you wrote is what is holding this, and only because you wrote it.**
The rule `/staff` created covers the same Function, but only its work that
reaches outside Arturo — sending an email, running a command, writing a file.
Analysis produces text, so that rule does not match, and without yours this Task
would have run unattended.

That is the point to teach: do not assume work is waiting because of the rule
you are thinking of. Read which one it names. Change the capability on your rule
to something this Task does not request and the Task stops waiting altogether —
which is the honest demonstration that a rule protects only what it matches.

```text
/reject <task-id> "Concern description mixes process with a specific allegation; reframe as process only before analysis."
```

The reason becomes part of the durable approval history. Rejection does not rewrite the instruction; a corrected version has to be submitted explicitly.

## Approve a process-only revision

```text
/task
```

Choose `1`, then:

> Revised analysis, fully synthetic and anonymised: analyse only the process steps, the questions to ask, information-sharing thresholds, and the point at which a trained human must decide on referral. No allegations, no identities.

Choose `1` again for what it works from. Wait for `/tasks` to show it awaiting approval, then:

```text
/approve <task-id>
```

Wait for execution, then:

```text
/task inspect <task-id>
```

The result is labelled **unverified model synthesis**. It describes a process; it is not advice about any person, and not a referral.

## Record the referral decision as human work

```text
/create-human-task
```

- Title: `Referral decision`
- What they must do: `Decide whether the synthetic concern would meet the threshold for external referral, and what evidence and support must accompany it. Do not make a real referral.`
- Why a person: `Only a trained lead can make a referral decision.`
- Who: choose `Safeguarding Lead`

```text
/human-tasks
/complete-human-task
```

Pick the task, then record what was decided:

> On these synthetic facts the threshold is met; a trained lead would refer with a written chronology and ensure immediate safety and support. Planning only.

Completion is attributed to `Safeguarding Lead` without asking, because an assigned task can only be completed by its owner.

```text
/human-tasks
/timeline
```

## Safe completion condition

The process is framed anonymously, an over-specific draft is rejected with a recorded reason, an AI Worker produces a process-only analysis under human sign-off, and a trained lead records the referral decision as human work.

No real concern is handled here. Arturo made no referral and reached no conclusion about any person; a trained safeguarding professional following the applicable framework remains responsible for any real decision.
