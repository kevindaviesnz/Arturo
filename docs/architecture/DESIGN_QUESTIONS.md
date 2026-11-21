# Design questions awaiting a decision

These came out of working through the manual chapter by chapter against a
running build. Each one is a question about what Arturo should be, not a bug —
none can be fixed by changing code until it is answered.

For each: what the product does today, what the options are, and a
recommendation. Nothing here has been implemented.

---

## 1. Should approval gate the work, or the result?

**Today.** `/approve` authorises *execution*. An approval chain is created when a
Task is queued and Governance says a person must decide
(`cli/src/runtime/workerRuntime.ts:2785`), and only for status
`awaiting_approval`. Approving releases the Task to run.

Reviewing *output* is a separate mechanism with a separate vocabulary: the
result must first be registered as an Artefact version, then submitted to a named
reviewer, then decided (`/artefact submit` → `/artefact review` →
`recordJobArtefactDecision`, reviewer binding enforced by
`validateJobArtefactReviewer`). It is keyed on `artefact-id@version`, never on a
Task id.

So `/approve <completed-task-id>` has no meaning, and says so badly:
"Approval chain not found".

**The problem.** Approving work before it runs asks the operator to judge
something they have not seen. Watching this in use: a Task was rejected with
"Sampling plan is not tied to a batch size or quality level" — a criticism of a
sampling plan that did not exist yet, because the Task had not run. The decision
being requested and the decision the operator wanted to make were different
decisions.

**Options.**

1. Keep pre-execution approval as the only gate. Cheapest; leaves the mismatch.
2. Make result review the default: a Task's output is registered as an Artefact
   version automatically, and `/approve <task-id>` on a finished Task decides on
   that version. Pre-execution approval stays available for genuinely
   consequential actions.
3. Two gates, both explicit, chosen per Governance rule.

**Recommendation: 2.** It matches what an operator expects "approve" to mean, and
it makes the approval signature cover content rather than intent. Pre-execution
approval should be reserved for Tasks that will *do* something outside Arturo —
which is the same boundary as question 5.

The cost is that every completed Task becomes an Artefact, which is a real
storage and noise increase, and the auto-registration has to preserve the
existing reviewer-binding and hash-signing guarantees rather than route around
them.

---

## 2. Do Runtimes need to exist?

**Today.** A Business Function is *declared*, and separately *started*. Starting
attaches a `runtimeId` and creates a runtime record. Until then the Function has
no operating state, and any command that reads operating state fails.

Two things follow that were both reported as bugs:

- `/runtime inspect <id>` on a declared-but-unstarted Function reported
  "Function not found" (fixed — and `/runtime` has since been removed
  altogether; `/function inspect` shows the operating state).
- The runtime store was an in-memory map, so a Function started before a
  restart was no longer running afterwards. **This is now fixed**:
  `businessFunctionRuntimeStore.ts` loads from
  `businessFunctionRuntimeRepository` at module init and persists on save.
  Verified by starting two Functions, exiting, and reopening against the same
  data directory — both still reported `Operating state: running`, and their
  Event rules were still enabled.

**What actually blocks hands-off operation.** Not persistence, but that nothing
starts. `/staff` assigns Workers and leaves every Function *declared*, and an
unstarted Function cannot react to an Event at all. Because directly created
Tasks run regardless of operating state, an operator sees work completing and
reasonably concludes the business is running. It is not: a five-Function
Enterprise ran Tasks perfectly for a whole session while no Function ever
reacted to anything.

**Decided and implemented.** `/staff` now starts every Function it staffs that
has an available AI Worker behind it, and says which are running. Starting
grants no new authority — the approval rules the same plan writes are in force
first, so governed Tasks still wait under `/approvals`. `/runtime`, the alias
that exposed the internal term, has been removed.

What remains open is only the narrow case: whether a Function created *outside*
a staffing plan should also start itself, and whether an explicit "set up
without starting" option is worth having.

**The question asked.** "Why do we need runtimes anyway? Surely it's up to
Arturo to coordinate work."

**Options.**

1. Keep the split. A Function can be designed before it is switched on, which is
   genuinely useful when staffing and Governance are still being set up.
