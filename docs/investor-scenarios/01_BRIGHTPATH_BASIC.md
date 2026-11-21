# Level 1 — BrightPath Studio

## One Function, one team, one Task

**Time:** approximately six minutes.

**Purpose:** show Arturo's simplest useful operating loop without Events,
Delegation, Memory, Human Tasks, or model escalation.

## Before the meeting

From `cli/`, start a fresh isolated state:

```bash
mkdir -p .data/investor-01-brightpath
ARTURO_DATA_DIRECTORY=.data/investor-01-brightpath \
ARTURO_RUNTIME_DATABASE_PATH=.data/investor-01-brightpath/runtime.db \
npm run ui
```

Check two things before you present:

- The configured local model is available. Run `/model`; the model in use is
  listed first and marked "in use now".
- Run `/model-routing`. If external escalation is configured, `/staff` can call
  a paid provider when the local model's plan fails validation three times — and
  will fail outright if that provider is unavailable. Turn escalation off for a
  demonstration unless you intend to show it.

## Opening

Say:

> I will start with Arturo's smallest useful example. A founder has a business
> idea, names one capability the company needs, lets Arturo propose who does
> that work, and asks for one bounded piece of work.

Run:

```text
/overview
```

Point out that the state is honestly empty.

## 1. Create the Enterprise

Type the command on its own. Arturo asks for the rest:

```text
/enterprise
```

Choose `1`, then answer the two questions — the name (`BrightPath Studio`) and
what it does (`Help independent professionals explain their services clearly to
prospective customers.`). Then:

```text
/enterprise
```

Choose `3` to inspect it.

Say:

> Nothing here is a switch to memorise. The Enterprise gives durable identity
> and mission. It is not an agent or a temporary chat.

## 2. Define one enduring capability

```text
/function
```

Choose `1`, then answer with the name (`Customer Insight`) and its objective
(`Turn supplied customer questions into clear, bounded service insights without
inventing market evidence.`).

Say:

> An ongoing Function describes something the company must remain capable of
> doing. It persists even if the Worker or model changes.

## 3. Add the person who signs off

```text
/add-human-worker
```

Give a name, then choose `1` — the approver role.

Say:

> Governed work waits for a named person. On a one-person company, that person
> is the founder.

## 4. Let Arturo propose the team

```text
/staff
```

Arturo proposes AI Workers one at a time, each with its role, what it can do,
and which Function it would help. Answer `yes` to each one you want.

**The proposal is model-generated, so the names and the number of Workers vary
between runs.** Do not script them. This is the honest behaviour to show: the
plan is advisory, nothing is created until you answer, and you can skip any of
it.

Say:

> Registering a Worker is not the same as putting it to work. `/staff` is what
> attaches Workers to the Function that owns the outcome.

Then:

```text
/workers
/functions
```

## 5. Create one bounded Task

```text
/task
```

Choose `1`, then describe the work in plain words:

> BrightPath Studio helps independent professionals write clear service-page
> content. Its standard package includes a 45-minute discovery call, a first
> draft, and one revision. It does not include website design, technical setup,
> or publishing. Using only these supplied facts, identify the three most
> important points the service page should make clear to prevent customers from
> misunderstanding what is included. Do not claim customer research.

Arturo then asks what the Task should work from. Choose `1` — it has everything
it needs.

## 6. Approve it, then read the result

```text
/tasks
```

Wait until the Task shows **Awaiting approval**. The approval chain is created
when the runtime picks the Task up, a moment after it is queued — running
`/approvals` immediately after creating the Task will correctly report that
there is nothing there yet.

Then:

```text
/approvals
/approve <task-id>
```

Wait for execution, then:

```text
/task inspect <task-id>
```

## What to explain

- Arturo selected a Worker by required capability, and says which and why.
- The Task has an instruction, status, Worker, routing reason, and result.
- Work waited for a named person before it ran. Approval authorised the
  execution boundary, not the eventual answer.
- The result is labelled as model synthesis rather than verified research.
- Completion means the model finished; it does not mean every conclusion is
  correct.
- No external action was taken.

## Close

Say:

> That is Arturo at its simplest: mission, enduring capability, a proposed and
> accepted team, human sign-off, bounded work, and an inspectable result.
> Everything in the later demonstrations adds operational control around this
> same loop.

## Stop here when

Use this as the entire demonstration when the investor wants only the product
idea or time is limited. Do not introduce advanced terminology unless asked.

## If something goes wrong

- If `/task create` says the Function has no Worker assigned, `/staff` has not
  been run or every proposed Worker was skipped. Run `/staff` again.
- If `/staff` fails with a provider error, external escalation is enabled and
  the provider is unavailable. Show `/model-routing` and explain the budget
  boundary honestly, or disable escalation and retry.
- If the Task stays queued rather than reaching approval, the staffed Workers
  may not cover the capability the Task needs; `/task inspect` names it.
- If the local model is unavailable, show `/tasks`, explain that the durable
  Task remains inspectable, and use a clearly labelled rehearsal state.
- If the output is poor, inspect it honestly. Do not rerun until it looks good
  without disclosing the retry.

## Investor takeaway

Arturo is not merely a prompt box. It gives AI work organisational ownership,
explicit routing, human authority, durable state, and inspectable evidence —
and asks for what it needs in plain language rather than demanding flags.
