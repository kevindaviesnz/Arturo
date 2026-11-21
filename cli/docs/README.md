# Arturo CLI documentation

This folder explains how to install and use Arturo's terminal.

If the product ideas are new to you, read
[Arturo in plain English](../../docs/START_HERE.md) first.

## Start here

1. [Getting started](./getting_started.md) — install Arturo and confirm it runs.
2. [Your first Enterprise](../../docs/Chapter_3_Your_First_Enterprise.md) — set up a business, then carry on through the lessons.
3. [Command reference](./command-reference.md) — every primary command, grouped, one line each.
4. [MVP happy path](./mvp-happy-path.md) — create an Enterprise, Function, Runtime, Workers, governed Task, and Human Task.
5. [Tutorial index](./tutorial.md) — focused exercises using supported commands.
6. [Scenario guide](./scenarios/README.md) — realistic synthetic operating scenarios.
7. [Configuration](./configuration.md) — optional settings: web access, Web Search, network, headless.
8. [CLI FAQ](./faq.md) — primary versus advanced kernel commands.

The running terminal gives the most accurate command help:

```text
/help
/help <command>
/help all
```

Primary Help is the supported user-facing surface. `/help all` additionally exposes low-level and legacy developer commands; their presence does not make them the recommended product workflow.

## What belongs elsewhere

Project-wide architecture, product direction, investor material, and the ANEA reader guide live in [`../../docs/`](../../docs/). Historical kernel material is grouped under [`../../docs/architecture/`](../../docs/architecture/).

## Documentation rule

Copyable examples must use commands from primary `/help`, state prerequisites and side effects, explain how to verify the result, and distinguish model output from verified evidence or external action.