2. Start a Function when it is created. Remove "not started" as a state.
3. Keep the split but persist runtime state, and make "not started" visible
   everywhere a Function is listed.

**Recommendation was 3, then reconsider 2; both have now happened.** State is
durable, and staffing starts what it staffs. The Runtime is no longer a thing an
operator names or types — it is the operating state of a Function, shown by
`/function inspect`.

---

## 3. Does Delegation need to exist?

**Today.** `cli/src/delegation/` implements within-Enterprise delegation between
Business Functions, with its own store, runtime and events. Chapter 18 documents
it. Cross-Enterprise delegation is explicitly unsupported.

**The question asked.** Same as above — minimise moving parts.

**Assessment.** Delegation overlaps heavily with two mechanisms that already
exist: Events (one Function announces, another reacts) and staffing (a Worker
serves more than one Function). It is not obvious what delegation does that an
Event plus a Task does not.

**Recommendation:** treat it as a candidate for removal, but not before writing
down the case it uniquely serves. If that case cannot be written in a paragraph
with a worked example, remove it — the concept costs a chapter, a subsystem and a
vocabulary word.

---

## 4. Should an AI Worker be able to approve another AI Worker's output?

**Today.** No. The `review` capability was deliberately removed from AI
archetypes after it was found on the operator archetype, which meant an AI Worker
held a human-only approval capability. Human review is human-only by design.

**The proposal.** A "Senior Chemist" AI Worker approving work from a "Chemical
Synthesis Chemist" AI Worker.

**The tension.** This is the core product claim. Arturo's stated value is that
consequential decisions pass through deterministic Governance and *human*
approval. An AI approving an AI is a model checking a model — useful as a quality
step, but it is not an approval in the sense the rest of the system means, and
recording it in the same signed chain would make the audit trail claim something
untrue.

**Recommendation:** allow it, but not as *approval*. Introduce a distinct,
separately-named step — a **check** — that an AI Worker can perform, which is
recorded, visible, and explicitly not a human decision. Keep `/approve` and the
signed approval chain human-only. This gets the hands-off benefit without
weakening the one guarantee the product sells.

If it were recorded as approval, the honest description of the system would
become "AI-approved work, sometimes seen by a person" — a different product.

---

## 5. Should physical work go only to Human Workers?

**The proposal.** "Any task involving the physical movement of atoms can only be
sent to a human worker."

**Today.** Nothing enforces this. Worker selection is by capability and staffing.
An AI Worker can be routed a Task that describes physical work, and will produce
text about it — which is exactly the failure mode where a completed Task looks
like a completed action.

**Recommendation: adopt it, and enforce it in code, not in the prompt.** This is
a clean, checkable rule and it matches the existing principle that anything
consequential is decided deterministically rather than by model judgement.

The hard part is classification: deciding whether a Task involves physical action
is itself a judgement. Suggested approach — an explicit capability
(`physical-action`) that only Human Workers can hold, required by the Task, set
when the Task is created rather than inferred from its wording. Inferring it from
free text would be a model decision guarding against model error.

Note the existing constraint that rules keyed on capabilities never inferred from
typed text cannot fire from a plain Task, so this needs the capability to be a
first-class part of Task creation.

---

## 6. The AI Worker capability model

**The proposal.** An AI Worker can only:

- accept data;
- generate data (including web search);
- send data;
- process data (including deciding about data); and
- interact with a system (send an email, save a file).

With two rules: an AI Worker always returns the result of its Task to Arturo, and
Arturo decides what happens to that result. An action performed *as part of* a
Task — sending an email — is not the result.

**Assessment.** This is a good model and largely describes what the code already
enforces: external side effects require an explicit authorised capability, and
nothing reaches the network implicitly.

**Recommendation: adopt it as the stated model** and use it to audit the
archetype list. Its real value is as a test — any proposed Worker ability that
does not fit one of the five is either out of scope or needs a new category, and
that is a decision rather than an implementation detail.

---

## 7. The five business blueprints

**The proposal.** Because every Task flows through Arturo and there is a strict
digital/physical boundary, every business Arturo can model is one of:

1. Pure Digital Pipeline (AI only)
2. Digital Command & Physical Execution (Dispatcher)
3. Physical Ingestion & Digital Processing (Sensor)
4. Hybrid Parallel Execution (Orchestrator)
5. Iterative Feedback Loops (Prototyper)

