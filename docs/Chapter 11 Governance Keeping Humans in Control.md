# Chapter 11 — Governance

## What you will learn

You will add a rule that stops safety work until a Human approves it, and see
that Arturo was already enforcing one rule before you wrote a word of policy.

**Governance** means rules about what Arturo may do.

## Before you begin

You need Product Safety running and staffed, from
[Chapter 7](./Chapter_7_Workers.md) through
[Chapter 10](./Chapter_10_Health_Models_Knowing_Whether_an_Organisation_Is_Succeeding.md).

## AI advice and fixed rules are different

An AI model may suggest what work to perform.

A Governance rule is checked by application code. It can:

- allow a matching Task;
- deny a matching Task; or
- require Human approval.

This is **deterministic**. The same rule matches the same way every time.
Arturo does not ask the AI whether the rule should apply.

## 1. Look at the rules already in place

```text
/governance
```

Arturo shows a menu:

```text
Governance rules decide what work needs a person's say-so before it runs.

  1. Add a rule
  2. See the rules in place
  3. Remove a rule
```

Answer `2`. If you accepted `/staff`'s proposal in Chapter 7, one rule is
already there, named after the staffing plan itself — something like:

```text
1. Human approval required for Product Safety, from the staffing plan you applied.
   ID            staffing-approval:ethical-toys:product-safety
   Applies to work in ethical-toys:product-safety · then a person has to approve it first · organization: enterprise-1
```

You did not write this rule. `/staff` did, the moment it staffed a Function
where sign-off mattered. That is worth pausing on: by the time you reach this
chapter, Governance may already be holding work back, and the reason is
recorded in the rule's own name rather than hidden in code.

## 2. Add a rule of your own

```text
/governance
```

Answer `1`. Arturo asks for the rule in one sentence:

```text
In one sentence, what is this rule for?

For example   Anything that sends email needs my approval first.
```

Type: `Toy safety work requires Human approval`

Next, what the rule should do:

```text
When this rule matches, what should Arturo do?

  1. Wait for a person to say yes before it runs
  2. Refuse it — never let this run
  3. Allow it — record the decision and let it run
```

Answer `1`.

Then what kind of work it covers — a numbered list of every capability Arturo
knows, split by whether it can recognise that capability in text you type:

```text
Arturo can spot these in a task you type

  1. human-contact — ...
  2. safety — Identify safety risks, constraints, and missing evidence in supplied material.
  ...

It will not spot these in a task you type. A rule on one of them still
applies to work that declares it another way — a Procedure, a Workflow
step, or a task a running Function creates from an Event:

  20. human-review — ...
  ...
```

You can answer with the number, or type the capability's name outright — type
`safety`.

Last, how widely the rule applies:

```text
Should the rule apply to every task of that kind, or only at one risk level?

  1. Every task of that kind
  2. Only low-risk tasks
  3. Only medium-risk tasks
  4. Only high-risk tasks
```

Answer `1`. With one Enterprise, Arturo does not ask which business the rule
covers — there is only one, so it scopes the rule there and creates it:

```text
Governance policy added
Policy        Toy safety work requires Human approval
ID            policy-...
Then          a person has to approve it first
Applies to    work needing safety
Where         organization: enterprise-1
```

(If you had more than one Enterprise, Arturo would ask which one, or offer
"every business on this computer.")

## 3. Inspect it

```text
/governance
```

Answer `2` again — both rules now show. There is no menu route to look at one
rule alone; use the flag form for that:

```text
/governance policy inspect "Toy safety work requires Human approval"
```

Check:

- effect is "a person has to approve it first";
- applies to "work needing safety"; and
- scope is your Enterprise.

## 4. Create matching work

```text
/task
```

Answer `1`, then describe the work:

`Using only the supplied synthetic description, list the missing safety evidence a Human should request before considering release. Do not claim that testing occurred.`

Answer `1` for "No, it has everything it needs."

```text
Task created
Task queued        task-1
Selected Function  Product Safety
Selected worker    Product Safety Analyst
```

Your Worker's name and role will likely differ — `/staff` writes its own
proposal, so what you have staffed will not match this book exactly. That is
expected; see Chapter 7.

You may also see a line like:

```text
Partial coverage   Product Safety Analyst does not hold research — this Function is team-staffed and no single Worker covers everything the Task needs.
```

That happens because the words "evidence" and "safety" in what you typed each
name a capability the Task now requires, and a single Worker does not
necessarily hold both. It is a routing note, not a failure — the rule you
wrote still matches on "safety" alone.

## 5. Confirm it is blocked

```text
/tasks
```

```text
1. Using only the supplied synthetic description, list the missing safety evidence a Human should request before considering release. Do not claim that testing occ...
   ID                     task-1
   Status                 Blocked — awaiting approval
   Worker                 Product Safety Analyst
   Required capabilities  safety, research
```

```text
/approvals
```

```text
task-1 · pending
What               Using only the supplied synthetic description, list the missing safety evidence a Human should request before considering release. Do not claim that testing occurred.
Why it needs you   Human approval required for Product Safety, from the staffing plan you applied.
Signed off so far  0 of 1
Who can approve    anyone on your team with the approve role (that can be you)

To approve         /approve task-1
To turn down       /reject task-1 "<reason>"
```

`Why it needs you` names the staffing rule here, not the one you just wrote —
whichever rule a Task matches first is the one Arturo shows. Either would have
stopped it. Chapter 12 takes this Task on to a decision.

## What did not happen?

The AI Worker did not start the governed Task.

The rule did not:

- decide whether the toy is safe;
- prove that the Human is qualified;
- approve a future result; or
- contact anyone outside Arturo.

It only controlled whether the matching Task could start.

## Other effects

Arturo rules can also:

- `deny` — refuse the matching work outright; or
- `allow` — record the decision and let it run.

Use `deny` carefully. Test it against harmless synthetic work first.

## Important limits

- Governance is only as good as its rule descriptions and match fields.
- A missing rule cannot protect work it does not match.
- Text-based capability inference is a best effort — reword a Task and it may
  stop matching a rule that used to catch it.
- Enterprise scope in the local product is not full tenant isolation.
- Professional and legal rules still apply outside Arturo.

## Check your understanding

You are ready for Chapter 12 when:

- `/governance` shows both the staffing rule and the one you wrote;
- the safety Task is `Blocked — awaiting approval`;
- `/approvals` shows a pending decision; and
- you can explain why a fixed rule is different from an AI suggestion.

Next: [Chapter 12 — Approvals](<./Chapter 12 Approvals Human Decisions in AI Native Enterprises.md>).
