# Local-First Model Routing

## Summary

Model routing means choosing which AI model handles a request.

Arturo can try a local model first. It can use an approved external model only
when that route is configured and authorised. External calls may share data
with another provider and may cost money.

The current call limit counts calls in one running process. It is not a money
budget or a provider bill.

Arturo can use a local Ollama model for ordinary generation and make a bounded external Gemini escalation after a deterministic validation gate repeatedly fails.

The terminal describes this boundary as **external escalation** because an
approved remote model may be covered by a provider free tier. Existing
`ARTURO_PAID_ESCALATION_*` environment-variable names remain supported for
backward compatibility. Arturo's call cap is independent of provider billing
and applies to failed requests as well as successful ones.

The feature is opt-in and fail-closed. Without explicit configuration, Arturo behaves exactly as before and makes no external escalation calls.

## Current trigger

The first supported automatic trigger is:

```text
repeated-structured-output-failure
```

It applies where Arturo requires machine-validated JSON:

- staffing plans, after the initial local response and three local corrections fail;
- Runtime signal evaluation, after two local schema failures; and
- Runtime outcome measurement, after two local schema failures.

Ordinary Worker Jobs, Worker Chat, prose generation, strategic analysis, and successful local structured responses do not automatically escalate. Arturo does not ask a paid model merely because a response seems weak, uncertain, or important; those judgments are not yet backed by a sufficiently reliable deterministic gate.

## Configuration

Keep Ollama as the normal provider and model:

```dotenv
ARTURO_LLM_PROVIDER=ollama
ARTURO_LLM_MODEL=llama3.2:latest
```

Then configure every escalation control:

```dotenv
ARTURO_LLM_ROUTING_MODE=local-first
ARTURO_PAID_ESCALATION_ENABLED=true
ARTURO_PAID_ESCALATION_MODEL=your-approved-gemini-model
ARTURO_PAID_ESCALATION_MAX_CALLS_PER_SESSION=2
GEMINI_API_KEY=
```

Choose the paid model according to your provider account, data policy, quality evaluation, availability, and budget. Arturo deliberately does not silently select one.

Restart Arturo after changing environment configuration. Never commit a populated `.env` file or API key.

When `ARTURO_LLM_ROUTING_MODE=local-first`, Arturo forces ordinary calls through Ollama using `ARTURO_LLM_MODEL`, even if a conflicting global provider or Worker model is present. This prevents a stale provider setting from silently turning the normal tier into paid remote inference. `/model-routing` shows the effective local model.

## Choosing the model with `/model`

Model choice is a single interactive command, not a per-command switch. Run
`/model`, pick a number, and the choice applies to every model-backed command
(`/next`, `/staff`, `/suggest`, guided setup, Task execution) and is
remembered across sessions.

- Models already installed locally are listed first and are free to use.
- A configured local model that is not downloaded yet is offered with an
  explicit download confirmation (model files can be several GB).
- An external paid profile is clearly marked, requires an explicit yes that
  names the cost, and every call still reserves budget from the fail-closed
  session cap. Arturo never routes to a paid model by default.

The built-in aliases are:

- `local-default`, which resolves to `ARTURO_LLM_MODEL`
- `premium-default`, when `ARTURO_PAID_ESCALATION_MODEL` is configured

Additional Ollama or Gemini aliases can be allow-listed with one JSON object:

```bash
export ARTURO_MODEL_PROFILES_JSON='{
  "local-review": {
    "provider": "ollama",
    "model": "qwen3:latest"
  },
  "premium-reasoning": {
    "provider": "gemini",
    "model": "your-approved-gemini-model"
  },
  "premium-independent-review": {
    "provider": "gemini",
    "model": "your-second-approved-gemini-model"
  }
}'
```

Examples:

```text
/model
/next "Arturo" --feedback "Use six independent capabilities."
/staff --instructions "Prefer the smallest compatible shared coverage."
```

