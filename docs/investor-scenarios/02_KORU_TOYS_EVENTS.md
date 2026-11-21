# Level 2 — Koru Toys

## Events turn business signals into work

**Time:** approximately eight minutes.

**Purpose:** show that users do not need to type a task every time something
happens. Running Functions can evaluate an Event and create bounded Tasks.

## Start isolated state

From `cli/`:

```bash
mkdir -p .data/investor-02-koru-toys
ARTURO_DATA_DIRECTORY=.data/investor-02-koru-toys \
ARTURO_RUNTIME_DATABASE_PATH=.data/investor-02-koru-toys/runtime.db \
npm run ui
```

## Opening

Say:

> BrightPath showed one manually requested Task. Koru Toys shows the next layer:
> an operating company responding to a business signal.

## 1. Create a new Enterprise

Type each command on its own and answer Arturo's questions.

```text
/enterprise
```

Choose `1`; name it `Koru Toys`, described as `Create inclusive physical
learning toys that support imaginative play.`

```text
/function
```

Choose `1`; `Product Development`, objective `Turn supplied product concepts
into bounded physical-toy development requirements.` Run `/function` again and
add `Learning Design`, objective `Assess supplied physical-toy concepts for
play-based learning opportunities and limitations.`

```text
/functions
```

## 2. Let Arturo propose the Workers

```text
/staff
```

Accept the AI Workers Arturo proposes for each Function. The names and number
vary between runs because the plan is model-generated.

```text
/workers
```

Explain that Arturo routes by capability. Worker names describe roles rather
than model brands.

## 3. Start both Functions

```text
/function start "Product Development"
/function start "Learning Design"
/function inspect "Product Development"
/function inspect "Learning Design"
```

Say:

> A running Function can evaluate organisational Events. Starting it does not
> itself create work.

## 4. Publish one business Event

```text
/event publish "New tactile storytelling kit submitted for concept review" --source "Product Development" --enterprise "Koru Toys"
```

Read the Function evaluations. Model wording and the number of Tasks may vary.
Do not promise that both Functions will always create a Task.

**Give the signal enough substance.** A running Function decides whether an
Event warrants work, and a thin signal is routinely — and correctly — declined
with a reason such as "insufficient information to create task". A vague Event
name produces two honest non-decisions and a flat demonstration. Name the Event
with the specifics a colleague would need, for example:

> New tactile storytelling kit submitted for concept review: fabric cube, ages
> 3+, six illustrated panels, intended for group play in early-learning
> settings.

If both Functions still decline, show the recorded reasons rather than
retrying until the answer looks better. A recorded non-decision is the
product working.

Then inspect:

```text
/tasks
/events
/timeline
```

If a Task is still queued because its generated capability has no matching
Worker, say:

> Arturo has made the gap visible instead of silently assigning incompatible
> capacity.

Add a compatible Worker only when the displayed required capability justifies
it. For example:

```text
/add-ai-worker "Product Review Analyst" --archetype analyst
/staff
```

Registering the Worker makes it exist; `/staff` is what assigns it to the
Function that needs the coverage.

Wait briefly and inspect the relevant record:

```text
/task inspect <task-id>
```

## What to explain

- The user published one Event, not a list of tasks.
- Each running Function independently evaluated relevance.
- Tasks, non-decisions, routing, and results are inspectable.
- Generated work is bounded by the Function objective and supplied Event.
- Model-generated conclusions remain unverified unless supported separately.

## Close

Say:

> The first scenario organised one request. This scenario shows Arturo
> operating continuously: business signals can reach the right capabilities,
> create visible work, and preserve what happened.

## Stop here when

Stop after the Event-to-Task path when the audience understands automated
organisational response. Governance belongs in the next scenario.

## If something goes wrong

- No Task is a valid evaluation outcome; show the recorded reason.
- A queued Task exposes a capability gap; do not disguise it.
- Weak model output is still useful for demonstrating evidence boundaries.
- Use `/clear` if long output obscures the narrative; records remain intact.

## Investor takeaway

Arturo can translate a real organisational signal into capability-owned work
without requiring a founder to manually orchestrate every task.
