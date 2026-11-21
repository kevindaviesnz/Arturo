# Chapter 40 — Artefacts

> **Summary:** A Task says what work was done. An Artefact identifies
> the exact file that the work produced or used.

Arturo can record real files without pretending that a block of model text is a finished product. This matters for designs, reports, specifications, price lists, costings, images, and other work that people must inspect.

Use only fictional, non-sensitive files in this exercise.

## 1. What is an Artefact?

An Artefact is Arturo's record of a file or external file reference.

It answers simple questions:

- What is the file called?
- Which Enterprise does it belong to?
- Is it evidence, a design, a specification, a price list, or a costing?
- Where is the file?
- Who created this version?
- Which Task or Human Task produced it?
- Which exact version are we discussing?
- Does the local file still match its recorded hash?
- Is that exact version awaiting review, approved, rejected, or waiting for revision?

An Artefact is not the same thing as:

- a **Task**, which records one piece of work;
- a **Task result**, which is usually text returned by a Worker;
- **Operational Memory**, which supplies selected context to later work;
- an **Event**, which records something that happened; or
- a **Human Task**, which asks a person to do or decide something.

## 2. What Arturo supports now

The current terminal supports:

```text
/artefacts
/artefacts
/artefact add ...
/artefact version ...
/artefact inspect ...
/artefact verify ...
/artefact submit ...
/artefact review ...
```

It can:

- record a local file or HTTPS reference;
- create a local, hashed evidence Artefact when an authorized Worker uses Arturo's governed Web Search path;
- create stable Artefact IDs;
- create exact versions such as `artefact-1@1`;
- calculate SHA-256 and file size for local files;
- store creator, source Task, and source Human Task links;
- attach exact input and output versions to Human Tasks;
- carry exact versions through an ordered Workflow;
- assign exact versions to a named Human reviewer;
- sign approve, reject, or revise decisions;
- block a Task until exact required versions are approved; and
- include bounded verified local text and SVG in later AI Task context.

## 3. What Arturo does not do

Arturo is not a full document-management system.

It does not:

- copy or upload the file;
- make a backup;
- fetch an external URL;
- preview a PDF or binary image in the terminal;
- compare two file versions visually;
- manage copyright, licences, retention, or deletion rules;
- authenticate the Human who is using a registered name;
- prove professional quality or legal compliance;
- publish or deliver the file; or
- verify an external hash supplied by the user.

Governed Web Search is a narrow exception to the general “do not fetch an
external URL” rule. Arturo calls a configured search service, then records only
the returned title, public HTTPS URL, and snippet in a new local JSON evidence
Artefact. It does not fetch the result page itself. The snippet remains
unverified third-party content.

Inspect the search setup before using it:

```text
/web-search
/capabilities web-research
```

After a Web Search Task completes, `/task inspect <task-id>` shows the exact evidence
Artefact reference. Use `/artefact inspect <artefact-id>@<version>` and
`/artefact verify <artefact-id>@<version>` to inspect its origin and confirm
that the saved local evidence file still matches its recorded hash.

For a local file, Arturo stores an absolute path. If the file is moved, deleted, or changed, `/artefact verify` reports the problem.

## 4. Exact versions are important

Suppose a Human approves:

```text
artefact-3@1
```

Someone then changes the file. That change must become:

```text
artefact-3@2
```

Approval of version 1 does not approve version 2. This prevents a reviewed file from being silently replaced by different bytes.

## 5. Add a local file

First create an Enterprise and register the person who made the file:

```text
/enterprise create "Harbour Studio" --mission "Create reviewable educational materials."
/add-human-worker "Studio Designer" --archetype creator --availability available
```

Create a harmless local file outside Arturo, then register it:

```text
/artefact add "Evidence Labels Guide" --enterprise "Harbour Studio" --kind design --file "./studio-files/evidence-labels.svg" --created-by "Studio Designer"
```

Arturo prints an ID, exact version, and SHA-256.

Inspect and verify it:

```text
/artefacts
/artefact inspect artefact-1
/artefact verify artefact-1@1
```

Use the IDs printed by your own terminal.

## 6. Add an HTTPS reference

Arturo can record an external location:

```text
/artefact add "External design package" --enterprise "Harbour Studio" --kind design --uri "https://example.com/designs/package.svg" --created-by "Studio Designer" --media-type "image/svg+xml"
```

Arturo does not download that URL. If an authoritative system gives you a SHA-256, it can be recorded:

```text
/artefact add "External design package" --enterprise "Harbour Studio" --kind design --uri "https://example.com/designs/package.svg" --created-by "Studio Designer" --media-type "image/svg+xml" --sha256 <64-hexadecimal-characters>
```

The hash remains externally supplied and unverified by Arturo.

## 7. Link a file to Human work

Create and assign a Human Task:

```text
/create-human-task "Create the final guide file" "Create one SVG containing the illustration and written guidance." --assign-to "Studio Designer" --purpose "Turn the approved brief into a real file."
```

After the Human creates the file, register it against the returned task ID:

```text
/artefact add "Evidence Labels Guide" --enterprise "Harbour Studio" --kind design --file "./studio-files/evidence-labels.svg" --created-by "Studio Designer" --human-task <human-task-id>
```

Complete the task with the exact version:

