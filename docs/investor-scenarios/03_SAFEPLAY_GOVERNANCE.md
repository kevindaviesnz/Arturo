# Level 3 — SafePlay Labs

## Deterministic Governance and Human approval

**Time:** approximately ten minutes.

**Purpose:** demonstrate that consequential AI work can be stopped by
application policy before model execution and released by an accountable
Human.

## Start isolated state

From `cli/`:

```bash
mkdir -p .data/investor-03-safeplay
ARTURO_DATA_DIRECTORY=.data/investor-03-safeplay \
ARTURO_RUNTIME_DATABASE_PATH=.data/investor-03-safeplay/runtime.db \
npm run ui
```

Configure `APPROVAL_SIGNING_SECRET` in the untracked `cli/.env` with a unique,
non-placeholder value of at least 32 characters, or use
`APPROVAL_SIGNING_SECRET_FILE` for a private file outside Arturo's data
directory.

## Opening

Say:

> Koru Toys showed automation. SafePlay Labs shows why automation needs
> boundaries. The policy in this demonstration is evaluated by application
> logic, not by asking the model whether approval is necessary.

## 1. Create a governed Enterprise

Type each command on its own and answer Arturo's questions.

```text
/enterprise
```

Choose `1`; name it `SafePlay Labs` and describe it as `Review supplied toy
concepts for safety questions while keeping release authority with accountable
humans.`

```text
/function
```

Choose `1`; name it `Safety Review` with the objective `Identify safety
questions in supplied toy concepts without claiming certification or regulatory
compliance.`

```text
/add-human-worker
```

Give the name `Safety Lead`, then choose `1` — the approver role.

```text
/staff
```

Accept the AI Workers Arturo proposes. The names and number vary between runs
because the plan is model-generated; nothing is created until you answer.

```text
/workers
```

Explain that the AI Workers analyse; the Human participant holds accountable
approval authority. Neither is presented as a certified professional. Point out
that `/staff` is what attached those Workers to the Function — registering a
Worker alone does not put it to work.

## 2. Add a deterministic rule

```text
/governance
```

Choose `1` — add a rule. Arturo asks four plain questions:

1. What the rule is for: `Toy safety analysis requires Human approval`
2. What should happen: choose **wait for a person to say yes**
3. Which work it covers: choose **safety**
4. Whether to narrow it to a risk level: choose **every task of that kind**

Then run `/governance` again and choose `2` to see the stored rule.

Point out the effect, capability match, and Enterprise scope — and that no
switch was typed to author a governance rule.

## 3. Submit governed work

```text
/task
```

Choose `1`, then describe the work:

> Review this supplied concept for questions requiring specialist evidence: a
> fabric storytelling cube intended for children aged three and over. Do not
> claim testing, certification, or regulatory compliance.

Choose `1` when Arturo asks what it should work from — it has everything it
needs.

```text
/tasks
```

Wait until the Task shows **Awaiting approval**, then:

```text
/approvals
```

The approval chain is created when the runtime picks the Task up, a moment
after it is queued. Running `/approvals` immediately will correctly report that
there is nothing there yet — wait for `/tasks` to show the Task blocked first.

Copy the Task ID. Confirm that it is awaiting approval and that model work has
not yet run.

## 4. Exercise Human authority

```text
/approval-status <task-id>
/approve <task-id>
/approval-status <task-id>
```

Wait for execution, then:

```text
/task inspect <task-id>
/timeline
```

## What to explain

- Policy matching is deterministic.
- Approval authorises execution; it does not certify the resulting answer.
- The approval chain records the Human participant.
- Model output is labelled as unverified synthesis.
- A real product release would require appropriate testing, expertise,
  evidence, and applicable legal or regulatory review outside this demo.

## Optional rejection path

In a rehearsal or a second harmless Task, demonstrate:

```text
/reject <task-id> "The supplied concept lacks enough information for analysis."
```

Do not reject the main Task if the live narrative depends on inspecting its
result.

## Close

Say:

> Arturo does not rely on a prompt saying “please be safe.” Deterministic policy
> controls whether the AI may execute, and the resulting work still carries an
> explicit evidence boundary.

## If something goes wrong

- If the signing secret is missing, explain the fail-closed result and continue
  with a prepared rehearsal state.
- Never expose or repair secrets on screen.
- If no approval policy appears on the record, stop and inspect the policy
  rather than claiming Governance worked.
- If `/task create` says the Function has no Worker assigned, `/staff` has not
  been run or every proposed Worker was skipped.
- If `/approve` reports "Approval chain not found", the runtime has not reached
  the Task yet. Check `/tasks` and approve once it reads Awaiting approval.

## Investor takeaway

Arturo separates model reasoning from enforceable organisational authority.
