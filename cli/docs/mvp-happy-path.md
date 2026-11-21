# Arturo MVP happy path

This walkthrough exercises the current native terminal from organisational design through governed execution and accountable human work.

## 1. Install and configure

From `cli/`:

```bash
npm install
npm run build
npm run test:run
```

Create an untracked `.env` containing separate random values of at least 32 characters:

```dotenv
APPROVAL_SIGNING_SECRET=<random non-placeholder value>
HUMAN_TASK_TOKEN_SECRET=<different random non-placeholder value>
RUNTIME_REPLAY_ATTESTATION_SECRET=<different random non-placeholder value>
API_SECRET_ENCRYPTION_KEY=<different random non-placeholder value>
ARTURO_HTTP_ALLOWED_HOSTS=
```

An empty HTTP allowlist denies outbound Worker HTTP access. Do not commit secrets.
For server-style use, the approval signing key may instead be supplied with
`APPROVAL_SIGNING_SECRET_FILE`; see `configuration.md`.

Start Arturo:

```bash
npm run ui
```

## 2. Create the organisation

`/reset` is destructive; use it only when clearing all current local Arturo state is intended.

```text
/reset
/enterprise create "Koru Toys" --mission "Help children learn safely through imaginative play."
/function create "Product Evaluation" --enterprise "Koru Toys" --objective "Assess proposed learning products against supplied educational, accessibility, and safety evidence."
/function update "Product Evaluation" --description "Coordinates bounded product assessments and accountable release decisions without treating model output as verified evidence."
/enterprise inspect "Koru Toys"
/function inspect "Product Evaluation"
```

## 3. Add execution capacity

```text
/add-ai-worker "Product Analysis Worker" --archetype analyst
/add-human-worker "Release Manager" --archetype guardian --availability available
/workers
/workers inspect "Product Analysis Worker"
/function start "Product Evaluation"
/function inspect "Product Evaluation"
```

## 4. Add deterministic Governance

```text
/governance policy add "Product analysis requires release review" --effect require-approval --capability "analysis"
/governance policy inspect "Product analysis requires release review"
```

## 5. Create and approve bounded work

```text
/task create "Using synthetic assumptions only, identify the evidence required before a children's learning product can proceed to prototyping. Separate educational, accessibility, safety, privacy, and manufacturing questions."
/tasks
/approvals
/approval-status <job-id>
/approve <job-id>
```

Replace `<job-id>` with Arturo's ID. Approval authorises execution; it does not validate the eventual answer.

After execution:

```text
/tasks
/task inspect <task-id>
/timeline
```

## 6. Record an accountable human decision

```text
/create-human-task "Decide prototyping readiness" "Review the synthetic assessment and record whether evidence is sufficient for a prototype decision."
/human-tasks
/complete-human-task <human-task-id> "Return for revision; component dimensions, materials, age range, cleaning requirements, and disability-informed review are missing." --as "Release Manager"
/human-task <human-task-id>
```

## 7. Inspect operating state

```text
/events
/memory
/health "Product Evaluation"
/function inspect "Product Evaluation"
/overview
```

Health reports Arturo's operational evidence, not external business truth. Human-entered Memory is an assertion, and unverified model synthesis must remain excluded from autonomous learning.

## Completion check

The exercise is complete when the Function, policy decision, approval, Human Task attribution, Events, and Timeline are traceable. No external publication, email, product release, or evidence verification has occurred.
