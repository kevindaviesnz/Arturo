# Arturo scenario guide

These scenarios are copyable exercises for Arturo's current native terminal. Each one demonstrates a different operating pattern while keeping model output, verified evidence, human authority, and external action clearly separated.

## Before running a scenario

Start Arturo from `cli/`:

```bash
npm run ui
```

Inside Arturo, use `/help <command>` whenever you want the full syntax and recovery guidance. Names and sentences containing spaces must be quoted.

Each scenario begins with an optional `/reset`. It permanently removes the current local Arturo state. Skip it when you want to preserve existing Enterprises, Workers, Functions, Events, Memory, policies, approvals, Human Tasks, chats, and Delegations.

The examples assume the local Ollama provider is available. Model-generated wording will vary. Copy IDs from Arturo's output wherever a command contains a placeholder such as `<task-id>`.

### Signing secrets (for approvals and human-task links)

Two secrets in `cli/.env` gate the signed parts of these scenarios. Each must be
at least 32 non-placeholder characters:

- `APPROVAL_SIGNING_SECRET` or `APPROVAL_SIGNING_SECRET_FILE` — required for
  `/approve` and `/reject` to produce a signed decision. Without one valid
  value, approval steps refuse (fail-closed).
- `HUMAN_TASK_TOKEN_SECRET` — enables the signed browser link a Human Task
  prints under `Open`. Without it, the Human Task still works entirely through
  its commands (`/complete-human-task`, `/block-task`, `/revise-task`); only the
  browser link shows `unavailable — configure HUMAN_TASK_TOKEN_SECRET…`.

These are deliberately fail-closed: a missing secret disables the signed feature
rather than silently producing an unsigned one. The transcripts under
`scenario_testing/` were captured with test values set, so they show a real
`Open` URL and signed approvals.

### The setup-and-staff pattern

Arturo will not create or run work for an Enterprise that is not set up and
staffed. Most scenarios therefore share the same opening shape:

```text
/enterprise create "<Co>" --mission "..."
/function create "<Function>" --objective "..."
/add-human-worker "<Approver>" --archetype guardian
/function start "<Function>"
/staff        # answer yes to each proposed Worker
```

Only then does `/task create` route to a staffed Worker. `/staff` also records
that sensitive work needs a human sign-off, so analysis/review Tasks land in
**Awaiting approval** until `/approve`, which is attributed to the registered
approver.

### Live transcripts

Almost every scenario has a captured end-to-end transcript under the
repository's `scenario_testing/` directory, produced by driving `npm run ui`
against the local model with `cli/scenario_harness/`. They show real routing,
approvals, and results — useful for seeing exactly what a scenario does before
running it. Scenario 012 is the exception: it depends on a configured Web Search
provider and human-created design files, so it is run manually and has no
auto-captured transcript.

## Scenario map

