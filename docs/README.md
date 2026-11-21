# Arturo documentation and command guide

If Arturo is new to you, begin with
[Arturo in plain English](./START_HERE.md). Keep the
[plain-language glossary](./GLOSSARY.md) open while reading.

For worked end-to-end demonstrations, begin with the [progressive scenario suite](./investor-scenarios/README.md), which uses a new Enterprise at each level, and [Arturo Builds Arturo](./ARTURO_BUILDS_ARTURO.md), a clearly disclosed counterfactual reconstruction based on real development experiences.

This folder has beginner lessons, advanced design chapters, and technical
architecture documents. They are not all command manuals.

- Use `../cli/docs/getting_started.md`, `../cli/docs/mvp-happy-path.md`, and `/help` for current executable CLI behavior.
- Command transcripts in Chapters 3–10 are maintained teaching examples, but output fields explicitly described as illustrative may change.
- Chapters describing simulation, digital twins, autonomous strategy, federation, economic modelling, and self-improvement are target architecture unless a current CLI command and test are linked from the chapter.
- `ANEA/` defines architectural concepts and conformance goals. It must not be read as a claim that every capability is implemented by the current MVP.

When implementation and architecture differ, the current CLI reference and tests describe software behavior; the architecture documents describe intended design.

## Current words and older chapter words

The terminal now uses simpler words:

| Current terminal word | Older architecture word | Meaning |
|---|---|---|
| Function | Business Function, Job | An ongoing responsibility the Enterprise must keep doing. |
| Task | Job | One bounded piece of work with a stopping point. |
| Function operating state | Runtime | The internal process behind a started Function. |

Older chapter filenames and internal TypeScript names are retained so links,
stored data, and architectural references do not break. New command examples
use `/function`, `/functions`, `/task`, and `/tasks`. Chapters written before
the rename use `/job` and `/jobs`, which Arturo still accepts as compatibility
aliases.

`/runtime` has been **removed**. It was an alias for the internal term, and a
Runtime is not something an operator names: use `/function start` to begin a
Function's operating state and `/function inspect` to see it.

The complete list of current commands is
[`../cli/docs/command-reference.md`](../cli/docs/command-reference.md); `/help`
in the running terminal is the authority when the two disagree.

## How to use this guide

Read the chapters in order for the full teaching journey, or use the part map below to enter at the topic you need.

| Part | Chapters | Question answered | Implementation character |
|---|---:|---|---|
| Foundations | 3–4 | What is the Enterprise and what capabilities does it need? | Hands-on current CLI |
| Execution | 5–10 | How does work run, learn, communicate, and report health? | Hands-on current CLI |
| Safe autonomy | 11–15 | How are AI actions constrained, approved, and audited? | Hands-on current CLI, with stated boundaries |
| Collaboration | 16–25 | How do Functions coordinate without losing ownership? | Mixed: current exercises and architectural patterns |
| Design | 26–29 | How should an AI-native Enterprise be designed? | Current construction exercises |
| Evolution | 30–38 | How might an Enterprise evolve, simulate, optimize, federate, and improve? | Current approximations of mostly target architecture |
| Product direction | 39–40 | Where is Arturo going, and how should durable work products be represented? | Roadmap plus executable approximations |

Every chapter should identify whether a command is supported now, an approximation using current primitives, or proposed future syntax. Do not paste the illustrative `arturo ›` prompt. Replace values such as `<task-id>` with real identifiers from your own output.

## Chapters 3–15: current operating journey

Chapters 3–15 form the current hands-on Arturo journey. Each operational chapter contains copyable commands, an expected outcome, implementation boundaries, and a completion check. Enter commands without the illustrative `arturo ›` or `os>` prompt.

