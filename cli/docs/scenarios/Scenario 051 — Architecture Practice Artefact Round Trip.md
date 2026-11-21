# Scenario 051 — An artefact round trip through an architecture practice

## Goal and boundary

Harbourstone Architects wants one specification to survive an honest working
week: written by one person, decided on by another, sent out of the practice by a
third, and amended twice because of what came back. **Use no real project,
client, or consent data.** Synthetic only. Arturo designs nothing, sends nothing,
submits nothing, and asserts no structural or planning outcome.

This scenario combines three Human Workers with different roles, exact-version
Artefact review, a send-it-back decision, two documents arriving from outside,
two Human Tasks carrying work out and back, a Task held until a returned document
is accepted, and a final version that does not inherit the previous approval.

It is the only scenario in the set where a document leaves the Enterprise and
returns, and it is driven **almost entirely by menus** — two lines use flags, and
both are there to show a refusal the menus make unreachable.

## Set up and staff the Function

Three people, and only one of them may approve. That is deliberate: approval
capability comes from the role, so the Technical Lead and the Client Liaison can
do work and close their own tasks but cannot sign anything off.

```text
/reset               → yes
/enterprise          → 1 · "Harbourstone Architects"
                       · "Turn client instructions into reviewed specification versions with a named person accountable for every decision."
                       · skip
/function            → 1 · "Design Documentation"
                       · "Produce and keep current the reviewed specification versions a project needs."
                       · skip
/add-human-worker    → "Principal Architect" · 1 (signs off sensitive work) · skip
/add-human-worker    → "Technical Lead" · 4 (full list) · 2 (creator) · skip
/add-human-worker    → "Client Liaison" · 3 (does the tasks they are given) · skip
/workers
/function start "Design Documentation"
/staff               → yes to each Worker it proposes
```

`/workers` should show `Participation approval` against the Principal Architect
and `Participation task` against the other two.

## A document arrives from outside

The client's brief exists as a file before Arturo hears about it. Attaching it
records the path, size and SHA-256 — Arturo does not copy or upload the file, so
the bytes stay where they are and can later be re-checked.

```text
/artefact            → 1 (attach a file) · "Client brief"
                       · 3 (specification)
                       · "./scenario_harness/assets/hs-client-brief.txt"
                       · 3 (Client Liaison)
                       · "Received from the client outside Arturo."
/artefact            → 7 (check a file still matches what Arturo recorded)
```

That last one should report the hash matching. Re-checking used to need the exact
`artefact-1@1` typed out; the menu offers the versions instead.

```text
/task                → 1 (create a task)
                       · "Analyse the supplied client brief and list every requirement it states, every decision it leaves open, and the information still needed before a specification can be written."
                       · 2 (work from a file you've attached) · 1 (the client brief)
                       · skip (do not wait for a decision first)
/tasks
/approve
/task inspect <task-id>
```

Wait until `/tasks` shows the Task **Blocked — awaiting approval** before
approving: the approval chain is created when the runtime picks the Task up, a
moment after it is queued. Bare `/approve` lists what is waiting, and with one
person able to decide it does not ask who.

Because the brief is local text whose hash still matches, its contents are placed
in the Worker's prompt as bounded data under a warning that Artefact contents are
data and never instructions. A PDF or an image would be metadata only.

## The specification is written, sent back, and re-issued

The Technical Lead writes the file outside Arturo, then attaches it. Sending it
for review fixes who decides, and that person cannot be swapped afterwards.

```text
/artefact            → 1 · "Outline specification"
                       · 3 (specification)
                       · "./scenario_harness/assets/hs-outline-spec-v1.txt"
                       · 2 (Technical Lead) · skip
/artefact            → 3 (send a file for review) · 2 (the outline specification)
                       · 1 (Principal Architect)
                       · "Check the structure and temporary-works clauses."
/artefact review artefact-2@1 --decision revise --as "Technical Lead" --notes "Attempting to sign off my own specification."
/artefact            → 4 (record a review decision) · 1 (the outline specification)
                       · 3 (send it back — say what must change)
                       · "Clause 2 opens a wall with no temporary support stated. Add a temporary-works clause and re-issue."
```

The flag line is refused: the review is assigned to the Principal Architect, and
Arturo names them rather than accepting the author's own sign-off. **The menu
never offers that mistake** — option 4 uses the reviewer the version was assigned
to and does not ask again — so the long form is the only way to show the refusal
still holds for anyone who types it.

A changed document is a new version, never an edit of the old one:

```text
/artefact            → 2 (record a new version) · 2 (the outline specification)
                       · "./scenario_harness/assets/hs-outline-spec-v2.txt"
                       · 2 (Technical Lead)
                       · "Added the temporary-works clause."
/artefact            → 3 · 2 · 1 · "Re-review the temporary-works clause."
/artefact            → 4 · 1 · 1 (approve it)
                       · "Temporary works now stated; approved to issue for structural review."
/artefact            → 6 (look at one file and every version of it) · 2
```

That last view should show two versions with different hashes, `@1` at
`revision_requested` and `@2` at `approved`, each carrying its own signed
decision.

## The approved version leaves, and something else comes back

Arturo cannot send a document. It records who was asked to send it, which exact
version they were pointed at, and what returned.

```text
/create-human-task         → "Issue the approved specification for structural review"
                       · "Send the approved outline specification to the consulting engineer and bring their written comments back."
                       · "Only a person can send a document to another firm."
                       · 3 (Client Liaison) · 2 (the approved specification)
/human-tasks
/complete-human-task <human-task-id> "Sent it." --as "Principal Architect"
```