A Gemini route is treated as external: every generation call reserves one
call from the existing hard session cap before network access. If validation
requires one repair attempt, that repair consumes another call.

## Inspecting the policy

`/models` is an alias of `/model` — both open the same chooser.

Use `/model-routing` for policy and budget detail:

```text
/model-routing
```

The output shows:

- routing mode;
- local provider and model;
- whether external escalation is enabled;
- external provider and configured model;
- maximum external calls for this process session;
- used and remaining calls;
- whether the complete configuration is ready;
- the reason configuration is fail-closed; and
- the most recent escalation reason.

It never displays the API key.

`Configuration ready: yes` means the required local configuration is present.
It does not prove that the provider currently grants quota, accepts the key, or
is available. Those conditions are checked only when Arturo makes a request.

## Hard call budget

Arturo reserves one call before making external network I/O. A failed provider request therefore still consumes a session allowance. This prevents repeated network or provider failures from bypassing the cap.

The counter resets when Arturo restarts or `/reset` is used. It is process-local, not a persistent financial ledger. Running multiple Arturo processes gives each process its own allowance.

`ARTURO_PAID_ESCALATION_MAX_CALLS_PER_SESSION` must be a non-negative integer. Missing, invalid, negative, or zero values disable external escalation.

## What this controls—and what it does not

The current implementation provides:

- local generation by default;
- an explicit external provider and model;
- one objective escalation trigger;
- pre-call session-budget reservation;
- visible usage and the last escalation reason; and
- no external call when any required setting is absent.

It does not yet provide:

- a currency budget;
- provider price cards or invoice reconciliation;
- persistent per-Job token and monetary attribution;
- a maximum output-token reservation;
- data-classification routing;
- approval before each paid call;
- comparative scoring of local and external answers;
- automatic escalation based on model confidence;
- OpenAI routing—the current paid adapter is Gemini; or
- a guarantee that an external response is correct.

The footer token count remains session observability. It is not a billing statement or spending limit.

## Privacy boundary

External escalation sends the repair prompt and relevant work context to the configured remote provider. That may include an invalid local response and validation error. Do not enable escalation for data that the provider and deployment are not authorized to receive.

The current router does not classify or redact sensitive data. Organizations should leave external escalation disabled unless their data-transfer policy permits it.

## Verification exercise

1. Start with escalation disabled.
2. Run `/model-routing`; confirm `Configuration ready: no` and a zero remaining budget.
3. Configure the five required escalation values and restart Arturo.
4. Run `/model-routing`; confirm the exact local and paid models and intended call cap.
5. Exercise only synthetic data first.
6. After any escalation, run `/model-routing` again and confirm the used count and declared reason.
7. Review provider-side usage separately; Arturo's counter is not provider reconciliation.

## Safe operating rule

Local-first routing is a cost and privacy control, not a quality guarantee. An external model remains model-generated output and must pass the same schema, evidence, Governance, approval, and human-review boundaries as any local response.

## Measuring a model on contract review

Before choosing which model reads client documents, measure it. From `cli`:

```bash
npm run eval:clauses                          # the model Arturo is set to use
npm run eval:clauses -- --model qwen2.5:14b   # a named local model
npm run eval:clauses -- --runs 3              # repeat, to see how steady it is
npm run eval:clauses -- --only held-out       # only the agreement nothing was tuned on
```

It puts every clause of three demonstration agreements (one lopsided, one
even-handed, and a mixed one held out from everything else, whose one-sided
clauses favour the customer) to the model exactly as Arturo's clause-by-clause step words it, and
scores the verdicts against a lawyer's answers in `src/evaluation/clauseAnswerKey.ts`.
It counts, separately, verdicts that are backwards (one-sided for the wrong party),
real problems missed, false alarms on fair clauses, and missing verdicts, and writes
a report under the data directory's `evaluations/` folder. Only the synthetic
agreements are sent. The answer key was written by the team and has not been
signed off by a lawyer; confirm it with one before quoting a score.

