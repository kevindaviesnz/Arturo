# Command reference

Every command on Arturo's primary terminal surface, in the same groups the
running terminal uses.

This page exists so a command can be found without already knowing its name.
It is deliberately one line per command: the running terminal holds the exact
syntax, prerequisites, switches, verification steps, and safety boundaries.

```text
/help              the same groups, from the running build
/help <command>    concept, syntax, examples, side effects, boundaries
/help all          the separate low-level developer surface
```

If this page and `/help` disagree, `/help` is right and this page is stale.
A test (`src/ui/uiCommandReferenceDoc.test.ts`) fails when a primary command is
missing from the tables below, so a new command cannot ship undocumented.

## Start and design

| Command | What it does |
|---|---|
| `/overview` | Show the live executive view of the current Arturo state. |
| `/setup` | Set up a business: its name, who runs it, and what it does. |
| `/enterprise` | Create, inspect, update, or list Enterprises. |
| `/next` | Recommend ongoing Functions, one at a time, for you to accept or decline. |
| `/functions` | List the ongoing Functions. |
| `/function` | Create, update, inspect, list, start, or remove one ongoing Function. |
| `/staff` | Generate an Enterprise-specific, AI-assisted staffing proposal. |
| `/suggest` | Ask Arturo to propose bounded Tasks a staffed Function could do now. |

## Clients

| Command | What it does |
|---|---|
| `/talk` | Tell your assistant about a new client in your own words. |
| `/assistant` | See who takes down new clients, or have Arturo propose a Personal Assistant. |
| `/clients` | List a business's clients. |
| `/work` | Open named work (a matter, a book or a deal), list or inspect it, turn "no AI" on for it, or cancel it. |
| `/client` | Add a client directly, after checking for one already recorded who may be the same. |

## Workers and work

| Command | What it does |
|---|---|
| `/workers` | List, inspect, or safely remove registered AI and Human Workers. |
| `/archetypes` | Compare Worker archetypes or inspect their capabilities and prompt guardrails. |
| `/capabilities` | List Arturo's canonical Worker-routing capabilities or explain one capability. |
| `/add-ai-worker` | Register an AI Worker with an archetype and optional specialization. |
| `/add-human-worker` | Register a Human Worker with optional role guidance, contact metadata, availability, and specialization. |
| `/refine-worker` | Update a Worker's specialization using the supported refinement workflow. |
| `/tasks` | List bounded Tasks and their current state, routing, evidence, and result preview. |
| `/task` | Create one bounded Task for an ongoing Function, or inspect one complete Task record. |
| `/chat` | Talk to an AI Worker in a process-local, read-only conversation. |
| `/ask` | Submit a one-off plain-English objective to Arturo's workflow planner. |

`/ask` stops at a plan on purpose. It writes the steps down and chooses a Worker
for each, and nothing executes until `/start <workflow-run-id>` creates the
Tasks. Read the plan first; the run ID is printed by `/ask`. `/start` is in
[Beyond the primary surface](#beyond-the-primary-surface).

## Knowledge and operations

| Command | What it does |
|---|---|
| `/artefacts` | List versioned file and external-reference Artefacts. |
| `/artefact` | Add, version, inspect, verify, submit, and review exact Artefact versions. |
| `/memory` | Inspect, add, or remove Operational Memory with explicit scope. |
| `/event` | Publish an organizational Event manually, or manage deterministic rules that publish after eligible Tasks complete. |
| `/schedule` | Create, inspect, list, or remove a persistent daily or weekly Schedule for one bounded Task. |
| `/events` | List the durable organizational Event history. |
| `/health` | Compute operational Health for one ongoing Function. |
| `/delegation` | Delegate one bounded Task between ongoing Functions in the same Enterprise. |
| `/timeline` | Show recent audit Timeline records in reverse chronological order. |
| `/web-search` | Inspect governed Web Search configuration, domain policy, and process-local call usage. |
| `/model` | Choose which AI model Arturo uses, by number, in plain words. |
| `/model-routing` | Inspect the effective local-first policy, approved aliases, and external-call session cap. |

Which model does Arturo's thinking is chosen once, with `/model`, and holds for
every model-backed command until you change it there. See
[Model routing](../../docs/Model_Routing.md).

## Governance and people

| Command | What it does |
|---|---|
| `/governance` | Inspect Governance or manage deterministic policies. |
| `/approvals` | List pending and recorded approval decisions. |
| `/approve` | Approve a governed Task using the configured signing controls. |
| `/reject` | Reject a governed Task and record the reason. |
| `/approval-status` | Inspect the approval chain for one Task. |
| `/human-tasks` | List Human Tasks and their states. |
| `/human-task` | Inspect one Human Task, its instructions, notes, and available actions. |
| `/create-human-task` | Create and optionally assign a Human Task with exact input Artefacts. |
| `/complete-human-task` | Complete a Human Task, preserve attribution, and attach exact output Artefacts. |
| `/block-task` | Mark a Human Task blocked and record why. |
| `/revise-task` | Return a Human Task for revision with explicit instructions. |

Approval authorises the proposed execution boundary. It is not a judgement that
the eventual result is correct, safe, or externally verified.

## Terminal

| Command | What it does |
|---|---|
| `/clear` | Clear the terminal display without deleting Arturo records. |
| `/reset` | Delete application state and return Arturo to first-use state. |
| `/help` | Show the command overview or detailed help for one command. |
| `/exit` | Stop the native terminal interface. |

`/clear` affects the display only. `/reset` is destructive, asks for
confirmation, and has no undo.

## Older names Arturo still accepts

These remain accepted so existing scripts and transcripts keep working. They are
kept out of the main guide because a new reader should learn the current name.

| Older name | Use instead |
|---|---|
| `/jobs` | `/functions` |
| `/job` | `/function` |
| `/start-functions` | `/function start`, one Function at a time |
| `/task-cap` | `/task create` |
| `/models` | `/model` — the same chooser under both names |

## Beyond the primary surface

`/help all` lists low-level kernel and legacy developer commands — scheduler
ticks, replay, snapshots, direct process control. They are exposed for
development, not recommended product workflow, and are not listed here.

Three multi-Worker Workflow commands sit here too. They work, and `/help
<command>` documents each in full, but no scenario runs them end to end — and
this guide advertises what a scenario runs, because a command nothing exercises
is a command nobody has watched fail.

| Command | What it does |
|---|---|
| `/workflow-worker` | Register a bounded deterministic Worker from a JSON definition. |
| `/workflow-run` | Queue input for a deterministic Worker through ordinary Job governance. |
| `/worker-availability` | Persist whether a Worker accepts new work: available, busy, or offline. |
| `/start` | Start a drafted workflow plan and create its Tasks. |
| `/workflow` | Create a reusable model-planned or explicitly ordered multi-Worker Workflow. |
| `/run` | Start a saved Workflow and progress through its AI, Human Task, and Human review steps. |

Never infer that a command exists from command-like typography in a document. A
command is executable only when `/help` lists it and a current handler and test
back it.
