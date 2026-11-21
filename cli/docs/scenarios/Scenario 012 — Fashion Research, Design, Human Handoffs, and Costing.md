# Scenario 012 — Fashion Research, Design, Human Handoffs, and Costing

> **Advanced, manually-run scenario.** Unlike the others, this exercise depends
> on things a scripted run cannot supply: a configured Web Search provider (or a
> dated offline evidence file) and a human physically creating the SVG design
> files that the review and costing steps hash and gate on. It therefore has no
> auto-captured transcript in `scenario_testing/`; run it by hand, supplying the
> files and (optionally) search configuration yourself. The other scenarios use
> the deterministic `/task create` → `/approve` path and are captured
> automatically.

## What this scenario proves

This scenario follows one design from evidence to costing:

1. An authorized AI Worker searches current public sources through Arturo's governed Web Search path.
2. A second AI Worker turns the evidence into design briefs.
3. A Human creates real files containing drawings and written specifications.
4. A second Human reviews the exact file versions.
5. Only after approval, a third AI Worker receives the files for material and cost analysis.

Arturo now supports governed search, dated source capture, ordered handoffs, named Human ownership, file references, version hashes, exact post-output approval, and conditional release of the costing step.

Important limits remain:

- Web Search returns public result titles, URLs, and snippets. It does not open result pages, sign into social platforms, or bypass their access restrictions.
- Search snippets are unverified third-party content. Important claims must still be checked at their original sources.
- Arturo cannot truthfully obtain current supplier prices unless a price source is connected or supplied as an Artefact. The Cost Analyst must list missing prices instead of inventing them.

## What an Artefact is

An Artefact is Arturo's record of a real file or HTTPS file reference. Arturo records:

- a stable ID and exact version, such as `artefact-2@1`;
- the Enterprise and file kind;
- the creator and source Function or Human Task;
- the file location and media type;
- the local file size and SHA-256 hash;
- its Human review state and signed decision.

Arturo does not copy or upload the file. A local file must stay at the recorded path. Verified local text and SVG can be passed to a later AI Worker as bounded data. Binary images, PDFs, and remote URLs are metadata-only.

## Start with isolated data

Run Arturo from `cli/` with a separate data directory:

```bash
mkdir -p .data/fast-fashion
ARTURO_DATA_DIRECTORY=.data/fast-fashion ARTURO_RUNTIME_DATABASE_PATH=.data/fast-fashion/runtime.db npm run ui
```

Do not use `/reset` if that data directory contains work you want to keep.

## Configure governed Web Search