**Assessment.** These follow from questions 5 and 6 — they are the combinations
of where work starts and where it ends, given that only humans move atoms. That
makes them a genuine consequence of the model rather than a taxonomy imposed on
it, which is the strongest argument for them.

**Recommendation: adopt as a documentation and product-design frame**, not as a
code construct. They are how the book should explain what Arturo is for, and they
would make a far better replacement for the deleted domain chapters (29–34) than
those chapters were: six industry walkthroughs become five structural patterns
that a reader can map their own business onto.

Do not turn them into an enum in the code until something needs to branch on
them.

---

## 8. Reduce the approval surface

**The observation.** "Just about everything needs my approval." The stated goal
is a system that is hands-off as far as possible.

**Today.** Approval is required wherever a Governance rule says so, plus
staffing-plan approval. In practice a first-run installation asks for a decision
at most steps.

**Decided and implemented.** Approval is now required if and only if a Task
requests a *consequential* capability — one with an effect outside Arturo
(`isConsequentialCapability`: `email-send`, `shell-execute`, `file-write`,
`human-contact`, plus the dotted kernel ids). The staffing rule `/staff` writes
matches on `{ businessFunctionId, consequentialOnly: true }` instead of the
Function alone, so drafting, analysis, research and summarising run unattended
in a governed Function.

Origin turned out not to matter. Operator-typed and Function-created work are
treated identically, because the answer to "should work I typed that sends
email still be approved?" was yes, and the answer to "should autonomous work
that only drafts be approved?" was no. Both reduce to the same rule, so no
`origin` field was added to a Task.

Narrowing by consequence is safe where narrowing by a named capability is not:
a named capability is an enumeration whose complement grows silently, whereas
`isConsequentialCapability` is the same predicate the engine already uses to
fail closed when *no* rule matches. `consequential ⇒ gated` still holds
everywhere.

**Three residual risks, recorded deliberately.**

1. *The gate now rests on model-declared capabilities.* A Function's
   `requiredCapabilities` come from the model's JSON
   (`businessFunctionRuntimeEvaluator.ts`). A Function that decides "email the
   customer an apology" but declares `["writing"]` produces work that is
   non-consequential to governance and runs unapproved; the old Function-wide
   rule caught it. Partial mitigations exist — `taskExecutor.ts` prefixes
   `DRAFT ONLY — NOT SENT.` when the wording looks like outreach and no
   connector ran, and routing refuses a best-effort Worker for a consequential
   capability, so under-declared work cannot acquire authority it did not ask
   for. The proper fix is to infer capabilities from Task text at creation and
   union them in, fail-closed. Not done.
2. *Not retroactive.* `workerRuntime.ts` passes
   `governanceRequiresApproval || Boolean(existingChain)`, so a Task already
   waiting under the old rule keeps waiting. Fail-closed and correct, but it is
   why "I upgraded and my old Tasks still wait" would be reported.
3. *The sensitive-work classifier is materially weakened.* Its six categories no
   longer decide *whether* work is gated, only whether a named, inspectable,
   removable rule exists instead of the anonymous fail-closed default. That is a
   real but much smaller job. If it is not worth six model calls per Function,
   the honest conclusion is to remove the classifier and the staffing rules
   together — not to keep it while quietly defanging it.

Question 1 (approve results rather than work) is now the remaining half of this,
and is unaffected.

---

## 9. How does an operator supply information a Worker asks for?

**The most common dead end in the product.** It appeared in Chapter 6, Chapter 13
and three of the recorded sessions. The pattern is always the same: a Task is
created, the AI Worker correctly notes it has no evidence, asks for materials
lists or test reports or certifications, and the Task completes. The operator is
left holding a request with no way to answer it.

"I created a task for an AI worker to find materials. It came back asking me what
materials I want. How do I tell it what I want? Shouldn't the worker have done
everything?"

**Today.** The routes exist but none of them is a reply:

- attach a file first (`/artefact add`, then the file option in `/task`);
- enable governed web search;
- create another Task with the detail written into it.

All three mean starting again. There is no way to answer the question the Worker
actually asked.

