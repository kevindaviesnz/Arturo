# Scenario harness

Drives the real product (`npm run ui`) through a scenario's commands against the
local model (Ollama/llama3.2) with isolated state, and captures a transcript.
Used to keep `cli/docs/scenarios/*.md` honest against current behaviour and to
produce the paired transcripts under `scenario_testing/`.

Plans numbered `001`–`050` pair with `cli/docs/scenarios/`. The named plans
cover the two things that need re-checking after any UX change:

- `investor-0*.plan` — the demonstrations in `docs/investor-scenarios/`, driven
  the way the scripts tell a presenter to drive them. Run these before any
  investor meeting; both scenarios 1 and 3 were once broken in a way only a
  live run exposed.
- `switch-free-*.plan`, `model-is-not-a-switch.plan` — every guided menu, the
  edit flows, the file flows, and the rule that the model can only be chosen
  with `/model`. Run these after changing any command surface.

A plan that drives `/staff` cannot assert an exact number of replies: the plan
is model-generated, so the count of proposed Workers varies. Send a few more
`yes` lines than you expect; extra replies land on "Nothing to confirm" and are
harmless.

## Run one scenario

```bash
cd cli
scenario_harness/run_scenario.sh scenario_harness/plans/002.plan s002 \
  "../scenario_testing/Scenario 002 — Retail feature assessment.txt"
scenario_harness/txt_to_md.sh \
  "../scenario_testing/Scenario 002 — Retail feature assessment.txt" \
  "../scenario_testing/Scenario 002 — Retail feature assessment.md" \
  "Scenario 002 — Retail feature assessment"
```

`run_scenario.sh` exports the test-only signing secrets and an isolated
`ARTURO_DATA_DIRECTORY`/`ARTURO_RUNTIME_DATABASE_PATH` under `cli/.data/<subdir>`
(gitignored), strips ANSI + spinner frames, and writes the transcript.

## Plan file directives (`scenario_driver.exp`)

| Line | Effect |
|------|--------|
| `/command ...` | sent to the UI verbatim; may contain `{{VAR}}` |
| `yes` / `1` / free text | sent as a reply (menu answers, `/reset` confirmation) |
| `@cap VAR {regex}` | after the **next** sent command, capture regex group 1 into `VAR` |
| `@staff /staff ...` | send the staff command, then answer `yes` once per proposed Worker |
| `@wait N` | sleep N seconds so the runtime can execute queued model work |
| `@timeout N` | per-command expect timeout for following commands |
| `@note text` / `# comment` | annotation / ignored |

Uncaptured `{{VAR}}` renders as the doc-style placeholder (`TASK_ID` → `<task-id>`),
so a broken step reads exactly like following the doc literally.

## The canonical "work runs to completion" flow

Current product requires an Enterprise that is **set up and staffed** before it
will create or run work. The validated happy path is:

```text
/enterprise create "<Co>" --mission "..."
/function create "<Function>" --enterprise "<Co>" --objective "..."
/add-human-worker "<Approver>" --archetype guardian --availability available
/function start "<Function>"
/staff --enterprise "<Co>"            # answer yes per proposed Worker
/task create "<bounded instruction>"  # routes to a staffed Worker
/approve <task-id>                     # attributed to the registered approver
# wait, then:
/task inspect <task-id>                # Completed · Evidence: Unverified model synthesis
```

Notes:
- `/task create` fails with **"No Functions are available"** if no Function exists,
  and **"has no Worker assigned … /staff does that"** if the Function is unstaffed.
- `/ask` requires Enterprise + Function + Worker (the "ready for work" gate).
- `/staff` adds a human-approval rule for sensitive work, so review/analysis
  tasks land in **Awaiting approval** until `/approve`.
- `/approve` needs a registered approver (`/add-human-worker`, approve role);
  the operator at the keyboard is not assumed to be an accountable signer.

## Running a plan live, in-process (`npm run ui bot`)

The expect driver above runs headless against a pty and produces a transcript
afterwards. Bot mode replays the **same plan files** in the ordinary interface,
live, so the run can be watched:

```bash
npm run ui bot            # 001
npm run ui bot 025        # any plan in plans/
npm run ui:bot:isolated   # against a throwaway data directory
npm run ui bot -- --pace 3000 --approve --yes
npm run ui bot -- --type-pace 0   # paste each line instead of typing it
```

Each line is performed in three beats, each varied by ±40% so the rhythm is not
metronomic:

| Beat | Flag | Default |
|------|------|---------|
| thinking, before it starts typing | `--pace` | 2200ms base, longer after a long result |
| per keystroke | `--type-pace` | 120ms (~100wpm) |
| checking it over, before Return | — | 8 keystrokes |

Measured on a pty at the defaults: 2.4s thinking, 6.5s to type 55 characters,
0.8s before it ran. Scenario 001's task instruction is about 330 characters, so
it is on screen for roughly 40 seconds. `--type-pace 0` drops the performance
and pastes each line instead.

The thinking beat scales with how much Arturo just printed — 2.5s after
`/functions`, 6.2s after `/timeline`, capped at 4× the base — so a long result
gets time to be read and a short one does not waste it.

**Space pauses and restarts it.** Any key pauses; space, or Enter on an empty
line, hands it back; Ctrl+C stops it. Pausing during any beat abandons the
half-typed line and retypes it from the start when you hand the terminal back,
so a partial command is never submitted. (Space only resumes on an empty input
line — once you have started typing, a space is a space.)

It is not a replacement for the expect harness — that tests a fresh process over
a real pty, which bot mode cannot. Differences worth knowing:

| | expect driver | bot mode |
|---|---|---|
| `@cap` | matched against pty output, ANSI and spinner frames included | matched against the rendered entries, colour stripped |
| `@staff` | send a few more `yes` lines than you expect | answers while the review is actually open, so the count is a fact |
| `@timeout` | per-command expect timeout | no effect — each command is awaited; announced once per run |
| unknown `@directive` | may pass silently | shown as an entry, and `botPlanSource.test.ts` fails |

**Most plans open with `/reset`.** Bot mode stops before the first line and names
`ui:bot:isolated`; `--yes` is the only way past it. Do not point it at an
installation whose state matters.

`ui:bot:isolated` passes `--yes` itself, so it just runs — it resets `.data/bot`,
which exists to be reset. Warning about that would be recommending the command
you already typed.

`--approve` lets the run sign off governed work as `Arturo Bot (automated, not a
person)`. That name is inside the signed decision and marked as bot-signed
wherever an approver is shown, and `bot.*` events go to `/timeline`. It is not
human review — see `THREAT_MODEL.md` item 7.

`npm run ui bot auto "<goal>"` drops the plan and lets the model chosen by
`/model` pick each line. It is a demonstration of the product driving itself,
not a benchmark: a small local model proposes commands that do not exist and
prose instead of commands, and you will watch it be refused and recover.
Refusals are shown. It never runs `/reset` or a removal, whatever it proposes.