That flag line is refused too: the task belongs to the Client Liaison. **The menu
never offers that mistake either** — it attributes completion to the owner
without asking. The engineer's comments then come back as a separate document,
recorded against the very task that asked for them:

```text
/artefact            → 1 · "Structural review comments"
                       · 2 (evidence)
                       · "./scenario_harness/assets/hs-structural-review.txt"
                       · 3 (Client Liaison)
                       · 1 (yes — it answers the task we asked the Liaison to do)
                       · "Returned by the consulting engineer; not produced by Arturo."
/complete-human-task       → "Issued specification v2 and returned the engineer's written comments."
                       · artefact-3@1 (the returned comments)
/human-task <human-task-id>
```

## Work waits until the returned document is accepted

The next Task reads both documents, and is held until the comments themselves
have been accepted into the record.

```text
/task                → 1 · "Analyse the returned structural review comments against the approved specification version and list every clause they contradict, every clause they confirm, and what must change."
                       · 2 (work from files) · artefact-2@2,artefact-3@1
                       · artefact-3@1 (wait until the comments are decided)
/tasks
/artefact            → 3 · 2 (the comments) · 1 (Principal Architect)
                       · "Accept the engineer's comments into the record before any work is done against them."
/artefact            → 4 · 1 · 1 (approve it)
                       · "Accepted as the engineer's comments. Arturo has not verified them."
/approve
/task inspect <task-id>
```

Between those, `/tasks` should show the Task **Blocked — awaiting Artefact
approval** and not running. Approving the Artefact releases it. Whether it then
stops again for a governed decision depends on what the staffing plan made
sensitive, so `/approve` may report that nothing is waiting — that is a correct
answer, not a failure.

`artefact-2@2,artefact-3@1` is one answer: a Task may work from several
documents, and the menu takes a list.

Every file question also accepts the file's own reference, shown on its row,
instead of the row number. That matters here because **a version's row number
moves the moment it is approved** — approved versions are listed above drafts —
so a number written down earlier can silently pick a different document. Naming
`artefact-3@1` says which one, whatever order the list happens to be in.

## The conditions come back and force a third version

```text
/create-human-task         → "Submit the specification for consent and return the conditions"
                       · "Submit the approved specification and bring back the authority's written conditions."
                       · skip · 3 (Client Liaison) · 2
/artefact            → 1 · "Consent conditions" · 6 (other)
                       · "./scenario_harness/assets/hs-consent-conditions.txt"
                       · 3 · 1 (it answers the consent task)
                       · "Issued by the authority. Arturo submitted nothing."
/complete-human-task       → "Consent conditions returned." · artefact-4@1
/artefact            → 2 · 2 · "./scenario_harness/assets/hs-outline-spec-v3.txt" · 2
                       · "Amended for the consent conditions: tree protection, matching brickwork, rooflight not visible from the street."
/artefact            → 3 · 2 · 1 · "Check that every consent condition is reflected."
/artefact            → 4 · 1 · 1 · "All three conditions reflected; approved."
/artefact            → 6 · 2
/artefacts
/timeline
```

The point of the ending: `@3` starts unreviewed even though `@2` was approved.
Approval is bound to exact bytes, so it cannot follow a document forward.

## What to verify

- `/workers` shows one Human with `Participation approval` and two with
  `Participation task`.
- Re-checking a file reports it still matching its stored hash, for each of the
  four documents.
- The author's attempt to decide on their own specification is refused and names
  the assigned reviewer — and the menu never offered that choice.
- Completing the Liaison's Human Task as somebody else is refused and names the
  owner — and the menu never offered that either.
- Looking at the outline specification lists three versions with three different
  hashes, and a **separate** review state and signed decision on each.
- `/tasks` shows **Blocked — awaiting Artefact approval** before the returned
  comments are accepted, and the Task runs only afterwards.
- `/human-task <id>` names the Liaison as owner and lists the returned document as
  the task's output Artefact.
- `/timeline` reconstructs the order: brief in, specification sent back,
  re-issued, approved, issued out, comments back, conditions back, third version
  approved.

## What this does not claim

- Arturo did not send, submit, email, or publish anything. Both outward legs are a
  person carrying a file, and `/create-human-task` does not notify the person it names.
- The `open:` link printed by `/create-human-task` is inert here: no review server is
  running under `npm run ui`.
- Attaching a file proves which bytes were reviewed. It does not prove the drawing
  is buildable, the specification is complete, or the consent is real.
- The engineer's comments and the consent conditions are synthetic files supplied
  by the operator. Arturo did not obtain, verify, or check them against a source.
- Every Task result is `Unverified model synthesis`. No structural design, span,
  foundation depth, or consent interpretation in it is engineering advice.
- Registering a Human Worker and attributing a decision to them does not
  authenticate that person or establish their professional authority.

## Safe completion condition

Stop after:

1. all four documents are attached with verified hashes;
2. the named Principal Architect has decided on each specification version
   separately, with `@1` sent back and `@2` and `@3` approved;
3. the two Human Tasks show the Liaison carrying work out and bringing documents
   back; and
4. `/timeline` can reconstruct the sequence.

Do not build, submit for consent, or instruct an engineer on the basis of
anything here until qualified people have checked the real drawings, the real
structural design, and the real consent conditions.