| # | Scenario | Main Arturo capability |
|---|---|---|
| 001 | [Solar customer education](<./Scenario 001 — Content Creation for a Solar Company.md>) | One-off work and read-only Worker chat |
| 002 | [Retail feature assessment](<./Scenario 002 — Retail Feature Assessment.md>) | Capability routing and Human Tasks |
| 003 | [Legal contract review](<./Scenario 003 — Legal Contract Review for a Software Vendor.md>) | Running Function plus deterministic approval |
| 004 | [Insurance claim triage](<./Scenario 004 — Insurance Claim Assessment.md>) | Governed analysis and rejection |
| 005 | [Discovery research](<./Scenario 005 — Pharmaceutical Drug Discovery.md>) | Evidence limits and expert decision tasks |
| 006 | [Investment assessment](<./Scenario 006 — Financial Investment Analysis.md>) | Local-first routing and approval |
| 007 | [Climate evidence synthesis](<./Scenario 007 — Scientific Research Literature Review.md>) | Scoped Memory and Event-driven work |
| 008 | [Security incident response](<./Scenario 008 — Cybersecurity Incident Response.md>) | Deny and require-approval policies |
| 009 | [Therapeutic target assessment](<./Scenario 009 — Pharmaceutical Drug Discovery.md>) | Cross-function Delegation |
| 010 | [Security incident investigation](<./Scenario 010 — Cybersecurity Incident Investigation.md>) | Timeline, Health, and escalation |
| 011 | [Synthesis strategy research](<./Scenario 011 — Synthesis Strategy Review Loop.md>) | Revision loop with accountable Human Tasks |
| 012 | [Fashion research, design, and costing](<./Scenario 012 — Fashion Research, Design, Human Handoffs, and Costing.md>) | Ordered AI/Human Workflow, versioned Artefacts, exact review, and gated costing |
| 013 | [A week in a sole legal practice](<./Scenario 013 — A Week in a Sole Legal Practice.md>) | Daily operations: Schedules, Events, approvals, Delegation, Health, and recovery |
| 014 | [SaaS support triage on a schedule](<./Scenario 014 — SaaS Support Triage on a Schedule.md>) | Recurring Schedule plus a bounded, approved Task |
| 015 | [HR policy drafting with house style](<./Scenario 015 — HR Policy Drafting with House Style.md>) | Scoped Memory shaping an approved draft |
| 016 | [Manufacturing QA reject then approve](<./Scenario 016 — Manufacturing QA Reject then Approve.md>) | Both sides of the deterministic gate |
| 017 | [Public-sector FOI delegation](<./Scenario 017 — Public-Sector FOI Delegation.md>) | Cross-function Delegation plus an accountable decision |
| 018 | [Financial compliance monitoring](<./Scenario 018 — Financial Compliance Monitoring.md>) | Governance, Schedule, and scoped Memory combined |
| 019 | [Newsroom fact-check desk](<./Scenario 019 — Newsroom Fact-Check Desk.md>) | Evidence separation and an editor's sign-off |
| 020 | [Clinical trial protocol framing](<./Scenario 020 — Clinical Trial Protocol Framing.md>) | Delegation, governance, and ethics sign-off |
| 021 | [Energy grid operations](<./Scenario 021 — Energy Grid Operations.md>) | Three Functions, deny policy, Schedule, Delegation |
| 022 | [University research administration](<./Scenario 022 — University Research Administration.md>) | Governance, Schedule, Memory, and go/no-go |
| 023 | [Document review with an Artefact](<./Scenario 023 — Document Review with an Artefact.md>) | Exact-version Artefact hashing and signed review |
| 024 | [Airline disruption management](<./Scenario 024 — Airline Disruption Management.md>) | Delegation, Schedule, and a duty-manager decision |
| 025 | [Charity safeguarding intake](<./Scenario 025 — Charity Safeguarding Intake.md>) | Governance, Memory, rejection, and human referral |
| 026 | [Hospital patient flow](<./Scenario 026 — Hospital Patient Flow.md>) | Three Functions, governance, Schedule, Delegation |
| 027 | [Bank lending review](<./Scenario 027 — Bank Lending Review.md>) | Artefact-grounded analysis and a credit decision |
| 028 | [Editorial pipeline event chain](<./Scenario 028 — Editorial Pipeline Event Chain.md>) | Deterministic event rule chaining Tasks |
| 029 | [Standards document versioning](<./Scenario 029 — Standards Document Versioning.md>) | Reject a version, approve the corrected version |
| 030 | [Conservation operations](<./Scenario 030 — Conservation Operations.md>) | Three Functions, deny, Delegation, Schedule, Memory |
| 031 | [Agricultural advisory](<./Scenario 031 — Agricultural Advisory.md>) | Governance, Schedule, Memory, adviser sign-off |
| 032 | [Water utility operations](<./Scenario 032 — Water Utility Operations.md>) | Three Functions, deny, Delegation, operator decision |
| 033 | [Aviation maintenance planning](<./Scenario 033 — Aviation Maintenance Planning.md>) | Delegation, governance, engineer sign-off |
| 034 | [Online platform trust & safety](<./Scenario 034 — Online Platform Trust and Safety.md>) | Governance, Memory, rejection, human decision |
| 035 | [Telecom NOC event chain](<./Scenario 035 — Telecom NOC Event Chain.md>) | Event rule chaining a completed analysis |
| 036 | [Retail supply chain planning](<./Scenario 036 — Retail Supply Chain Planning.md>) | Schedule, Delegation, and an ordering decision |
| 037 | [Government benefits assessment](<./Scenario 037 — Government Benefits Assessment.md>) | Governance, Memory, rejection, fair-process decision |
| 038 | [Pharmaceutical manufacturing deviation](<./Scenario 038 — Pharmaceutical Manufacturing Deviation.md>) | Governance, Memory, Delegation, quality sign-off |
| 039 | [Port logistics health](<./Scenario 039 — Port Logistics Health.md>) | Operational Health from outcomes vs Unknown |
| 040 | [Cost estimation from an Artefact](<./Scenario 040 — Cost Estimation from an Artefact.md>) | Artefact-grounded estimate; missing inputs listed |
| 041 | [Museum acquisition ethics](<./Scenario 041 — Museum Acquisition Ethics.md>) | Artefact provenance, governance, curator decision |
| 042 | [Real-estate development feasibility](<./Scenario 042 — Real Estate Development Feasibility.md>) | Three Functions, Schedule, Delegation, go/no-go |
| 043 | [Mining operations safety](<./Scenario 043 — Mining Operations Safety.md>) | Deny, Delegation, Memory, ground-control decision |
| 044 | [Food safety recall assessment](<./Scenario 044 — Food Safety Recall Assessment.md>) | Governance, Memory, Delegation, recall decision |
| 045 | [Academic integrity review](<./Scenario 045 — Academic Integrity Review.md>) | Governance, Memory, rejection, fair-process decision |
| 046 | [Waste management route planning](<./Scenario 046 — Waste Management Route Planning.md>) | Schedule, Delegation, ordering decision |
| 047 | [Disaster recovery coordination](<./Scenario 047 — Disaster Recovery Coordination.md>) | Three Functions, Schedule, Delegation, priorities |
| 048 | [Smart port operations](<./Scenario 048 — Smart Port Operations.md>) | Capstone: four Functions, deny, Schedule, Memory, Delegation |
| 049 | [Integrated health system](<./Scenario 049 — Integrated Health System.md>) | Capstone: four Functions, Artefact, Delegation, clinical sign-off |
| 050 | [National emergency management](<./Scenario 050 — National Emergency Management.md>) | Finale: five Functions, deny, Artefact, Delegation, controller decision |
| 051 | [Architecture practice artefact round trip](<./Scenario 051 — Architecture Practice Artefact Round Trip.md>) | Three Humans, exact-version review, a document out and back, versioned approval |

