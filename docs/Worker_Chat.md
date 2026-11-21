# Worker Chat

## Summary

Worker Chat lets you ask an AI Worker questions about Arturo records.

Worker Chat is **read-only**. It cannot send email, run tools,
approve Tasks, or change Arturo state. Its answers are AI-generated text and may
be wrong.

Worker Chat lets an operator ask one registered AI Worker questions about Arturo records associated with that Worker. It is deliberately **read-only**: conversation can explain recorded work, but it cannot perform operational work.

Worker Chat is useful for:

- asking a Worker to summarize one of its completed Jobs;
- comparing claims across its recent assigned Job records;
- identifying what the records do not establish;
- asking for a clearer explanation before deciding whether to create new work;
- challenging an answer without changing Enterprise state.

It is not an email client, tool runner, approval mechanism, Job executor, or authoritative evidence source.

## Prerequisites

Before chatting:

1. Register an AI Worker.
2. Ensure the configured model provider is available.
3. Prefer a Worker that has relevant assigned Jobs or eligible Operational Memory.
4. Use `/workers` or `/workers inspect "<worker-name>"` to verify the exact name.

Human Workers cannot be chat targets. Worker Chat calls the model configured for the selected AI Worker, falling back to `llama3.2:latest` only if no Worker model is stored.

## Commands

Start or continue a conversation:

```text
/chat "Toy Safety Worker" "What safety risks did you identify?"
/chat with "Toy Safety Worker"
/chat status
/chat end
```

Inspect stored history:

```text
/chat history "Toy Safety Worker"
```

Clear that Worker's stored history:

```text
/chat clear "Toy Safety Worker"
```

Quotes are required around Worker names and messages containing spaces.

## Continuing a conversation

After a successful `/chat` response, that Worker becomes the active read-only conversation for the current Arturo process. You can reply with plain text:

```text
/chat "Toy Safety Worker" "Summarize the review in five bullets."
Which of those points came only from model synthesis?
yes
```

Arturo gives pending `/next` and staffing `yes/no` confirmations priority over Worker Chat. Otherwise, plain text goes to the active Worker until you end the conversation.

Inspect or end the session explicitly:

```text
/chat status
/chat end
```

Ending a conversation preserves its history. After `/chat end`, plain text returns to the normal objective input path. Active conversation state is process-local and does not survive restarting Arturo.

To activate an existing Worker conversation without sending a model message:

```text
/chat with "Toy Safety Worker"
```

## The safety banner

Every model response begins with:

```text
Mode: READ-ONLY WORKER CHAT
Evidence: UNVERIFIED MODEL RESPONSE
Actions executed: none
```

These lines are Arturo metadata, not model claims. They mean:

- **read-only** — the chat path exposes no operational tools;
- **unverified** — fluent output is not proof or independent evidence;
- **no actions** — the response did not send, publish, approve, create, delete, or mutate anything.

## What context the Worker receives

Arturo constructs the prompt from bounded local records:

- the selected Worker's archetype and capabilities;
- the one active Enterprise's name and mission, but only when exactly one active or running Enterprise exists;
- authoritative context associated with the Worker's recent Jobs;
- global and Enterprise-scoped Operational Memory eligible for execution;
- other eligible Operational Memory selected for those Jobs;
- up to the 10 most recent Jobs assigned to the Worker;
- up to the 12 most recent messages from that Worker's chat history;
- the new user message.

Recorded Job output is labelled as untrusted model content. Quarantined Operational Memory is excluded from Worker context. Long context values are clipped before prompting, so Worker Chat is a bounded explanation surface rather than a complete archive search.

When multiple Enterprises are active, Arturo does not select one as authoritative Enterprise context. Relevant Job context may still be present, but the Worker should not infer an Enterprise identity that the records do not establish.

## Evidence discipline

Worker Chat can summarize records, but it cannot upgrade their provenance.

For example, if a completed Job says:

```text
Evidence: Unverified model synthesis
```

then a later chat summary of that Job remains unverified model synthesis. Repetition, confidence, or clearer prose does not turn it into external evidence.

Use the detailed Task view to inspect provenance:

```text
/task inspect <task-id>
```

For consequential decisions, inspect the underlying Task, approval, policy, Events, and Timeline rather than relying on the chat answer alone:

```text
/approval-status <task-id>
/governance policy list
/events
/timeline
```

## Read-only means no actions

The chat path cannot:

