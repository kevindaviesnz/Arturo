# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

Arturo is an open-source (Apache License 2.0), command-line-only TypeScript application ("the operating system for
AI-native companies"). All working code lives under `cli/`. The repository root otherwise holds
product and architecture documentation (`docs/`), customer personas (`customers/`), and top-level policy files
(`README.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `SECURITY.md`, `CONTRIBUTING.md`, `LICENSE`).

Arturo's core value proposition is enforcing trust boundaries for autonomous AI agents: capability
attestation, deterministic policy enforcement, and human approval workflows. The security properties
of these mechanisms are the product, not a supporting concern — a gap in approval signing, policy
evaluation, or capability authorisation is a correctness failure of the core claim, not a peripheral
bug. Treat `runtime/approvals*`, `policy/`, and `integrations/` as the highest-scrutiny
surfaces in the codebase.

See `CONTRIBUTING.md` for contribution guidelines and core design invariants.

## Commands

All commands run from `cli/`:

```bash
npm install
npm run ui          # primary product entrypoint — the terminal interface (src/ui/lineInterface.ts)
npm run ui bot      # same interface, driven by a bot instead of a person (see below)
npm run try         # pre-seeded local sandbox demo in .data/harbour (terminal)
npm run dev         # kernel-era REPL entrypoint (src/cli.ts -> src/repl), lower-level
npm run build       # tsc -> dist/
npm run test        # vitest (watch mode)
npm run test:run    # vitest run, single-threaded, with required test-only secrets set — use this for CI-style runs
```

Run a single test file or test name with vitest directly (after copying the required env vars from
the `test:run` script, since bare `vitest` will fail on missing secrets for anything touching
approvals/human tasks/replay/API secrets):

```bash
APPROVAL_SIGNING_SECRET=test-approval-secret-000000000000 \
HUMAN_TASK_TOKEN_SECRET=test-human-task-secret-000000000000 \
RUNTIME_REPLAY_ATTESTATION_SECRET=test-replay-secret-000000000000000 \
API_SECRET_ENCRYPTION_KEY=test-api-secret-encryption-key-00000000 \
ARTURO_HTTP_ALLOWED_HOSTS=example.com \
npx vitest run src/runtime/approvalGate.test.ts
npx vitest run -t "some test name"
```

`cli/vitest.config.ts` carries the settings the suite needs to be correct, so bare `npx vitest`
gets them too and only the secrets above have to be supplied by hand. Do not remove any of them:

- `fileParallelism: false` — the suite shares SQLite and file-backed state and is not safe to run
  fully parallel.
- `pool: "forks"` — on vitest's default `threads` pool the run segfaults (exit 139) partway
  through, at a different file each time, because `better-sqlite3`'s native binding is being loaded
  into worker threads. The failure has no output and no failing test to point at.
- `setupFiles: ["./vitest.setup.ts"]` — pins `stdin`/`stdout`/`stderr` `isTTY` to false and sets
  `NO_COLOR`. Otherwise the suite's result depends on how it was launched: from a terminal,
  `isInteractiveSession()` is true, so guided flows engage where a test expected the
  non-interactive refusal, and formatter assertions see ANSI escapes. Under the old `threads` pool
  this was hidden — worker threads report `isTTY` as undefined regardless of the parent. Tests that
  want an interactive session still define `process.stdin.isTTY` themselves; do not swap this for
  `ARTURO_NON_INTERACTIVE`, which would override them.

Other scripts: `npm run kernel:test`, `npm run test-email`, `npm run demo`, `npm run try`.

### Bot mode

`npm run ui bot` opens the ordinary interface and supplies the input itself, live, at a pace a
viewer can follow. It is the same `startLineInterface` session with a driver attached that types
into the same readline — **in-process, so stdin stays a TTY** and the ~40 `isInteractiveSession()`
gates keep working. Do not turn it into a subprocess or a second renderer.

```bash
npm run ui bot                          # replay scenario 001
npm run ui bot 025                      # any scenario_harness plan by number
npm run ui bot auto "grow a practice"   # the model chooses each command
npm run ui:bot:isolated                 # against a throwaway data directory
npm run ui bot -- --pace 3000 --approve --yes
npm run ui bot -- --type-pace 0         # paste each line whole instead of typing it
```

A line is performed in three beats, all owned by `botTerminal.submit` and all varied by ±40% so
the rhythm is not metronomic: `--pace` thinking before it starts (2200ms base), `--type-pace` per
keystroke (120ms, about 100wpm), then a shorter beat before Return. Do not add a pause in the
driver as well — it used to sleep before `submit`, which stacked two waits and put the
`bot.input` event a full pause before the typing it describes. `--type-pace 0` drops the
performance and pastes each line.

The thinking beat grows with the length of what Arturo just printed
(`thinkingDelayMs`), because a one-line acknowledgement and a screen of `/timeline` do not take
the same time to take in — measured live at 2.5s after `/functions` and 6.2s after `/timeline`.
It is capped at 4× the base so a very long result cannot stall the run. The length is measured
from the *rendered* entries in `notifyTurnComplete`, which is what is on the operator's screen.

That makes a line take tens of seconds, which is why every beat is interruptible, thinking
included. Any keypress pauses; **space** — or Enter on an empty line — hands it back. Space only
resumes when the input line is empty, or a space typed mid-command would restart the bot with
half the operator's command still in the buffer. An interrupted line is abandoned with `ctrl-u`
and retyped from the start, rather than letting the operator's characters interleave into the
bot's command and be submitted as one mangled line. `notifyHumanActivity` is trusted
unconditionally because `rl.write()` emits no stdin keypress events at all — measured, so the bot
cannot pause itself.

Points to preserve when changing it (`cli/src/bot/`):

- **Most plans open with `/reset`**, which erases the installation. There is a pre-flight that
  stops and names `ui:bot:isolated`; `--yes` is the only way past it, and `ui:bot:isolated` passes
  `--yes` itself — the directory it resets is disposable by construction, so stopping to warn about
  it there would only be recommending the command the operator already ran.
- **Every bot-submitted `/approve`/`/reject` carries an explicit `--as`**, and a run without
  `--approve` refuses those lines outright — in both modes, from a plan as much as from a model.
  Without either, `resolveApprovalCommandIdentity` auto-selects the sole eligible human and the
  script's decision is recorded, inside the HMAC, under a real person's name. That is not
  hypothetical: it happened, because the refusal was autonomous-mode-only and scenario 001 contains
  `/approve`. Neither guard may be made conditional on anything else. See `THREAT_MODEL.md` item 7.
- **Autonomous mode never runs `/reset`** or any removal, whatever the model proposes, and cannot
  approve unless started with `--approve`. A refused suggestion is shown, not silently retried.
- The plan format is the expect harness's, unchanged, so `scenario_harness/plans/*.plan` work as
  they are. `botPlanSource.test.ts` fails if a plan uses a directive bot mode does not understand.
- **`@wait N` is a ceiling, not a duration — in both drivers.** The numbers had to cover the
  slowest case, so every run paid the worst case: a filmed Blueprint 1 sat still for the full 150s
  after a `/task` whose work, by the database's own timestamps, took 5.4 seconds. Bot mode polls
  `hasWorkInFlight()` (`waitForWorkToSettle` in `botDriver.ts`); the expect driver polls the same
  condition with `sqlite3 -readonly` against `<datadir>/runtime.db` (`wait_for_work` in
  `scenario_driver.exp`), because **the films are captured by the expect harness, not by bot
  mode** — `run_scenario_clean.sh` is what a recording runs, so a fix to bot mode alone does
  nothing for them. Only `queued` and `running` count as in flight: `scheduled` is a dormant
  recurring Task and `awaiting_*` is work resting on a person, and waiting on either would sit out
  the whole ceiling for nothing. Both give the work a couple of seconds to appear before deciding
  there is none, and both re-check after the settle grace rather than trusting it, because
  finishing one Task can queue the next. If the expect driver cannot read the database it sleeps
  the full N: a wrong path must make a run slow, never let it type into a screen still filling up.

Local config lives in `cli/.env` (copy from `cli/.env.example`, which must stay placeholder-only).
`.env` files are gitignored; never commit real secrets. Key env vars: `ARTURO_LLM_PROVIDER`/
`ARTURO_LLM_MODEL` (defaults to local Ollama), `ARTURO_MODEL_PROFILES_JSON` (approved model
aliases for `/next`/`/staff`), `ARTURO_PAID_ESCALATION_*` (external model escalation, fail-closed
by default), `ARTURO_WEB_SEARCH_*` (governed web search, disabled by default), `ARTURO_HTTP_ALLOWED_HOSTS`
(outbound HTTPS allowlist for Worker capabilities — required for any HTTP capability to run).

## Architecture

Read `ARCHITECTURE.md` for the conceptual model in full; the essentials:

```
Mission → Business Function → Runtime → Task → Worker
                                        ↘ approvals, Events, Memory, Health
```

- **Enterprise** — the company/org being modeled; owns Business Functions, Workers, Governance
  policies, and operating records. Multiple Enterprises can exist locally (not real tenant isolation).
- **Business Function** — a durable capability the Enterprise needs (e.g. "Customer Support").
  Owns an Objective; should never be named after a person, model, or one-off project.
- **Runtime** — the active/evaluating part of a Business Function: watches Events, decides if work
  is needed, creates Tasks, routes them to Workers. Runtime decisions may use an AI model and are
  not fixed safety rules.
- **Task** — one bounded unit of work with status, required capabilities, selected Worker, routing
  reason, Governance state, result, and an evidence label. A completed Task is not automatically
  correct or verified — approval to run is not approval of the eventual result.
- **Worker** — executes Tasks; kind is `ai` (archetype + model) or `human`. Registration proves
  nothing about a human's identity or authority.
- **Governance / policy** — deterministic (non-model) rule evaluation that allows, denies, or
  requires Human approval for a Task. Approval chains are cryptographically signed and verified.
- **Events / Memory / Health** — Events record things that happened (not guaranteed delivery);
  Operational Memory stores scoped, evidence-labeled lessons for future work (model-generated
  lessons without evidence can be quarantined); Health summarizes recorded outcomes for a Business
  Function — none of these prove real-world correctness or safety.
- **Low-level kernel** (`cli/src/kernel/`) — a cooperative, generator-based process kernel
  underneath all of this: capability calls, deterministic workflow definitions, snapshotting, and
  replay. Normal product usage goes through the primary command surface (`/help`); the kernel/replay
  commands are exposed for developers via `/help all` and are not the primary UX.

### Two parallel entrypoints — know which one you're touching

- **`npm run ui`** → `cli/src/ui/lineInterface.ts` is the maintained, documented product surface.
  It drives `runtime/workerRuntime`, `runtime/businessFunctionRuntimeCoordinator`, and
  `scheduling/eventScheduleRuntime` directly, with its own command parsing/state in `cli/src/ui/`
  (files prefixed `ui*Entries.ts`/`ui*Commands.ts`).
  It reads persisted runtime state via `uiRuntimeSnapshot.ts`.
- **`npm run dev`** → `cli/src/cli.ts` boots the `Kernel` (`cli/src/kernel/kernel.ts`), starts the
  WS runtime server, UI/review HTTP servers, and the older REPL (`cli/src/repl/`, commands in
  `cli/src/repl/commands.ts` and `*Commands.ts` siblings) — this is the lower-level/legacy path.

When changing user-facing behavior, check whether it needs to change in `src/ui/` (current
product), `src/repl/` (legacy REPL), or both — they are separate command implementations, not
shared. Command help text is generated from what's actually wired up (`/help`, `/help <command>`,
`/help all`); treat the running help output and tests as authoritative over documentation prose,
per `cli/docs/README.md`.

### Current state vs. intended design

This is pre-release. The architecture above describes the intended model; parts are partially
implemented or knowingly simplified. Do not assume a described guarantee is enforced end to end
without checking the implementation.

Known simplifications:

- Multiple Enterprises can exist locally, but there is no real tenant isolation.
- A completed Task is not verified-correct; approval to run is not approval of the result.
- Worker registration proves nothing about a human's identity or authority.
- Events are recorded, not guaranteed-delivered.
- Health summarises recorded outcomes only — it is not evidence of real-world correctness or safety.

<!-- TODO(Kevin): add any other areas that are aspirational rather than enforced,
     particularly anywhere the docs state a guarantee the code doesn't yet make. -->

### Directory map (`cli/src/`)

- `kernel/` — process kernel: capability registry/dispatch/policy, workflow definitions, scheduler,
  snapshot + replay.
- `runtime/` — the governed runtime built on the kernel: approvals (chain, gate, policy, signing),
  Business Function runtime (coordinator/evaluator/routing), cron & scheduled jobs + dead-letter
  queue, capability attestations/receipts, Human Tasks, notifications, runtime event log + replay/
  historical reconstruction.
- `agents/` — AI Worker archetypes, capability classification, prompt building for workers and
  workflow planning, workflow execution/queueing.
- `control/` — Worker registry (`workers.ts`), event store, workflow compiler/runner, run store.
- `business/` — Business Function definitions and their runtime/store/factory.
- `policy/` — deterministic policy engine: rules, roles, scopes, conflict resolution, inheritance,
  audit log/events.
- `task/` — Task execution engine, replay/resume, event store.
- `procedures/` — the Procedure-by-reference model: a Task carries a lean `procedureRef`
  (`proc-<id>@<version>`) and the runtime resolves a versioned, HMAC-integrity-signed, governed
  Procedure at execution (`procedureResolution.ts` does parse → verify → capability-authorize →
  fail closed). Instructions never travel in the task payload. Registry is currently in-memory
  (`procedureStore.ts`); deterministic-step execution and persistence are follow-ups.
- `core/` — small cross-cutting helpers, incl. `interactivity.ts` (`isInteractiveSession()`:
  non-interactive under non-TTY / `CI` / `ARTURO_NON_INTERACTIVE`, so headless runs refuse
  interactive prompts instead of hanging and approvals stay fail-closed).
- `storage/` — SQLite (`better-sqlite3`) repositories, one per record type (jobs, approvals, workers,
  policies, artefacts, events, secrets, etc.) plus `database.ts`/`runtimeDatabase.ts` and
  `runtimeStoragePaths.ts` for path/location resolution.
- `integrations/` — outbound side effects: HTTP capability adapters (GET/POST/webhook) with
  HTTPS-only + host-allowlist enforcement, API secret store/injection/rate-limit/retry, email
  sender, governed web search (Brave/SearXNG).
- `llm/` — model clients (Ollama, Gemini), model routing/profiles, usage tracking.
  `modelRouting.ts`/`modelProfiles.ts` implement the local-first / approved-alias / fail-closed
  external escalation described in `docs/Model_Routing.md`.
- `events/`, `scheduling/`, `delegation/`, `memory/`, `health/`, `governance/`, `enterprise/`,
  `chat/`, `guidance/`, `risk/`, `staffing/` — one subsystem each, generally with a `*Store`/
  `*Repository` (persistence), a `*Runtime`/`*Engine` (logic), and paired `.test.ts` files.
- `ui/` — the `npm run ui` product surface (see above).
- `repl/` — the legacy `npm run dev` command surface (see above).
- `server/` — HTTP/WS servers: `startServer` (UI), `startRuntimeServer` (WS), `startReviewServer`
  (external human review links).

### Conventions to preserve (from `CONTRIBUTING.md`)

- Business Functions own outcomes; Workers are replaceable execution resources — don't collapse
  that distinction (e.g. don't hang persistent state off a Worker that belongs to the Function).
- Consequential/external actions go through deterministic Governance/policy checks, not model
  judgment.
- Evidence provenance and uncertainty stay visible in anything user-facing (e.g. evidence labels,
  "model synthesis" vs. verified evidence) — don't silently upgrade model output to fact.
- **A decision must record the same thing however it was made.** The terminal `/approve` and the
  review-link `POST /review/:jobId/approve` both go through `refuseUndesignatedApprover`,
  `validateJobArtefactReviewer` and `recordJobArtefactDecision` — the browser path called none of
  them, so clicking Approve advanced the workflow while every Artefact version stayed
  `awaiting_review` with no signature. Any new decision surface must call the same three functions
  rather than reimplement them, and must refuse *before* mutating anything. The company overview's
  sign-off button (`POST /api/task/signoff`) is such a surface: it calls `signOffTaskResult`, the
  function behind `/task signoff`, and nothing else; see `THREAT_MODEL.md` item 10. Its "Set aside" control (`POST /api/task/setaside`) likewise calls only `setAsideTaskResult`, the function behind `/task setaside` (item 13). Its approve and reject controls (`POST /api/task/approve`, `/api/task/reject`) call only `decideApproval` / `decideRejection` in `repl/approvalCommands.ts`, which `/approve` and `/reject` print from; never reimplement any step of that sequence elsewhere (item 14). A Function's hand-off (a signed-off result becoming a Human Task for a named person) runs inside `signOffTaskResult` for the same reason; never trigger it from anywhere else (item 11). A person's work page (`/work`, `company/readPersonWork.ts`) completes a Human Task through `completeHumanTaskAs` in `runtime/humanTaskCompletion.ts`, the same function as `/complete-human-task`; any other surface that completes one must call it too (item 12). The overview's "New task" form (`POST /api/task/create` and `POST /api/request`, `company/newWork.ts`) creates a Task only through `createTask` in `repl/taskRoutingCommands.ts`, which `/task create` prints from; it passes the same flags the terminal would, including `--asked-by` (item 15). "Try again" (`POST /api/task/retry`) uses `planTaskRetry` (`task/planTaskRetry.ts`), as `/task retry` does, then `createTask` (item 16). First-day setup (`POST /api/setup`) calls `setUpBusiness` (behind `/setup`). Clients are added by conversation from the Clients list on Your business (`clients/clientIntake.ts`, `POST /api/assistant/talk`, behind `/talk`), which saves only through `addClient` (behind `/client add`) after the person confirms Arturo's own read-back; the model only proposes a business's questions (`clients/clientAssistant.ts`) and picks answers out of what was said. Never let a model decide "yes", the questions asked, or the save (item 17). New task's box (`requestFromPage`, `POST /api/request`) sends every request to `startWorkFromPage`. With nobody chosen and nothing attached, a request to add a new client (`isClientIntakeRequest` in `clients/clientRequests.ts`, fixed rules, never a model) starts and writes nothing: the page asks "Add a new client to Arturo's list of clients?", and its yes opens the client conversation fresh, which still saves only after the read-back and the person's yes; "No, I want something written" sends it on with `writeOnly`. A sign-off accepts text and never saves a record; every client save goes through the read-back and `addClient`. There is no "PA". Its Worker list is "Let Arturo decide", an AI worker (by business function) or a person: a person's task is a Human Task created only through `createHumanTaskFromArgs` in `repl/humanTaskCommands.ts`, which `/create-human-task` prints from. "Let Arturo decide" uses a business function only when `/task create`'s own measure (`taskFitParts`, `TASK_OWNING_JOB_MIN_SCORE`) picks it clearly and the words agree (`pageFit`: named, two words shared in any form, or one word and the kind of work), even when there is only one. Otherwise nothing is started: fixed rules first offer business functions that may fit (`nearby`, "Use Lease reviews instead?", `business/functionNames.ts`), then the page offers a new worker (`needsWorker`). Passing a result on is a new task that follows it (`followsTaskId` → `--follows`), never a control on the result: `startWorkFromPage` refuses a set-aside result and, through `refuseUnacceptedHandOver`, an AI result nobody has signed off, so that rule stays in one place (item 18). `createTask` refuses the same two for `--follows` at the terminal. The one way an unsigned AI result reaches another AI worker is to be checked before sign-off, by a rule a person who can sign off set on its business function (`setPassOn` in `runtime/passOnRules.ts`, behind `/function update --pass-on-to` / `--pass-on never` and `POST /api/area/passon`) or a choice for one task (`--pass-on`, New task's "When the result is ready"); `deliverPassOn` (`runtime/resultPassOn.ts`) creates the check through `createTask` with `--follows` and a one-time claim, never from a model's say-so, only for a banner-carrying AI result, only to a same-business function whose AI worker cannot reach outside Arturo without asking, one step only (`PASS_ON_STEPS`), and never for a function set to never. The end of every chain is a person's sign-off: the check is never signed off on its own (`signOffTaskResult` refuses it), Waiting for you shows the result once with the check beside it, and the page shows a count ("Points to check: N"), never a verdict or a tick (item 23). A business function may instead send its results along a route of at most `MAX_ROUTE_STEPS` steps a person set (`--route-step`, "Pass them along a route"), run by `deliverPassOn` the same way: each step through `createTask --follows` under a one-time claim, a step's own rule never followed, Arturo stopping for the first result's sign-off by default and for another client named in the work, stoppable by anyone who can sign off (`stopRoute`). Pass-on rules are HMAC-signed and an edited one is not followed. Every document is signed off on its own (no button signs several), and each sign-off binds the SHA-256 of what it was built on and any check kept with it (`alongside`, item 24). Once a business turns sign-in on (`identity/companySignIn.ts`), every company-page request needs a session, and `company/companyAccess.ts` wraps the page's reads for that one person: their business only, every decision as them (a different "as" is refused) inside `withAuthenticatedUser`, sign-off authority only under the owner's signed grant (`maySignOff`), setting up only for owner or admin; never add a page route that takes a person's name from the request without going through it (item 25). When no worker fits, `POST /api/worker/suggest` (`company/workerSuggestion.ts`) may ask a model, with the task marked as data, for the business function's name and one sentence each of Required and Guardrails. The worker's name ("<business function> AI worker"), a refusal of job titles as names, and the "It can" / "It cannot" lines are fixed in code. The archetype comes only from the person's words (the task), never from the model's name for the work. A suggested name that looks like an existing business function is offered as that function, never numbered. A business gets five suggestions a minute, and the route writes nothing. The card ("Arturo will set up a worker for this") shows everything before it exists; only the click of someone who can sign off creates it, recorded under the name of the person who asked (never an approver picked for them), through `POST /api/area/create`, which records where it came from (`business/functionOrigin.ts`: via, the task, the model's suggestion beside what was saved, how the archetype was chosen, who). "Create a custom worker instead" opens the full form for the same task. The page's `/next` (`POST /api/business/suggest`, `company/businessSuggestion.ts`) suggests business functions for the whole business through `createNextGuidanceResultForEnterprise` itself, writes nothing, leaves out job titles and names the business has in other words, and shows each on a card set up only by its own click (or "Set up all"), recorded as `via: "business"`; the kind of worker comes from `suggestArchetype` over the name and what it keeps doing, shown before set-up, and nothing the model wrote becomes Required or Guardrails. There is no page form of `/staff`'s model plan: a business function with no AI worker offers "Set up its AI worker" (`addWorkerFromPage`). `createEnterpriseFunction` refuses a name with the same words as an existing function at the terminal and on the page alike, and the page sets up at most `MAX_PAGE_FUNCTIONS` (item 19). What an AI worker is told is changed from a task's page ("Add instructions for next time", `POST /api/worker/instructions`) only through `refineWorker` (behind `/refine`), by someone who can sign off, for this business's own AI worker. Propose, then confirm: never let a model's suggestion be saved on its own, and never create a worker or business function without a person's click. Workers and business functions are set up from the page (`POST /api/worker/add`, `POST /api/person/add`, `POST /api/area/create`, `company/areaSetup.ts`) through the terminal's own functions: `registerWorkerFromArgs` for a person and an AI worker, `createEnterpriseFunction` (`business/businessFunctionCreation.ts`, behind `/function create`) for the area, `applyStaffingPlan` for who approves its work, and `setHandOff` for where signed-off results go. Everything is checked before the first write, only someone who can approve work may do it, and no Worker is ever registered under a name already in use (item 19). Archetypes are fundamental: an AI worker's archetype (and so its capabilities) is worked out in code from what was typed (`suggestArchetype` in `company/workerSuggestion.ts`, never a model), shown as "Arturo will make it a <Archetype>" with what it can do, asks first and cannot do, and may be changed only to one of `PAGE_ARCHETYPES` (every archetype but the operator); a person can approve or sign off only when "Can sign off work" is ticked, never because of what they are said to do. What a worker can do is said in one place, `capabilities/abilities.ts`: abilities group the capability catalogue into plain words, are worked out from archetypes, and never grant anything; page labels (the script's `ABILITY` data), the go-ahead card's reach and "It can / It cannot" are generated from it, never written by hand. A task that needs something no AI worker can do (a new client, an email sent, other software changed, a reminder) is refused by `findMissingAbility` inside `createTask` before routing, and on the page before any document is kept, unless the person asks for it to be written out (`--write-only`, `writeOnly`); see `THREAT_MODEL.md` item 22. What is required of an AI worker and its guardrails are told to it (`composeWorkerRules`); the page says Arturo does not enforce them. First-day setup is three steps: the business; "Add business functions" (`#welcome/build`, the page's `/next` in wizard form: Arturo's suggested business functions on cards, each leaveable out, set up by one "Set up these N business functions" click, or skipped); then the first task ("What do you need done first?"). Setting up a business function by hand is under Your business → Advanced (item 19). A hand-off's person must work at the Function's own business; `setHandOff` always checks it, so terminal and page refuse alike (item 11). Keep a go-ahead and a sign-off apart wherever they are shown: separate lists, separate counts, and buttons that say "Give the go-ahead" or "Sign off", never a plain "Approve" on a result. A result's controls are "Sign off" and "Set aside" (and "+ New task from this result" once signed off); there is no "Reject", "Reassign" or "Approved" badge for a result. The page has no auto-approve, never lets an AI helper approve or sign off, and has no switch that is not backed by a check Arturo enforces through the terminal's own function: what a helper can do is shown as read-only labels. Shortened wording must keep the one-line meaning: a sign-off "does not prove it is correct", a go-ahead "does not accept what it produces", and "finished is not the same as signed off". Rules that can be checked in code are not left to a model: an area of work can require a document and set a word limit (`business/functionChecks.ts`), which `createTask` enforces before any Task exists, so `/task create`, New task and the business function form refuse in one place (`/function update --needs-document --max-words`, `POST /api/area/checks`; item 20). Nothing about clients is specific to one trade: a business's own questions come from what it does. Page wording lives in `company/companyView.ts`; `plainInstruction` and `plainFailureReason` in `company/taskView.ts` change only what is shown, never what is recorded. The older review-link Human Task page (`POST /human-tasks/:id/complete` in `server/reviewServer.ts`) does not yet: it calls `completeHumanTaskWorkflow` directly and records an unassigned task as "signed-link holder" — a known gap to close.
- **A review link names its reviewer, bound by HMAC** (`runtime/reviewCredential.ts`), and expires
  after 24 hours. The whole credential travels in the single `token` parameter because
  `redirectTokenToCookie` exchanges that parameter for a path-scoped cookie and drops everything
  else — separate `reviewer`/`issued`/`signature` parameters would not survive to the POST. There
  is deliberately no fallback to accepting a bare bearer token: that fallback *was* the defect,
  where the decision was attributed to whatever mutable `job.worker` said at the time.
- The rules in `agents/outputBoundaries.ts` are *enforced*, not merely stated in the prompt:
  `validateWorkerOutputIntegrity` fails the Task for claimed research it did not do, invented
  author-year citations, an invented signatory or title, any link that was not in the material
  the Worker was given, and a claim to have made a record change the Task asked for
  (`RECORDS_BOUNDARY`, `findClaimedRecordChange`; an AI Worker cannot add, change or remove records) (`agents/outputProvenance.ts`; the Worker is asked once more first, and the
  second answer is held to the same check). A local model complies with a prompt
  rule intermittently — one run left `[Title]` blank as asked, the next closed the same guide
  "prepared by [Name], Human Researcher" — so anything in those boundaries that would matter to a
  reader needs a check here too, not just a sentence in the prompt.
- External side effects (HTTP, email, web search) require an explicit, authorised capability on the
  Worker/Task — nothing reaches the network implicitly.
- Almost every module has a co-located `<name>.test.ts`; new logic modules are expected to follow
  that pattern rather than being tested only through integration tests.

## Security

See `THREAT_MODEL.md` for the precise trust boundary — what the governance/approval/procedure
controls do and do not defend against (single-tenant, operator-trusted host; the residual gaps are
the unsigned policy-rule store, the locally co-located signing key, and unsandboxed in-process
workers). See `SECURITY.md` for the reporting process. Given that governance and approval
enforcement are the product's core claim, treat any finding in `runtime/approvals*`, `policy/`,
`procedures/`, `integrations/`, or `server/` as high severity by default rather than triaging it as
a routine bug. The approval trust anchor is HMAC-signed at three layers (decision, requirements
envelope, procedure) — preserve that when changing any of them.
