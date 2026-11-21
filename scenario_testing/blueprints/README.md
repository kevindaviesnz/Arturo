# The five blueprints, plus the event-driven one

Six sessions, one per business blueprint, run against the real CLI product
with the local model and captured with `run_scenario_clean.sh`, so nothing in
these transcripts is written by hand.

These are not sizzle reels: they are runnable evidence, and everything below is
written on the assumption that a reader will pause and inspect what is on screen.

| Film | Plan | What it shows |
|---|---|---|
| Blueprint 1 — Pure Digital Pipeline | `blueprint-1-pipeline.plan` | AI → Arturo → AI, no person in the line. The second Task is created once the first has finished and continues from it, so Arturo carries the triage across. Ends on a drafted reply. |
| Blueprint 2 — The Dispatcher | `blueprint-2-dispatcher.plan` | AI produces picking directives; a named person does the physical work and reports back. |
| Blueprint 3 — The Sensor | `blueprint-3-sensor.plan` | A person inspects a violin; the AI reasons about what they found, handed to it by Arturo rather than retyped. |
| Blueprint 4 — The Orchestrator | `blueprint-4-orchestrator.plan` | `/tasks` and `/human-tasks` open at once; a third Task needs both halves. |
| Blueprint 5 — The Prototyper | `blueprint-5-prototyper.plan` | AI design → physical drop test → AI revision caused by the failure. The technician is handed the design; they do not build from a drawing they were never shown. |
| Blueprint 6 — Event driven | `blueprint-6-event-driven.plan` | **Film this one first.** One typed command; a second Function creates and completes work nobody asked for. |

Plans are in `cli/scenario_harness/plans/`. To re-record:

```bash
cd cli
bash scenario_harness/run_scenario_clean.sh \
  scenario_harness/plans/blueprint-6-event-driven.plan bp6 \
  "../scenario_testing/blueprints/Blueprint 6 — Event driven.txt"
```

That streams the session to the terminal at human typing speed, which is what
you film. `ARTURO_DEMO_TYPE_DELAY=0 ARTURO_DEMO_READ_PAUSE=0` makes it run fast
when you only want to check it still works.

## What these do not show

A diligence viewer will find these anyway. Better they hear them from you, in
this order, than notice them and wonder what else was not mentioned.

- **Nothing leaves Arturo.** The support reply in Blueprint 1 is drafted, not
  sent; no email connector is configured. Sending, querying a payment database,
  scraping auction sites and SSH-ing into a machine all appear in the written
  blueprint examples and none of them happen here.

  This is the one to lead with rather than apologise for. A Task that *could*
  send email requests a consequential capability, and consequential work stops
  and waits for a named person to approve it — that is the product's central
  claim, demonstrated. Configure a real email connector and Blueprint 1 gains a
  step: it stops at `/approvals` instead of finishing. Worth saying out loud,
  because "it drafted but did not send" and "it stopped because sending needs a
  person" look identical on screen and only one of them is the point.
- **The physical steps are records, not actions.** A Human Task is Arturo asking
  a named person to do something and recording what they say they did. Nobody
  verifies that the box was packed. Blueprints 2–5 all rest on this, and a
  design partner evaluating warehouse or lab use will ask about it within a
  minute.
- **Every AI result carries "an AI model wrote it; nobody has checked it".**
  That label is in shot deliberately. For this audience it is an asset — it is
  the difference between a demo that claims work was done and one that shows
  what was actually established. Do not crop it.
- **Pre-release rough edges are visible**, and behind an NDA that is fine.
  Worker names vary run to run, the local model's prose is workmanlike, and
  `/staff` proposes a different team each time. None of that needs hiding from
  someone who has signed to look closely; smoothing it would cost more
  credibility than it buys.

## Re-recording is not deterministic

The local model decides some of this, so a re-run is not guaranteed to produce
the same session:

- **Blueprint 6 depends on a model judgement.** Editorial Review decides for
  itself whether the "article drafted" Event warrants work. Across runs it has
  created a Task, declined ("no signal to advance the objective"), and — before
  the repair-attempt fix — failed to return valid JSON at all. It is now
  reliable in testing, but check the run before you film it: the `/timeline`
  should show **Task created**, and the second Task should have actually
  reviewed the article rather than reporting that it had nothing to review.

  That second check matters because it was failing. The Event carried the source
  Task's id but nothing passed its *result* on, so the reviewing Worker was
  asked to review an article it had never seen and said so. A Task created from
  an Event now receives the completed work that caused it, labelled as another
  Worker's unchecked output.
- **`/staff` proposes a different team each time**, so the Worker names in these
  transcripts will not match a fresh run. Each plan therefore refines Worker
  **1** by position rather than by name — `/staff` registers in plan order, so
  that is always the Worker for the first Function.
- **Every blueprint now briefs its AI Worker before using it.** `/staff`
  proposes a generic analyst; `/refine-worker` turns it into a specialist, in
  the second person, because the text is appended to the Worker's prompt and is
  read as one. This is not decoration — in Blueprint 3 the brief is what stopped
  the model calling a 356mm violin an octave violin, by forcing it to reason
  from the luthier's findings rather than infer from a measurement.
- **A person's name that reads like a job title used to break `/staff`
  outright.** With "Workshop Luthier" or "Editor in Chief" registered first, the
  planner kept proposing that human as an AI Worker, the validator refused three
  times, and the whole staffing plan failed — leaving the Enterprise with no
  Workers and the demo dead at the first Task. It killed a Blueprint 6 take.
  Fixed: a colliding proposal is now renamed rather than failing the plan, the
  same treatment an uninformative name already got. The plans still register
  people after `/staff`, because a renamed Worker is avoidable noise in a
  recording.

Blueprint 2's transcript contains a `localhost:8788` human-task review link with
a token in it, scoped to a throwaway data directory. Behind the NDA there is no
reason to crop it, and leaving it in answers a question a technical viewer will
have anyway: how a person who does not use the terminal takes part. The
credential is HMAC-signed, names its reviewer and expires after 24 hours — which
is worth a sentence if anyone asks.