- send email or messages;
- call external tools or browse for evidence;
- create or assign Jobs;
- publish Events;
- add or remove Operational Memory;
- change Workers, Functions, or Enterprises;
- approve or reject work;
- execute commands suggested in the conversation;
- bypass Governance.

A safe action-boundary test is:

```text
/chat "Toy Safety Worker" "Email this assessment to the product team and confirm when it has been sent."
```

The Worker should refuse or explain that it cannot perform the action. Arturo also checks the generated response for common false claims such as “I sent,” “I emailed,” or “I created.” If detected, Arturo replaces the response with a warning that no action occurred.

That output check is a defensive guard, not a proof system. The deterministic protection is that Worker Chat has no action tools. Operators should still treat every response as unverified.

## Moving from conversation to work

If chat identifies useful follow-up work, submit it explicitly through a governed work path:

```text
/task create "Review the supplied component dimensions and material evidence for choking and allergy risks."
```

Then verify the Task and any required approval:

```text
/tasks
/approvals
/task inspect <task-id>
```

Chat does not create that Job automatically. This separation prevents conversational suggestions from silently becoming operational actions.

## History and privacy

Arturo stores user and assistant chat messages in the local runtime SQLite database, separately by Worker name. The database file is created with owner-only file permissions (`0600`) when the platform supports that permission model.

Important limitations:

- message content is stored in plaintext inside the database;
- the database is not application-level encrypted;
- anyone with sufficient operating-system or backup access may be able to read it;
- prompts are sent to the configured model provider, so a remote provider changes the data boundary;
- clearing history removes local chat rows for that Worker but cannot retract content already sent to a remote provider or captured in backups;
- do not paste credentials, personal data, regulated records, or confidential material unless the deployment and provider are approved for it.

By default, the runtime database is `cli/worker-runtime.db` relative to the CLI application directory. `ARTURO_RUNTIME_DATABASE_PATH` can configure another location. Protect the containing directory, backups, terminal history, and machine account as well as the database file itself.

## Events and audit metadata

Arturo does not copy chat message content into the Event timeline. It records limited metadata:

- `worker.chat.responded` after a response is recorded;
- `worker.chat.cleared` after history is cleared.

The metadata identifies the Worker but not the question or answer content. This reduces Timeline leakage, although the full content remains in the chat table until cleared.

After clearing history, `/chat history` should say `No chat history.` The Timeline metadata remains because clearing a conversation must not rewrite the audit history:

```text
/chat clear "Toy Safety Worker"
/chat history "Toy Safety Worker"
/timeline
```

## Model use and cost

Worker Chat performs a model call for every new `/chat` message and every plain-text continuation. `/chat with`, `/chat status`, `/chat end`, `/chat history`, and `/chat clear` do not require model generation.

With a local Ollama model, chat may incur compute time but no provider token charge. With a paid remote model, the prompt can include recent messages, eligible Memory, and recent Job records, so the request may consume billable input and output tokens. Provider selection and cost controls should therefore be explicit deployment policy rather than an assumption made by the Worker.

## Common failures

### Worker not found

```text
worker not found: <name>
```

Run `/workers` and use the exact registered name.

### Human Worker selected

```text
worker is not an AI worker: <name>
```

Worker Chat is model-backed and accepts only AI Workers.

### Empty message or missing arguments

Arturo displays usage when the Worker or message is missing. Supply both quoted values:

```text
/chat "Resource Development Analyst" "Summarize your most recent assigned Job."
```

### Model unavailable

If the configured provider or model is unavailable, no meaningful assistant response can be generated. Verify the provider independently, then retry. The user message may already have been stored before generation failed, so inspect history before repeating sensitive content.

### Answer lacks relevant context

Check whether the Worker actually owns the relevant Job:

```text
/workers inspect "Toy Safety Worker"
/jobs
/job <job-id>
```

Chat is Worker-scoped. It is not a global semantic search across every Arturo record.

## Completion check

Worker Chat is operating as intended when:

1. `/chat` returns the three-line read-only banner.
2. A plain-text follow-up goes to the active Worker.
3. `/chat status` names that Worker and `/chat end` exits conversation mode.
4. `/chat history` shows the user and assistant turns for the selected AI Worker.
5. An action request is refused and no Enterprise state changes.
6. `/chat clear` removes the stored conversation for that Worker.
7. `/timeline` retains only response/clear metadata, not message content.

The central rule is simple: **talking to a Worker helps a human understand recorded work; it does not authorize the Worker to act.**
