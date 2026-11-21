# Chapter 7 — Workers

## What you will learn

You will supply the missing piece from Chapter 6 — somebody to do the work — and
watch the Task Arturo refused go through.

A **Worker** performs a Task.

The current Arturo product registers two Worker types:

- AI Workers; and
- Human Workers.

Robots, machines, sensors, and databases are not current registered Worker
types.

## Before you begin

Chapter 6 ended with Arturo refusing to create a Task:

```text
Product Safety has no Worker assigned to it, so there is nobody to do this.
```

That refusal is what this chapter answers. If you have not seen it, work through
[Chapter 6 — Tasks](./Chapter_6_Tasks.md) first and come back.

## Where a Worker sits

```text
Business Function → owns an ability
Running Function  → decides when work may be useful
Task              → one bounded piece of that work
Worker            → performs the Task
```

Keeping these separate is what makes Workers replaceable. The Function owns the
outcome; the Worker is who happens to be doing it today. Swap the Worker and the
responsibility is unchanged — which is the whole reason the two are not the same
thing.

## 1. Choose a role

Every AI Worker is given a **role** — Arturo calls it an archetype. The role
decides what the Worker is good at and the rules it follows. It is the single
most important choice you make about a Worker.

List the roles available:

```text
/archetypes
```

Inspect one in detail:

```text
/archetypes guardian
```

Arturo shows what the role is best for, its default capabilities, and its
prompt guardrails.

A role is a routing label. It does not prove the Worker is a qualified safety
expert, and it does not grant permission to use tools or contact people.

## 2. Add an AI Worker

Normally `/staff` adds the Workers a Function needs. Here you add one by hand
so you can see what a role does.

```text
/add-ai-worker
```

Arturo asks two questions:

| Arturo asks | You answer |
|---|---|
| What should this AI Worker be called? | `Product Safety Worker` |
| What should "Product Safety Worker" do? Pick the closest role. | the number beside `guardian` |

The roles are the same list `/archetypes` printed, so you can read that first
if you are not sure which one fits.

## 3. Inspect Workers

```text
/workers
/workers inspect "Product Safety Worker"
```

Check:

- type is AI;
- role is guardian;
- availability is available; and
- capabilities include safety-related work.

## 4. Assign the Worker to the Function

You now have a Worker. Try Chapter 6's Task again and it will **still be
refused**, with the same message.

That is not a mistake. Registering a Worker puts it in the company. It does not
put it behind any particular Function. Those are two separate acts, and this is
the single easiest step to miss in Arturo — which is why Chapter 6 spent a page
on the last line of that refusal:

```text
Registering a Worker does not assign it to a Function; /staff does that.
```

`/staff` is what assigns Workers to Functions:

```text
/staff
```

Arturo proposes Worker coverage for each Function and shows them one at a time.
Say `yes` to each one you want. Nothing is assigned until you answer.

Because the proposal is written by an AI model, what it suggests will vary. It
may reuse Product Safety Worker, or propose others alongside it. Accepting is
enough — you do not need a particular set.

Confirm it worked:

```text
/function list
```

Product Safety should now show a staffed Worker.

## 5. Ask for the same Task again

Now repeat the request Arturo refused in Chapter 6. Nothing about it has
changed; what changed is that the Function has somebody behind it.

```text
/task
```

Answer `1`, then:

| Arturo asks | You answer |
|---|---|
| In one sentence, what do you want done? | `Using only this description — a soft fabric activity cube for children aged three and over — list three safety questions that need evidence before a Human release decision. Do not claim testing, certification, or legal compliance.` |
| Does this task need anything to work from? | the number beside `No, it has everything it needs` |

This time it is created.

## 6. Read the record

```text
/tasks
```

Then look at one in full:

```text
/task
```

Answer `2` and pick the Task from the list.

Check **Why this Worker**. It names the reason Arturo routed the work to Product
Safety Worker rather than choosing at random — the routing is recorded, not
implied.

Check the **Evidence** line too. On a Task an AI Worker performed it will say the
result was written by a model and that nothing in it has been checked. That is
Chapter 6's point about `Completed` restated against a real record: the Worker
stopped, which is not the same as the answer being right.

## When the Worker asks you for information

An AI Worker has no files, database, or internet unless you give it something
to work from. Asked to review evidence it was never given, a capable model will
often reply by asking you for it — a list of certifications, test reports, and
so on. That is the Worker behaving correctly, not an error.

You have not been shown how to supply that yet. You will be:

- attaching a file to a Task is the `Work from a file you've attached` answer
  in the `/task` menu, covered in Chapter 40;
- letting a Worker search the public web is the `Search the public web first`
  answer, which an operator must enable first; and
- a Human Worker can supply it, which Chapter 12 uses for approvals.

You could also give the Enterprise a Function whose job is to gather that
evidence, and staff it with its own Workers. That is the same pattern you have
already used, applied to a different responsibility.

## AI Worker models

An AI Worker normally uses the configured model, such as `llama3.2:latest`.

The Worker is not the same thing as the model:

- Worker: Product Safety Worker;
- role: guardian;
- model: replaceable AI software.

Naming the Worker after its work makes the organisation easier to understand.

## Removing a Worker — not yet

Arturo can remove a Worker when that role is no longer part of the operating
model. **Do not do it now.** The rest of this book uses Product Safety Worker,
and removing it leaves `/workers` empty and later chapters with nothing to
route to.

When you do need it, Arturo first checks whether the Worker is still named by
an unfinished Task, an active Workflow, or an open Human Task. If so, removal
stops and shows the records that must be resolved. Built-in system Workers
cannot be removed.

Successful removal deletes the Worker registration and its current staffing
assignments. It does **not** erase completed Tasks, Events, approval decisions,
Artefacts, chat history, or other audit evidence. If a saved Workflow still
names the removed Worker, Arturo keeps the Workflow and warns you to update it
before running it again.

## Important limits

- Workers do not own the Business Function.
- An AI Worker has no email, shell, or outside tools unless Arturo explicitly
  configures them.
- A Worker result is not verified merely because the Task completed.

## Check your understanding

You are ready for Chapter 8 when:

- `/workers` shows Product Safety Worker;
- the Task Chapter 6 could not create now exists, with a Worker and a stated
  routing reason;
- you can say why registering a Worker was not enough on its own; and
- you can explain why a role is not a professional credential.

Next: [Chapter 8 — Operational Memory](./Chapter_8_Operational_Memory_How_Organisations_Learn.md).