**Recommendation.** This is the highest-value unresolved item in the list — it is
where a first-time operator gives up. Options worth costing:

1. A reply surface: `/task reply <task-id>` that supplies the missing input and
   re-runs, keeping both turns on the record.
2. A Task that needs input finishes as *blocked on input* rather than
   *completed*, so it is visibly waiting rather than apparently done.
3. Both — 2 is what makes 1 discoverable.

Note that a Task completing while the work plainly did not happen is also a
correctness problem in its own right: `Completed` currently means "the Worker
stopped", and this is the case where that is most misleading.

---

## 10. Human Workers, availability, and single-user Arturo

**Two open questions.**

*How does a Worker say they are unavailable?* There is an availability field, but
no operator-facing way for a person to set their own.

*What does a Human Worker mean when Arturo is single-user?* Registering one
proves nothing about identity or authority, there is no login, and the review
link is the only mechanism that binds a decision to a named person (by HMAC, for
24 hours). So a Human Worker today is a *role label the operator maintains*, not
an account.

**Recommendation:** say exactly that in the documentation rather than implying
multi-user behaviour, and treat real identity as out of scope until there is a
reason to build it. Availability should either become settable or be removed from
the display — a field that cannot be changed is worse than no field.

---

## 11. Does "a second pair of eyes" mean "can approve"?

**Found in a live session.** `/add-human-worker` offers four roles
(`cli/src/ui/uiAddHumanWorkerFlow.ts:57`). Option 1 is described as *"Sign off
sensitive work — **the approver**. If it's just you, this is you."* Option 2 is
*"Review work before it's delivered — a second pair of eyes on results."*

An operator picked option 2. Arturo replied *"Me The Coach can now approve
sensitive work"*, and they then signed two approvals.

**Today.** This is consistent with the code, not a slip: option 2 maps to the
`reviewer` archetype, `resolveDefaultHumanWorkerMode` maps that to `"review"`
mode, and `isApprovalCapableMode` counts `"review"` as approval-capable
alongside `"approval"` and `"decision"`
(`cli/src/control/humanWorkerMode.ts:44`). Every mode the short list can produce
except *"just do the tasks they're given"* can approve.

**Why it matters.** The approval decision is HMAC-signed in a named person's
name. Whoever holds this authority is the trust anchor for the whole governance
claim, so the operator granting it must know they are granting it. Presenting
1 and 2 as approver-versus-not, then granting both the same authority, means
the menu misdescribes the only thing it is really deciding.

**The options.**

1. **Wording only** — keep `review` approval-capable and rewrite option 2 so it
   stops implying the opposite ("Review work, and sign it off"). Cheapest; makes
   the short list two ways of saying the same thing, which invites the question
   of why both exist.
2. **Separate the authorities** — drop `"review"` from `isApprovalCapableMode`
   so a reviewer reviews and only an approver approves. Truest to the menu as
   written, but it changes who can sign on existing installations, and
   `/staff`'s "still needs a person who can approve" warning would stop being
   satisfied by a reviewer.
3. **Collapse the list** — offer approver / not-approver and drop the middle
   option until there is a distinct behaviour behind it.

**Recommendation:** 2, with 1 as the immediate mitigation. A capability named
after reviewing should not silently carry signing authority, and this is the
same reasoning that removed `human-review` from the operator archetype — see
the capability note below. But it changes an authority boundary on existing
data, so it should be decided deliberately rather than patched.

---

## Two capabilities that are easy to confuse

`review` and `human-review` are different, and the distinction is load-bearing
for question 4 above.

- **`review`** is held by AI archetypes, including `guardian`
  (`cli/src/agents/archetypeRegistry.ts:311`) and `reviewer` (`:80`). An AI
  Worker can be asked to evaluate work.
- **`human-review`** is reserved for accountable human decision-makers and is
  deliberately not on any AI archetype (`archetypeRegistry.ts:213`). This is the
  capability that was pulled off the operator archetype after it was found
  there.

So an AI Worker already *can* review work. What it cannot do is be the
accountable approver. Question 4 is therefore narrower than it first looks: the
mechanism for an AI checking another AI's output largely exists, and what is
missing is a name for the resulting record that does not claim to be an
approval.