```text
/complete-human-task <human-task-id> "Created the SVG guide with its illustration and written checklist." --as "Studio Designer" --artefact artefact-1@1
```

Now `/human-task <human-task-id>` shows the exact output.

## 8. Review a finished version

Register the reviewer:

```text
/add-human-worker "Studio Reviewer" --archetype reviewer --availability available
```

Submit the exact version:

```text
/artefact submit artefact-1@1 --reviewer "Studio Reviewer" --notes "Check the drawing, written guidance, evidence labels, and release wording."
```

Before deciding, the Human should open the file and compare its hash:

```text
/artefact inspect artefact-1
/artefact verify artefact-1@1
/human-tasks
```

Approve:

```text
/artefact review artefact-1@1 --decision approve --as "Studio Reviewer" --notes "Approved for the next internal step."
```

Reject:

```text
/artefact review artefact-1@1 --decision reject --as "Studio Reviewer" --notes "The written guidance does not match the illustration."
```

Request revision:

```text
/artefact review artefact-1@1 --decision revise --as "Studio Reviewer" --notes "Add the missing evidence warning and correct the dimensions."
```

The signed record binds the decision to:

- Artefact ID;
- version;
- URI;
- SHA-256 when present;
- reviewer;
- decision;
- notes; and
- time.

This protects the review record from unnoticed changes inside Arturo. It does not prove that the reviewer is qualified or that the file is legally safe.

## 9. Add a revised version

After correcting the file:

```text
/artefact version artefact-1 --file "./studio-files/evidence-labels-v2.svg" --created-by "Studio Designer" --notes "Added the evidence warning requested in review."
```

Inspect both versions:

```text
/artefact inspect artefact-1
```

Version 2 begins as a draft and needs its own review.

## 10. Give a file to an AI Worker

Use an exact version as Task input:

```text
/task-cap --capability analysis --bounded-task "List unclear statements in the supplied guide. Do not rewrite or approve it." --input-artefact artefact-1@2
```

Arturo adds metadata for every supplied file. It also includes bounded content when the file is verified local text or SVG.

Binary images, PDFs, and remote content are not sent as file content by this path. Their metadata is visible, but the text-only Worker cannot inspect their visual contents.

Artefact content is labelled as data. It cannot override the Task, Governance, or Worker instructions.

## 11. Block a Task until approval

The following Task stays blocked until `artefact-1@2` is approved:

```text
/task-cap --capability analysis --bounded-task "Prepare a bounded release checklist from the approved guide." --input-artefact artefact-1@2 --after-artefact-approval artefact-1@2
```

`/tasks` shows:

```text
Blocked — awaiting Artefact approval
```

When the exact version receives an approved review, Arturo returns the Task to the queue. Approving version 1 does not release a Task waiting for version 2.

## 12. Use Artefacts in an ordered Workflow

A Workflow can pass files through AI and Human steps:

```text
/workflow create "Studio Guide Review" --objective "Create and review one exact studio guide." --step "Studio Designer" "Create the SVG guide and attach it as an Artefact." --step "Studio Reviewer" "Review the exact output version." --step "Guide Analyst" "Analyse only the approved guide and list unresolved issues."
/run studio-guide-review
```

The sequence pauses for the Human creator. The creator adds and attaches the file with `/artefact add` and `/complete-human-task --artefact`.

The next Human review Task receives the exact version. Downstream analysis is created only after that Human review is approved.

## 13. Artefacts and Operational Memory

Do not copy a whole document into Operational Memory.

Memory is for short, selected context such as:

```text
Use the approved evidence-label guide for future studio drafts.
```

Even that statement should name an exact Artefact version when the distinction matters. Memory does not replace the file, its hash, or its review record.

## 14. Evidence and trust

A useful Artefact record still needs careful interpretation:

- A hash proves byte identity, not truth.
- A Human-entered creator name is attribution, not authentication.
- An approved review is a recorded decision, not a professional certificate.
- A local file can disappear after it is recorded.
- An HTTPS reference can change outside Arturo.
- An AI analysis remains model output.
- A completed Task is not proof of real-world success.

## 15. What should be added later

Future versions of Arturo may add:

- managed file storage and backups;
- role-based access control;
- malware scanning;
- image and PDF preview;
- safe multimodal inspection;
- visual and textual version comparison;
- retention and legal-hold rules;
- copyright and licence metadata;
- release, withdrawal, and delivery lifecycle;
- connector-based source capture;
- external signatures and identity providers; and
- export packages containing Artefact, Task, Event, policy, and approval history.

Those features are not implied by the current commands.

## 16. Verification checklist

Before relying on an Artefact:

- [ ] I have the exact `artefact-id@version`.
- [ ] The Enterprise and kind are correct.
- [ ] The creator and source work are recorded.
- [ ] `/artefact verify` reports the expected integrity state.
- [ ] The Human reviewed the same exact version.
- [ ] The review signature is valid.
- [ ] A changed file has a new version.
- [ ] A downstream Task lists the intended input versions.
- [ ] External claims and prices have authoritative sources.
- [ ] An authorized person has checked any real-world release or delivery.

## 17. Safe stopping point

Stop after the Artefact, exact version, hash, Human decision, and any bounded downstream Task are recorded and inspectable.

Do not claim that Arturo stored, published, delivered, copyrighted, licensed, certified, or legally approved a file unless a real authorized system and person performed that action.
