# Arturo Reader Guide — Structural Outline

> **Status:** This is a plan and map for the reader guide. It is
> not a command guide and does not claim that every idea exists in the product.

This file describes the structure of the maintained Arturo reader guide in `docs/`. It is planning and navigation material, not a CLI command reference. Use [README.md](README.md), `../cli/docs/`, and `/help` for executable behavior.

The numbered guide in this repository begins at Chapter 3 and ends at Chapter 40. Chapters 1 and 2 are not markdown files here and must not be written as though they were.

Chapters 1 and 2 do exist, as pages on the documentation site: Getting started (`/docs`) and Installation (`/docs/installation`). They stayed as pages because Installation shows either a download link or an early-access form depending on whether a build has been released, which a markdown chapter cannot do. If either is ever moved into this repository, it becomes `Chapter_1_*.md` or `Chapter_2_*.md` and the site page redirects to it.

## The book's progression

The guide builds one mental model in stages:

```text
Enterprise identity
  -> enduring capabilities
  -> governed execution
  -> collaboration
  -> enterprise design
  -> controlled evolution
  -> product direction and durable Artefacts
```

Commands are used where the current CLI supports the lesson. Later chapters also use current commands to approximate proposed architecture, but they must label that distinction explicitly.

## Part I — Building the Enterprise

**Question:** What organization are we creating, and what must it be capable of doing?

| Chapter | Title | Reader outcome |
|---:|---|---|
| 3 | Your First Enterprise | Create, inspect, and understand organizational identity. |
| 4 | Your First Business Function | Declare an enduring capability separately from its implementation. |

At the end of this part, the reader has an Enterprise and Business Functions. Nothing needs to execute yet.

## Part II — The Autonomous Enterprise Engine

**Question:** How does an AI-native organization operate continuously?

| Chapter | Title | Reader outcome |
|---:|---|---|
| 5 | Bringing a Business Function to Life | Start and inspect a Business Function Runtime. |
| 6 | Tasks | Distinguish bounded work from an ongoing Function, and learn why a Task cannot exist without a staffed Worker. |
| 7 | Workers | Register bounded AI execution capacity, assign it with /staff, and follow the Task through to its evidence status. |
| 8 | Operational Memory: How Organisations Learn | Retain curated assertions without treating model output as fact. |
| 9 | Events: The History of an AI-Native Enterprise | Publish signals and inspect their durable consequences. |
| 10 | Health Models: Knowing Whether an Organisation Is Succeeding | Interpret operational health without confusing it with business truth. |

These concepts form the operational core:

```text
Event -> Runtime -> Task -> Worker -> result
           |                  |
           +-> Health         +-> evidence review
           |
           +-> eligible Operational Memory
```

The actual flow is governed and evidence-sensitive. Not every result becomes Memory, and a completed Task is not automatically a verified outcome.

## Part III — Safe Autonomy

**Question:** How does Arturo keep humans in control of consequential work?

| Chapter | Title | Reader outcome |
|---:|---|---|
| 11 | Governance: Keeping Humans in Control | Define and inspect enforceable policy. |
| 12 | Approvals: Human Decisions in AI-Native Enterprises | Gate work and record approval or rejection. |
| 13 | Human Workers: First-Class Participants | Represent humans distinctly from AI Workers. |
| 14 | Risk: Managing Uncertainty | Exercise supported risk-aware controls without inventing a `/risk` command. |
| 15 | Auditability: Building Trust | Reconstruct what happened from Tasks, approvals, Events, and Timeline records. |

This part establishes a central rule: model reasoning can inform a decision, but deterministic policy and accountable human authority control whether consequential work proceeds.

## Part IV — Collaboration

**Question:** How do Business Functions cooperate while preserving ownership and accountability?

| Chapter | Title | Reader outcome |
|---:|---|---|
| 16 | Business Function Collaboration | Coordinate without collapsing Function boundaries. |
| 17 | Events as Organisational Communication | Communicate through durable signals. |
| 18 | Delegation | Transfer bounded work while the requesting Function retains accountability. |
| 19 | Shared Workers | Reuse capability across related work without naming models as organizational roles. |
| 20 | Collaboration Through Operational Memory | Share curated knowledge at an appropriate scope. |
| 21 | Collaboration Through Health | Compare operational signals across Functions. |
| 22 | Conflict Resolution | Record a human adjudication with rationale and required action. |
| 23 | Multi-Enterprise Collaboration | Model a second Enterprise and verify the current cross-Enterprise boundary. |
| 24 | Designing Organisational Ecosystems | Design explicit ownership and loose coupling. |
| 25 | Emergent Behaviour | Observe system interactions without claiming uncontrolled autonomy. |

