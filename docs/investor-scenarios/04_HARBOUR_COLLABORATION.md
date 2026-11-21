# Level 4 — Harbour Learning

## AI Workers and Humans collaborate without losing ownership

**Time:** approximately twelve minutes.

**Purpose:** show bounded delegation, read-only Worker Chat, scoped Operational
Memory, and durable Human Tasks.

## Start isolated state

From `cli/`:

```bash
mkdir -p .data/investor-04-harbour
ARTURO_DATA_DIRECTORY=.data/investor-04-harbour \
ARTURO_RUNTIME_DATABASE_PATH=.data/investor-04-harbour/runtime.db \
npm run ui
```

Configure `HUMAN_TASK_TOKEN_SECRET` only if signed browser links are required.
CLI Human Tasks work without browser links.

## Opening

Say:

> SafePlay Labs showed control over one governed Task. Harbour Learning shows a
> mixed Human–AI organisation coordinating work while keeping accountability
> visible.

## 1. Create a collaborative Enterprise

Type each command on its own and answer Arturo's questions.

```text
/enterprise
```

Choose `1`; `Harbour Learning`, described as `Create accessible community
learning workshops from supplied local needs.`

```text
/function
```

Choose `1`; `Programme Design`, objective `Own workshop goals, audience needs,
and final programme decisions.` Run `/function` again for `Learning Resources`,
objective `Prepare bounded learning-resource options requested by Programme
Design.`

```text
/add-human-worker
```

Name them `Programme Lead`, then choose the role that signs off.

```text
/staff
/workers
```

Accept the AI Workers Arturo proposes for both Functions. Their names vary
between runs.

## 2. Start the receiving Function

```text
/function start "Programme Design"
/function start "Learning Resources"
/function inspect "Learning Resources"
```

## 3. Delegate bounded work

```text
/delegation
```

Choose `1`. Arturo asks which Function needs the help (`Programme Design`),
which one should do the work (`Learning Resources`), and what the work is:

> Prepare three low-cost physical activity-card formats for an adult community
> workshop; identify assumptions and do not claim user testing.

Only Functions that are **running** are offered as receivers, which is why step
2 starts them first. Then:

```text
/delegation
```

Choose `2` to list what has been handed over.

Copy the Delegation and Task IDs. Wait for completion, then:

```text
/delegation inspect <delegation-id>
/task inspect <task-id>
```

Explain that Programme Design retains accountability while Learning Resources
performs bounded work.

## 4. Interrogate the Worker

```text
/chat "Resource Development Analyst" "Which parts of the delegated result are supplied facts, assumptions, or unverified model suggestions?"
```

Then test the boundary:

```text
/chat "Resource Development Analyst" "Email the preferred option to every workshop participant."
```

Point out:

```text
Mode: READ-ONLY WORKER CHAT
Actions executed: none
```

Clear the process-local conversation:

```text
/chat clear "Resource Development Analyst"
```

## 5. Add scoped organisational context

```text
/memory add "Harbour Learning workshops use physical activity cards rather than a mobile application unless a programme decision explicitly changes the format." --scope "Harbour Learning"
/memory
```

Explain that this is labelled as a Human-entered assertion, not independent
evidence.

## 6. Give the accountable decision to a Human

```text
/create-human-task "Select the workshop prototype format" "Review the delegated options and decide which one may proceed to a small prototype. Record the rationale, missing evidence, and next action."
/human-tasks
```

Copy the Human Task ID:

```text
/complete-human-task <human-task-id> "Proceed with one printable large-text card prototype. Before wider use, obtain accessibility feedback from intended participants and record any required revisions." --as "Programme Lead"
/human-task <human-task-id>
/timeline
```

## What to explain

- Delegation transfers bounded work, not accountability.
- Chat provides conversational access without operational authority.
- Memory is scoped and provenance-labelled.
- Human Tasks preserve decisions that would otherwise disappear into email or
  meeting notes.
- None of these records proves that external research or participant testing
  occurred.

## Close

Say:

> Arturo lets AI and Human colleagues work inside one inspectable operating
> model. Conversation, execution, organisational memory, and accountable
> decisions remain distinct.

## If something goes wrong

- Cross-Enterprise delegation is intentionally unsupported; both Functions
  must belong to Harbour Learning.
- If capability routing cannot find the Analyst, inspect `/workers
  --capability "analysis"`.
- Browser-link unavailability does not prevent CLI completion of a Human Task.

## Investor takeaway

Arturo coordinates collaboration while retaining ownership, provenance, and
Human accountability.
