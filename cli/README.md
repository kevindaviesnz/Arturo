# Arturo CLI

This folder contains Arturo's TypeScript program and terminal interface.

For the product overview, investor demonstration, licence status, and repository-wide documentation map, start with the [project README](../README.md).

## Run Arturo

Requirements:

- a current version of Node.js;
- npm; and
- Ollama if you want to use a local AI model.

```bash
npm install
npm run ui
```

Inside Arturo, begin with:

```text
/help
/overview
```

Use `/help <command>` for syntax, examples, required setup, changes, and
recovery guidance. The native terminal (`npm run ui`) is the supported product interface.

For example, remove an obsolete Worker safely with:

```text
/workers remove "Old Research Worker"
```

Arturo preserves historical work and refuses removal while unfinished work
still depends on that Worker. Run `/help workers` for the full safety rules.

The terminal normally selects readable colours automatically. If your terminal
does not report whether its background is light or dark, set the theme in
`cli/.env`:

```dotenv
ARTURO_TERMINAL_THEME=light
```

Supported values are `light`, `dark`, and `auto`. Arturo uses an adaptive
palette when `auto` cannot identify the background. You can also disable
colours completely by starting Arturo with `NO_COLOR=1 npm run ui`.

## Governed Web Search

Arturo can give an explicitly authorized AI Worker current public search
results through Brave Search or an operator-controlled SearXNG service.
Search is disabled by default and fails closed unless the provider,
credentials or endpoint, and a positive process-local call allowance are
configured.

Copy the Web Search settings from [`.env.example`](./.env.example) into the
ignored `cli/.env`, restart Arturo, then check:

```text
/web-search
/capabilities web-research
```

Register Web Search authority explicitly:

```text
/add-ai-worker "Fashion Web Researcher" --archetype researcher --model local --refine "Use captured source results and label uncertainty."
```

Run one bounded search-and-analysis Task:

```text
/task create "Summarize only the captured sources and label uncertainty." --job "Trend Research" --search-query "current recycled cotton outerwear fashion trends" --enterprise "Threadline Fashion"
```

Arturo stores the normalized result set as a dated, hashed evidence Artefact
before the model runs. It captures titles, public HTTPS URLs, and snippets; it
does not open result pages, sign into websites, bypass restrictions, or make
third-party claims verified.

For recurring work owned by an ongoing Job, Arturo can publish a Business
Event after the retrieval Task completes and its captured evidence passes
integrity checks:

```text
/event rule add --when task.completed --job "Science Discovery" --capability web-research --publish "Science evidence ready" --enterprise "Science Tracker"
/event rule list
```

The model does not publish this Event. Arturo's deterministic operating
process applies the rule once per completed Task owned by the selected ongoing
Job.

Create a recurring bounded Task at a fixed daily local time with a persistent
Schedule:

```text
/schedule add "Retrieve current public science news" --every daily --at "09:00" --timezone "Pacific/Auckland" --job "Science Discovery" --enterprise "Science Tracker" --search-query "latest public science news"
/schedule list --enterprise "Science Tracker"
```

The Schedule uses Arturo's application clock rather than a model. It creates a
dormant Task immediately, then queues it only when due; the Worker runtime
performs the queued-to-running transition. Later occurrences reuse that Task
only after it has completed, with Worker selection performed again each time.
If the prior Task is unfinished, Arturo skips and records the occurrence. If
Arturo was stopped, one catch-up occurrence queues on the next start. Use
`--every friday`, for example, for weekly work.

Provider setup follows the official
[Brave Web Search API](https://api-dashboard.search.brave.com/documentation/services/web-search)
or [SearXNG Search API](https://docs.searxng.org/dev/search_api.html)
contract. Search calls can consume provider quota even when a provider returns
an error, so Arturo counts every attempted request against the session limit.

## Documentation

- [CLI documentation index](./docs/README.md)
- [Getting started](./docs/getting_started.md)
- [MVP happy path](./docs/mvp-happy-path.md)
- [Tutorial index](./docs/tutorial.md)
- [Scenario guide](./docs/scenarios/README.md)
- [Fast Fashion AI/Human handoff scenario](<./docs/scenarios/Scenario 012 — Fashion Research, Design, Human Handoffs, and Costing.md>)

The running `/help` implementation and automated tests are authoritative for executable command behaviour. The chapter guide under [`../docs/`](../docs/) includes both current workflows and clearly labelled target architecture.

## Development commands

```bash
npm run build
npm run test:run
npm run dev
```

`npm run test:run` supplies test-only secrets and disables file-level parallelism so the complete suite runs reproducibly. Those values are not suitable for an Arturo installation.

## Status and licence

Arturo is open-source pre-release software licensed under the [Apache License 2.0](../LICENSE).
