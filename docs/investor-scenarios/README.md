# Arturo progressive investor demonstrations

These five self-contained demonstrations introduce Arturo one layer at a time.
Each uses a different Enterprise and an isolated data directory, so concepts
and records from one scenario cannot confuse the next.

| Level | Enterprise | Demonstrates | Typical time |
|---:|---|---|---:|
| 1 | BrightPath Studio | One Function, a proposed team, one approved Task | 6 minutes |
| 2 | Koru Toys | Event-driven work across running Functions | 8 minutes |
| 3 | SafePlay Labs | Deterministic policy and Human approval | 10 minutes |
| 4 | Harbour Learning | Delegation, Worker Chat, Memory, and Human Tasks | 12 minutes |
| 5 | Arturo | Advanced investor and technical-diligence story | 25 minutes |

Every script drives Arturo the way an operator does: type a command on its own
and answer the questions it asks. Arturo takes no switches for any of this —
where a script still shows a flag, it is a scripted shortcut, not the path a
newcomer would take.

Two things vary between runs and must not be scripted or promised:

- `/staff` proposes a model-generated plan, so the Worker names and how many
  are proposed differ each time. Accept what it offers.
- A Function may evaluate an Event and decide no work is needed. That is a
  valid outcome; show the recorded reason.

Start with Level 1 in every first meeting. Continue only while the audience
wants more detail. The demonstrations are not chapters of one fictional
company: each is a fresh example chosen to explain a specific Arturo concept.

## Common preparation

From `cli/`:

```bash
npm install
npm run build
npm run test:run
```

Then check two things that decide whether a live demonstration succeeds:

```text
/model
/model-routing
```

- `/model` lists the model in use first. Confirm it is available.
- `/model-routing` shows whether external escalation is configured. If it is,
  model-backed steps — `/staff` and the Function evaluators that react to
  Events — call a paid provider when the local model's output fails validation,
  and **fail outright** if that provider is unavailable or the configured model
  name is wrong. A failed evaluation appears in the middle of a demonstration
  as `Evaluation failed — <provider> request failed`. Set
  `ARTURO_PAID_ESCALATION_ENABLED=false` for a demonstration unless you intend
  to show escalation.

The model is chosen only with `/model`, and the choice holds until you run
`/model` again. No command takes a model as a switch.

Use synthetic information only. Keep `cli/.env`, provider credentials, source
code, evaluator records, and confidential information off screen.

Each script provides its own launch command. Stop Arturo before starting the
next scenario. Never use `/reset` against state that matters.

## Scripts

1. [BrightPath Studio — the basic demonstration](./01_BRIGHTPATH_BASIC.md)
2. [Koru Toys — event-driven operations](./02_KORU_TOYS_EVENTS.md)
3. [SafePlay Labs — governed execution](./03_SAFEPLAY_GOVERNANCE.md)
4. [Harbour Learning — Human–AI collaboration](./04_HARBOUR_COLLABORATION.md)
5. [Arturo — advanced investor demonstration](./05_ARTURO_ADVANCED.md)

## Presentation rule

Do not rush to the advanced scenario. The first demonstration succeeds when
the audience can explain this sentence:

> Arturo turns an enduring business capability into bounded work performed by
> a visible, replaceable Worker.

Only then introduce automation, Governance, collaboration, and advanced model
routing.