| Chapter | Practical outcome | Primary commands |
|---|---|---|
| 3 — Enterprise | Set up the business and inspect what it recorded | `/enterprise` |
| 4 — Business Function | Declare an ongoing responsibility and inspect it | `/function` |
| 5 — Bringing a Function to life | Start a Function running and publish an Event it can react to | `/function`, `/event`, `/timeline` |
| 6 — Tasks | Ask for one bounded piece of work and learn why it needs a staffed Worker | `/tasks`, `/task` |
| 7 — Workers | Add a Worker, assign it to the Function, and route the Task | `/archetypes`, `/add-ai-worker`, `/workers`, `/staff`, `/task` |
| 8 — Operational Memory | Write a note, choose what it applies to, read it back, and remove it | `/memory` |
| 9 — Events | Announce that something happened, watch a Function react, then have Arturo announce for you | `/event`, `/events`, `/timeline`, `/schedule` |
| 10 — Health | Read Arturo's operating picture of one Function, and what it does not measure | `/function`, `/health`, `/tasks`, `/events`, `/timeline` |
| 11 — Governance | Add and verify an enforceable policy | `/governance`, `/governance policy add/list/inspect/remove`, `/task create` |
| 12 — Approvals | Approve or reject governed execution | `/approvals`, `/approve`, `/reject`, `/approval-status`, `/timeline` |
| 13 — Human Workers | Add a person and record a decision an AI Worker may not make | `/add-human-worker`, `/workers`, `/create-human-task`, `/human-tasks`, `/complete-human-task` |
| 14 — Risk | Exercise the current risk-aware Governance boundary | `/governance policy add`, `/task create`, `/approvals`, `/approve`, `/timeline` |
| 15 — Auditability | Reconstruct one governed Task end to end, and find where the trail stops proving anything | `/task`, `/approval-status`, `/governance`, `/timeline`, `/human-tasks` |

Use `/help` for the curated command map and `/help <command>` for exact syntax, examples, prerequisites, and safety boundaries. `/help all` is the separate low-level developer surface. Angle-bracket values such as `<task-id>` are placeholders that must be replaced; quote names and descriptions containing spaces.

## Chapters 16–25: collaboration

These chapters move from single-Function operation to organizational coordination.

| Chapter | Practical focus | Current evidence surface |
|---|---|---|
| 16 — Business Function Collaboration | Preserve ownership while Functions cooperate | Design chapter; commands begin in Chapter 17 |
| 17 — Events as Communication | Build a second Function and have the first one's finished work set it going | `/function`, `/staff`, `/event`, `/timeline` |
| 18 — Delegation | Delegate bounded work and inspect the receiving Job | `/delegation request/list/inspect`, `/job`, `/timeline` |
| 19 — Shared Workers | Put one Worker behind two Functions, and see what is not shared | `/workers`, `/workers --capability`, `/staff`, `/function list` |
| 20 — Collaboration Through Memory | Give two Functions a shared standard while keeping private notes private | `/memory` |
| 21 — Collaboration Through Health | Compare ongoing Job health without treating it as business truth | `/job inspect`, `/health`, `/jobs`, `/timeline` |
| 22 — Conflict Resolution | Record a human adjudication and its rationale | `/create-human-task`, `/human-tasks`, `/complete-human-task`, `/human-task`, `/timeline` |
| 23 — Multi-Enterprise Collaboration | Create a second Enterprise and verify the current boundary | `/enterprise create/list/inspect`, `/job create`, `/delegation request` |
| 24 — Organisational Ecosystems | Design explicit ownership and loose coupling | Current inspection commands; ecosystem operations are conceptual |
| 25 — Emergent Behaviour | Observe interactions without claiming autonomous adaptation | `/event publish`, `/events`, `/timeline`, `/tasks` |

Cross-Enterprise delegation is not supported by the current CLI. A rejected attempt is evidence of that boundary, not a federation workflow.

## Chapters 26–29: design

Chapters 26–28 cover startup, scaling, and product design. Chapter 29 brings the supported building blocks together into a reusable Enterprise-design exercise.

The six domain chapters that used to sit here — healthcare, financial services, manufacturing, government, education, and scientific research — have been removed. Each applied the same skeleton to a different synthetic industry, which made them tutorials rather than chapters, and none taught a command the operating journey had not already covered.

The domain chapters are demonstrations, not professional, regulatory, clinical, financial, scientific, or public-sector advice. They deliberately use fictional or synthetic inputs and retain human authority. A completed Job is not proof that its claims are correct.

## Chapters 30–38: evolution and advanced architecture

These chapters distinguish a supported present-day approximation from the richer architecture Arturo may eventually implement:

- Chapter 30 treats evolution as controlled organizational change.
- Chapter 31 models versioning and migration through additive, parallel structures.
- Chapter 32 uses bounded scenario analysis; it does not provide a simulation engine.
- Chapter 33 reviews supplied snapshots; it does not provide synchronized Digital Twins.
- Chapter 34 compares explicit candidates; it does not autonomously optimize an Enterprise.
- Chapter 35 generates governed strategic options; it does not grant autonomous strategic authority.
- Chapter 36 tests federation boundaries; it does not implement a federated protocol.
- Chapter 37 separates deterministic arithmetic from model interpretation; it is not a financial ledger.
- Chapter 38 proposes evidence-gated improvements; it does not allow self-modifying production behavior.

## Chapters 39–40: product direction and Artefacts

Chapter 39 is a product and architecture roadmap grounded in a current-reality checkpoint. Chapter 40 explains and demonstrates Arturo's current versioned Artefact registry, file hashes, Human Task attachments, exact-version Human review, and approval-gated downstream Jobs.

The current CLI records local-file or HTTPS references rather than managing file copies. It does not yet provide uploads, previews, access control, visual diffs, release delivery, retention rules, or a complete document-management lifecycle. Chapter 40 separates those future capabilities from the commands that work today.

## Current implementation boundaries

- Chapter 14 has no `/risk` command. Risk evaluation exists internally; the current exercise uses enforceable Governance, Jobs, Approvals, Events, and Timeline records.
- Chapter 15 has no `/audit export` command. Audit reconstruction uses the persistent views listed above.
- Chapters 16–25 discuss collaboration and organisational patterns. Current Delegation is within one Enterprise; cross-Enterprise collaboration remains unsupported.
- Chapters 26–29 combine executable construction with design exercises. They do not claim connection to real operational systems or authoritative evidence sources.
- Chapter 30 uses supported commands to rehearse controlled evolution; it does not provide native change proposals, versioned Enterprise definitions, or automated rollback.
- Chapters 31–38 are target architecture. Commands shown for contracts, migration, simulation, digital twins, optimisation, autonomous strategy, federation, economic modelling, and self-improvement are illustrative and are not supported unless `/help` lists them in a future build.
- Chapter 39 is a future-facing roadmap, not the final chapter or a CLI tutorial.
- Chapter 40 is the final numbered chapter in this repository. Its `/artefacts` and `/artefact` exercises are supported; managed file storage, preview, delivery, access control, and legal lifecycle remain future work.

Never infer implementation from command-like typography alone. A command is executable only when it is listed by `/help` and backed by current command handling and tests.

## Other documentation sets

- `START_HERE.md` explains the whole product in simple language.
- `GLOSSARY.md` defines Arturo words.
- `DOCUMENTATION_STYLE.md` sets the writing and accuracy rules.
- `../cli/docs/` is the closest documentation to current command behavior and installation workflows.
- `Arturo_Constitution.md` and `The_AI_Native_Enterprise.md` are project-wide product and operating-model documents.
- `architecture/` contains project-wide architectural rationale and clearly labelled historical kernel material.
- `ANEA/` defines the architecture, terminology, conformance goals, and worked architectural examples.
- `Worker_Chat.md` describes the current read-only Worker-chat boundary.
- `WORKER_SANDBOX.md` describes the current host-capability execution guard and the target sandbox architecture.
- `Model_Routing.md` describes the opt-in local-first router, deterministic escalation trigger, and hard session call cap.
- `Chapter_31_...` through `Chapter_38_...` describe future-facing ideas. Each chapter labels commands that are not implemented.
- `book_2_outline.md` is planning material, not a command reference or an implementation claim.

If two documents disagree about executable behavior, verify `/help`, the current handler, and its tests. Then correct the stale documentation rather than relying on the more ambitious claim.

## Documentation maintenance rule

For every new user-facing command or chapter exercise:

1. Add the exact, copyable syntax to the relevant chapter.
2. Include prerequisites, expected state change, verification, and recovery guidance.
3. Verify the command through a test or an existing tested handler.
4. Mark conceptual output as illustrative.
5. State explicitly when no CLI command exists.

This prevents the reader guide from drifting into unsupported product claims.