Arturo supports the official
[Brave Web Search API](https://api-dashboard.search.brave.com/documentation/services/web-search)
or an operator-controlled
[SearXNG Search API](https://docs.searxng.org/dev/search_api.html)
endpoint. The configuration is read when Arturo starts.

Arturo supports two providers:

- Brave Search API, using `BRAVE_SEARCH_API_KEY`;
- an operator-controlled SearXNG service with JSON search enabled.

For Brave Search, add the following to `cli/.env`:

```dotenv
ARTURO_WEB_SEARCH_PROVIDER=brave
BRAVE_SEARCH_API_KEY=replace-with-your-key
ARTURO_WEB_SEARCH_MAX_CALLS_PER_SESSION=5
ARTURO_WEB_SEARCH_MAX_RESULTS=5
ARTURO_WEB_SEARCH_TIMEOUT_MS=12000
ARTURO_WEB_SEARCH_ALLOWED_DOMAINS=
ARTURO_WEB_SEARCH_BLOCKED_DOMAINS=
```

For a local SearXNG service:

```dotenv
ARTURO_WEB_SEARCH_PROVIDER=searxng
ARTURO_SEARXNG_URL=http://127.0.0.1:8080
ARTURO_WEB_SEARCH_MAX_CALLS_PER_SESSION=5
ARTURO_WEB_SEARCH_MAX_RESULTS=5
```

Restart Arturo after editing `.env`, then inspect the fail-closed boundary:

```text
/web-search
/capabilities web-research
```

Do not proceed with the live-search version of this scenario unless `/web-search` reports `Ready: yes`.

## 1. Create the Enterprise

```text
/enterprise          → 1 · "Threadline Fashion"
                       · "Turn supplied fashion evidence into reviewable designs and bounded cost estimates while keeping people in control."
                       · skip
```

## 2. Register the Workers

The two Humans have different jobs. The creator performs offline file work. The
reviewer makes the exact-version decision.

Each Worker is added in two steps: `/add-ai-worker` or `/add-human-worker` names
it and gives it a role, then `/refine-worker` gives it the specialization. The
role lists are numbered — `4` on the person flow opens the full list, which is
where `creator` lives.

```text
/add-ai-worker       → "Trend Evidence Researcher" · researcher
/refine-worker       → "Trend Evidence Researcher"
                       · "Use only Arturo-captured Web Search evidence. Name each source URL, separate snippets from inference, and label missing evidence."

/add-ai-worker       → "Design Brief Creator" · creator
/refine-worker       → "Design Brief Creator"
                       · "Create garment briefs only from the preceding evidence. State audience, silhouette, materials, dimensions still needed, and unresolved questions."

/add-human-worker    → "Design File Creator" · 4 · creator · skip
/refine-worker       → "Design File Creator"
                       · "Creates the actual text-and-image design files and records exact Arturo Artefact versions."

/add-human-worker    → "Design Approver" · 2 (reviews work before it goes out) · skip
/refine-worker       → "Design Approver"
                       · "Checks each exact design version, its written specification, and its hash before approving or rejecting it."

/add-ai-worker       → "Material Cost Analyst" · analyst
/refine-worker       → "Material Cost Analyst"
                       · "Calculate only from approved dimensions, quantities, waste assumptions, and supplied prices. Never invent a price."
```

Check the result:

```text
/workers
/workers inspect "Design File Creator"
/workers inspect "Design Approver"
```

## 3. Create the ordered Workflow

This form is deterministic: Arturo does not ask a model to choose, rename, or reorder the Workers.

Enter the following as one command:

```text
/workflow create "Fast Fashion Production" --objective "Turn current captured fashion evidence into approved design files and a bounded material costing." --step "Trend Evidence Researcher" "Web search query: current recycled cotton oversized outerwear fashion trends" --step "Design Brief Creator" "Create two garment design briefs using only the preceding captured Web Search evidence. Preserve source URLs and label every assumption." --step "Design File Creator" "Create exact text-and-image SVG design files with dimensions and material specifications, then attach every version as an Artefact." --step "Design Approver" "Inspect and decide on every exact design Artefact version." --step "Material Cost Analyst" "Calculate material quantities and costs only from approved design specifications and supplied prices; list every missing input."
```

Start it with explicit Enterprise ownership:

```text
/run fast-fashion-production "Use public search evidence only. Do not claim access to private social-media accounts or full source pages."
```

The Workflow will run one step at a time. Use:

```text
/tasks
/task inspect <research-task-id>
/artefacts
/timeline
```

Before calling the model, Arturo searches once, filters the results, and creates a local JSON evidence Artefact. The research Function lists the exact evidence reference under `Input Artefacts`. Inspect it:

```text
/artefact inspect <web-evidence-artefact-id>
/artefact verify <web-evidence-artefact-id>@1
/web-search
```

The evidence file records the provider, query, retrieval time, permitted source URLs, result titles, snippets, and warning that snippets are not verified facts.

## 4. Complete the Human design-file step

After the first two AI Functions finish, Arturo creates an assigned Human Task for `Design File Creator`.

```text
/human-tasks
/human-task <human-task-id>
```

The Human now creates the real files outside Arturo. SVG is useful for the demonstration because one file can contain both a drawing and written material specifications. Register every file against the Human Task:

```text
/artefact add "Look 01 design" --enterprise "Threadline Fashion" --kind design --file "./fashion-designs/look-01.svg" --created-by "Design File Creator" --human-task <human-task-id>

/artefact add "Look 02 design" --enterprise "Threadline Fashion" --kind design --file "./fashion-designs/look-02.svg" --created-by "Design File Creator" --human-task <human-task-id>
```

Copy the exact references and complete the task:

```text
/complete-human-task <human-task-id> "Created two SVG design files containing drawings, dimensions, material specifications, and waste assumptions." --as "Design File Creator" --artefact artefact-2@1,artefact-3@1
```

Completion carries those exact versions into the next Workflow step.

## 5. Review the exact versions

Arturo now creates a Human review Function assigned to `Design Approver`. The versions move from `draft` to `awaiting_review`.

```text
/tasks
/task inspect <review-task-id>
/artefact inspect artefact-2
/artefact verify artefact-2@1
/artefact inspect artefact-3
/artefact verify artefact-3@1
/approval-status <review-job-id>
```

The Human opens the files at the displayed locations and compares their SHA-256 values with Arturo. If both versions are acceptable:

```text
/approve <review-job-id>
```

If they are not acceptable:

```text
/reject <review-job-id> "The written dimensions do not match the drawing."
```

An approved decision is signed against each exact version, URI, hash, reviewer, reason, and time. A changed design must be registered as a new version:

```text
/artefact version artefact-2 --file "./fashion-designs/look-01-v2.svg" --created-by "Design File Creator" --notes "Corrected dimensions after review."
```

Approval of `artefact-2@1` never silently approves `artefact-2@2`.

## 6. Inspect the costing handoff

The Cost Analyst Function appears only after the Human review step is approved:

```text
/tasks
/task inspect <costing-task-id>
```

The Function contains:

- the exact approved Artefact references;
- each name, URI, media type, hash, integrity state, and review state;
- bounded verified SVG text containing the written specifications;
- the instruction not to invent missing prices.

If prices are not in the design files, the correct result is a quantity calculation plus a list of missing price inputs. To supply prices separately:

```text
/artefact add "Approved supplier price list" --enterprise "Threadline Fashion" --kind price-list --file "./fashion-inputs/supplier-prices.csv" --created-by "Design File Creator" --notes "Operator-supplied prices; check the source date before commercial use."
```

`/task create` below is the one step in this scenario that does **not** go
through the Workflow. It belongs to a Function, and a Function has to be
staffed before it can take work — the Workers registered earlier exist, but
registering a Worker does not assign it to a Function. Run `/staff` once and
accept its proposal before the next command, or the Task is refused with
"has no Worker assigned to it".

```text
/staff

/task create "Calculate quantities and costs using only the approved designs and supplied price list. State the price date and list missing values." --input-artefact artefact-2@1,artefact-3@1,artefact-4@1 --after-artefact-approval artefact-2@1,artefact-3@1
```

## Manual Artefact review without a Workflow

The exact-version gate is also available on its own:

```text
/artefact submit artefact-2@1,artefact-3@1 --reviewer "Design Approver" --notes "Check drawing, written dimensions, material, and construction assumptions."

/artefact review artefact-2@1,artefact-3@1 --decision approve --as "Design Approver" --notes "Approved for bounded costing."
```

This path creates a Human Task for the review. Use `/human-tasks` and `/artefact inspect` to verify the record.

## What to verify

- `/workers` shows three AI Workers and two Human Workers.
- `/human-task <id>` names the Human owner and later lists exact output Artefacts.
- `/artefact verify <id>@<version>` reports whether a local file still matches its stored hash.
- `/task inspect <review-task-id>` lists the exact design versions.
- `/approval-status <review-job-id>` attributes the decision to `Design Approver`.
- `/artefact inspect <id>` shows the signed review state for only that version.
- The costing Function does not exist until the review Function is approved.
- `/timeline` preserves the ordered handoffs.

## What this does not claim

- A governed Web Search occurred only if `/web-search` reported ready and the Function records `External tools used: web-search`.
- Search result snippets do not prove that Arturo opened, read, or verified the full source pages.
- Arturo did not sign into a social-media account or bypass a platform restriction.
- No supplier price is current unless a dated, authoritative source is supplied.
- An AI design brief is unverified model synthesis.
- A valid hash proves which bytes were reviewed; it does not prove design quality, copyright ownership, regulatory compliance, or commercial suitability.
- Human registration and attribution do not authenticate identity or professional authority.
- Arturo does not publish the design, place a material order, or contact a supplier.

## Offline fallback

If no search provider is configured, do not ask the model to pretend it searched. Supply a dated evidence file instead:

```text
/artefact add "Dated fashion trend notes" --enterprise "Threadline Fashion" --kind evidence --file "./fashion-inputs/trend-notes.txt" --created-by "Design File Creator" --notes "Operator-supplied evidence; no live search was performed."
```

Create a second Workflow with a non-searching first step:

```text
/workflow create "Fast Fashion Production Offline" --objective "Turn supplied dated fashion evidence into approved design files and a bounded material costing." --step "Trend Evidence Researcher" "Summarize only the supplied dated evidence and label every assumption." --step "Design Brief Creator" "Create two garment design briefs using only the preceding supplied evidence." --step "Design File Creator" "Create exact text-and-image SVG design files with dimensions and material specifications, then attach every version as an Artefact." --step "Design Approver" "Inspect and decide on every exact design Artefact version." --step "Material Cost Analyst" "Calculate material quantities and costs only from approved design specifications and supplied prices; list every missing input."
```

Then start the normalized Workflow name with:

```text
/run fast-fashion-production-offline --input-artefact artefact-1@1
```

The live-search and offline-evidence demonstrations should remain separate so their provenance cannot be confused.

## Safe completion condition

Stop after:

1. the design files and hashes are recorded;
2. the named Human has approved or rejected the exact versions;
3. the final AI has calculated only from supplied values and listed missing data; and
4. the Timeline can reconstruct the sequence.

Do not publish, manufacture, order material, or describe the costs as current until authorized people have checked the real files, evidence, prices, rights, and applicable obligations.