## What is checked automatically

`src/ui/uiScenarioDocsConformance.test.ts` runs with the normal test suite and
keeps these documents honest as the terminal changes. It verifies that every
scenario:

- uses only commands in the primary terminal help catalog;
- uses only flags that each command's own `/help` usage documents, so a renamed
  or removed flag fails the build instead of silently misleading a reader;
- does not reintroduce removed low-level syntax;
- contains commands, a verification step, and a safe completion condition.

The same flag and command checks run across the whole of `cli/docs/`, together
with a relative-link check.

These are static checks. They prove a scenario is still *expressible* in the
current terminal; they do not execute it. Running a scenario end to end needs a
local model provider and human judgement about the result, so that stays a
manual exercise.

## Two ways Arturo creates work

- `/ask "<objective>"` plans bounded, one-off workflow work. Use it for a deliverable with a clear end. It stops at a plan; `/start <workflow-run-id>` creates the Tasks and begins execution.
- A running Function evaluates `/event publish ...` signals and may create Tasks. Use it for an enduring organisational responsibility.
- `/task create "<task>" [--job "<job>"]` directly creates one bounded Task. Arturo infers its Function only when one is clearly suitable, then uses that Function's staffed Worker capabilities.
- `/workflow create ... --step ...` saves an explicit multi-Worker sequence, and `/run <workflow>` starts it.

These are different operating modes. None of them implies access to websites, inboxes, repositories, databases, laboratory systems, business applications, or current records unless a connector has explicitly been configured.

## Evidence and safety rules

- `Unverified model synthesis` is a proposal, not established fact.
- Human-entered Memory is an assertion, not independent verification.
- Approval authorises execution; it does not certify the resulting answer.
- Worker chat is read-only. It cannot send email, change records, approve work, or execute tools.
- Registering a Human Worker does not prove identity, employment, qualifications, or legal authority.
- Do not place secrets, personal information, privileged material, health data, claim files, credentials, or live incident data into these synthetic exercises.
- High-impact decisions remain with properly authorised people using verified evidence.

## How to verify a scenario

Use the supported inspection surface:

```text
/overview
/workers
/tasks
/task inspect <task-id>
/events
/timeline
/approvals
/human-tasks
/artefacts
```

For an enduring Function, also use:

```text
/function inspect "<job>"
/health "<job>"
/memory
```

Exact prose is model-generated, so verify lifecycle state, routing, evidence labels, approvals, and audit records rather than matching a sample paragraph word for word.