Current Delegation is intra-Enterprise. Cross-Enterprise delegation, shared trust protocols, and federation remain future architecture.

## Part V — Designing Enterprises and Products

**Question:** How can the architecture be applied to a real organizational design?

| Chapter | Title | Reader outcome |
|---:|---|---|
| 26 | Designing AI-Native Startups | Build the smallest useful Enterprise around enduring capabilities. |
| 27 | Scaling Enterprises | Assess whether boundaries, Workers, Governance, and observability are ready to scale. |
| 28 | Designing AI-Native Products | Separate product experiences from shared organizational capabilities. |
| 29 | Designing Your Own Enterprise | Combine supported primitives into a reusable design exercise. |

Six domain chapters — healthcare, financial services, manufacturing, government, education, and scientific research — used to sit between 28 and this one. They applied a single shared skeleton to a different synthetic industry each time and taught no command the operating journey had not already covered, which made them tutorials rather than chapters. They have been removed.

## Part VI — Enterprise Evolution

**Question:** How can an Enterprise change without losing safety, identity, or auditability?

| Chapter | Title | Reader outcome |
|---:|---|---|
| 30 | Enterprise Evolution | Classify and rehearse controlled organizational change. |
| 31 | Versioning and Migration | Use additive parallel structures to approximate migration safely. |
| 32 | Enterprise Simulation | Conduct bounded scenario analysis without claiming a simulation engine. |
| 33 | Digital Twins | Review supplied snapshots without claiming synchronized live twins. |
| 34 | Enterprise Optimisation | Compare explicit candidates while keeping objectives and constraints human-controlled. |
| 35 | Autonomous Strategy | Generate governed options without delegating strategic authority. |
| 36 | Federated Enterprise Networks | Define and test boundaries without claiming a federation protocol exists. |
| 37 | Economic Modelling | Keep deterministic arithmetic separate from model interpretation. |
| 38 | Self-Improving Enterprises | Propose evidence-gated improvements without enabling self-modifying production behavior. |

Most concepts in Chapters 31–38 are target architecture. Their hands-on sections deliberately approximate the ideas using supported Arturo primitives and external records.

## Part VII — Product Direction and Durable Work

**Question:** What must Arturo become to operate as a credible platform rather than only a terminal demonstration?

| Chapter | Title | Reader outcome |
|---:|---|---|
| 39 | The Future of AI-Native Organisations | Understand the product thesis, current reality, roadmap, and investor demonstration boundary. |
| 40 | Artefacts | Distinguish durable work products from terminal text and rehearse an external Artefact manifest. |

Chapter 39 is a roadmap, not a prediction or implementation claim. Chapter 40 is the final numbered chapter currently present; native Artefact identity, versioning, review attachment, lineage, and release commands remain target architecture.

## Editorial rules for every chapter

Each maintained chapter should:

1. State its starting assumptions and intended reader outcome.
2. Use exact, copyable commands where current functionality exists.
3. Explain what state should change and how the reader verifies it.
4. Mark illustrative output as illustrative.
5. Separate current behavior, current approximation, and target architecture.
6. Treat model output as unverified unless evidence establishes otherwise.
7. Preserve deterministic Governance and human authority for consequential decisions.
8. Include limitations, likely failure modes, and a recovery path where relevant.
9. Avoid names such as `GPT-5` for Workers; use organizational role names and show the model separately.
10. End with a clear completion check or transition to the next chapter.

## Companion documentation

- [README.md](README.md) is the documentation landing page and command-oriented chapter map.
- `../cli/docs/` describes installation and current CLI scenarios.
- `ANEA/` defines the architecture and conformance model.
- [Worker_Chat.md](Worker_Chat.md) documents the read-only Worker-chat boundary.
- Chapters 31 through 38 describe future-facing ideas. Their command examples
  must clearly say when a command is not implemented.

When documentation and implementation disagree, `/help`, current command handlers, and their tests establish executable behavior. The documentation should then be corrected.
