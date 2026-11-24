# Arturo threat model (pre-release)

This document states precisely what Arturo's governance and approval controls do and
do not defend against in the current pre-release build. It exists so that evaluators and
technical reviewers can judge the security claims against the implementation rather than
the marketing language. Where the code and this document disagree, treat the code as
authoritative and report the discrepancy.

## Deployment assumption

Arturo currently runs as a **single-tenant, single-operator process on a trusted host**.
Persistence is a local SQLite database and local data files. The operator, and any
process running as the operator, is inside the trust boundary. The company page and the
HTTP servers that served it (`companyServer`, `officeServer`) are gone (item 25); the
host, the terminal and the data directory stay the operator's.

## What the controls defend against

- **Model-driven bypass.** Governance (allow / deny / require-approval) is deterministic
  code, not a model decision (`cli/src/runtime/jobGovernance.ts`, `cli/src/policy/`). A
  model cannot talk its way past a policy; consequential capabilities with no matching
  rule fail closed to human review.
- **Tampering with stored approval *decisions*.** Each approval decision is HMAC-signed
  and bound to its job id (`cli/src/runtime/approvalDecisionSigning.ts`); a decision
  cannot be forged, transplanted to another job, or altered without detection, given the
  signing key is not known to the attacker.
- **Forging approval from nothing.** The approval gate never trusts the stored `status`
  field; it recomputes from signature-verified decisions and requires at least one
  authentic approval (`cli/src/runtime/approvalGate.ts`).
- **Lowering the approval bar.** The approval *requirements* (count, policy, governing
  rule) are themselves HMAC-signed into the chain
  (`cli/src/runtime/approvalRequirementsSigning.ts`); editing `requiredApprovals` or the
  policy without the key is detected and fails closed.
- **Tampering with stored Governance policy rules after integrity migration.** Policy
  rows are HMAC-signed over their rule content and evaluation position
  (`cli/src/policy/policyRuleSigning.ts`, `cli/src/storage/policyRepository.ts`). Manual
  database edits that change a rule from `deny` to `allow`, alter its match, or reorder
  rules are detected and policy loading fails closed, assuming the signing key and
  migration marker remain outside the attacker's control.
- **Accidental secret provisioning on a server.** Networked servers require either an
  externally supplied `APPROVAL_SIGNING_SECRET` or a validated
  `APPROVAL_SIGNING_SECRET_FILE` and fail fast rather than auto-generating one next to
  the data they protect (`cli/src/runtime/runtimeSecrets.ts`).
- **Accidental unsandboxed host filesystem/process execution.** AI Worker Tasks that
  request `file-read`, `file-write`, `shell-read`, or `shell-execute` fail before model
  execution unless the operator explicitly opts into
  `ARTURO_WORKER_SANDBOX_MODE=trusted-host-dev` for trusted local development
  (`cli/src/runtime/workerSandboxPolicy.ts`, `cli/src/runtime/workerRuntime.ts`).
- **Instruction injection via the task queue.** A Task carries only a lean Procedure
  reference (`proc-<id>@<version>`), never inline instructions. At execution the Worker
  resolves the Procedure from the registry, verifies its HMAC integrity signature, and
  refuses to run unless the Worker holds every capability the Procedure declares
  (`cli/src/procedures/`). A poisoned task queue can therefore at most *reference* a
  Procedure; it cannot smuggle executable instructions, and a Procedure demanding
  unauthorized capabilities fails closed.

## What the controls do NOT defend against (current limitations)

These are the honest boundaries. They are acceptable for single-operator pre-release
evaluation; they are **not** yet sufficient for a hostile-in-process or multi-tenant
deployment, and the product should not be represented as such.

1. **An attacker who can write the local data directory.** The signing key, in local
   (non-networked) mode, is auto-provisioned into that same directory. An attacker with
   local file-write can read the key and re-sign anything. A valid external environment
   secret or `APPROVAL_SIGNING_SECRET_FILE` outside `ARTURO_DATA_DIRECTORY` raises this
   bar; local auto-provisioning does not. The off-terminal sign-off listener will not
   start on that auto-provisioned local key; it requires a networked
   `APPROVAL_SIGNING_SECRET` (or `APPROVAL_SIGNING_SECRET_FILE` outside the data
   directory). An attacker who can write the location of that secret can still re-sign
   approvals and off-terminal events.
2. **Policy-rule integrity still shares local-key and migration caveats.** Governance
   rules are now HMAC-signed, including their evaluation order. That closes the previous
   "edit the SQLite row from deny to allow" gap for an attacker who can alter only the
   database. It does **not** defend against an attacker who can read the local signing key,
   replace both the database and the local policy-integrity migration marker, or run inside
   the Arturo process. The first launch against an unsigned pre-signature policy store
   signs the rules that are present at that moment, so an operator upgrading a database
   should inspect policies first if local storage may already have been modified by
   untrusted code.
3. **No production OS/container Worker sandbox yet.** Arturo now blocks AI Tasks that
   request host filesystem/process capabilities by default. That is an execution guard,
   not a real sandbox. The `trusted-host-dev` override deliberately moves that risk back
   inside the trusted-host boundary, and any malicious code already running inside the
   Arturo process can still reach process memory, local services, and locally readable
   files.
4. **Human identity depends on trusted provisioning.** With the company page gone (item 25)
   there is no public HTTP account or review surface, and no federated identity provider.
   People and the sign-off right are still created at the terminal by the owner, after the
   owner has independently verified the person. Off-terminal sign-off and set-aside always
   require a device check (`userVerification` required). Enrolment is started only by the
   owner, as a 30-minute single-use link to a person who already has an account, a verified
   email address, and the sign-off right; after they enrol there is a 12-hour wait, and the
   owner confirms at the terminal only with a typed confirmation that names them, not only
   "yes", after checking with them through another channel. The public-key hash is written
   into the hash-chained authority log. Possession of a link is not enough: links are
   stored only as a hash, are bound to one result, one person and the content hash, and are
   revoked on sign-off, set-aside, a role change, loss of the sign-off right, or a change
   to the result. A sign-off email is not sent until the address has been verified with a
   one-time code and a usable device check is in place. Naming stand-ins, starting
   enrolment, confirming a credential, and switching the path on stay at the terminal.
   HMACs attest runtime records, not legal signatures or proof against a compromised host.

5. **Loopback network surface.** Agent-supplied capability URLs may still reach
   `http://localhost` services. The off-terminal sign-off listener binds only `127.0.0.1`
   and serves only pairing and the sign-off or set-aside of one result. Behind a tunnel
   every request arrives from loopback, so the socket address is used only to reject
   anything that is not loopback; it is never treated as proof that the person is at the
   host computer. Origin must match the `https://` public hostname. TLS must end at the
   host computer; a hosted relay that can decrypt the draft is not used. Rate limits apply
   globally and per token. Do not run Arturo on a shared or multi-user host.

6. **Multi-tenant isolation, tamper-proof audit, backup/retention/recovery.** Not provided.
   "Persistent records" are durable, not compliance-grade tamper-evident audit.
7. **Bot mode can satisfy the human-approval gate.** `npm run ui bot -- --approve`
   registers an automated operator (`cli/src/bot/botOperator.ts`) as a `guardian` Human
   and signs governed work under it. The approval chain then proves that *a script*
   authorised the work, which is strictly weaker than what the gate exists to prove. No
   signing or entitlement code is relaxed to allow this — the bot is exactly as entitled
   as any registered guardian — and the weakening is made visible four ways: the operator
   name says "not a person" and travels inside the signed decision; every bot-submitted
   `/approve`/`/reject` carries an explicit `--as` (without it,
   `resolveApprovalCommandIdentity` would auto-select the sole eligible human and record
   the decision under a real person's name); `/approvals` and the approval chain mark the
   decision as bot-signed; and `bot.session_started`/`bot.input`/`bot.session_finished`
   are written to the timeline. It is off by default and requires `--approve`. Treat any
   installation that has run bot mode with `--approve` as having unverified approvals in
   its history.

   A run *without* `--approve` refuses `/approve` and `/reject` outright, whether the line
   came from a plan or a model, and says what it would otherwise have recorded. That
   refusal is the load-bearing half: it was originally applied in autonomous mode only,
   and because scenario 001 contains `/approve`, a scripted run without `--approve` typed
   it bare and produced a signed decision reading `Approved by Publication Reviewer` — a
   script recorded under a real person's name — while telling the operator nothing had
   been approved. If either the refusal or the `--as` attribution is ever made conditional
   on anything else, that failure returns.
8. **Procedure and policy integrity share the local-key caveat.** Procedure and policy
   signatures use the same runtime signing key as approvals, so item 1 applies: an attacker
   who can read a local co-located key can forge a Procedure or policy just as they can
   forge an approval. The Procedure registry is also currently in-memory (no cross-restart
   persistence) and authored programmatically; a persistent, integrity-checked,
   command-authored registry and deterministic step execution are follow-ups.
9. **A watched folder trusts whatever can write to it.** `/artefact watch` registers each
   new file in a folder as an Artefact and creates a Task for it, with no person looking at
   the file first. Arturo only reads: it never executes a file, refuses symbolic links,
   reads only regular `.txt`/`.md`/`.csv`/`.json`/`.docx` files directly in the folder,
   caps size and files per look, and will not watch the home folder or its own data
   directory. The Task is created by the ordinary command, so routing and Governance apply
   as usual, and the file's text reaches the Worker as untrusted data. What this does not
   stop: anything able to write to the folder can queue model work and put text in front of
   a Worker, and a file swapped for a link between the check and the read is followed (the
   check and the read are separate system calls). Each Artefact records that it was taken
   in automatically and names the person who set the watch up, not a person who reviewed it.
10. **The company overview accepts one write: a result signed off from the page.**
   `POST /api/task/signoff` is served on 127.0.0.1 only and goes through `signOffTaskResult`,
   the function behind `/task signoff`, so who may sign and every refusal are the same. It
   is refused unless it carries this page's own Origin, JSON, and (when sent) a same-origin
   `Sec-Fetch-Site`, which stops another website open in the same browser from signing in
   the owner's name. It does not stop another program on the same machine, which can send
   those headers; on this single-tenant, operator-trusted host that is the same exposure as
   that program typing at the terminal or writing the data directory (item 1). The person
   signing is named on the page, not authenticated, exactly as at the terminal. The page used
   to say so in its menu ("Anyone using this computer can make decisions on these pages"); that
   line was removed for brevity at the owner's request, and the exposure is unchanged.
   The company page that served this endpoint is gone (item 25), so the endpoint is no longer exposed.

11. **A sign-off can now create work for a person.** When a Function has a hand-off
   (`/function update --hand-off-to --hand-off-task`), signing one of its results off creates
   a Human Task for the named person, from inside `signOffTaskResult`, so the terminal and
   the page behave identically. It never fires without a sign-off that verifies, and each
   result is handed over at most once (`hand_off_deliveries` is claimed before the Human
   Task is created). It creates a Human Task and nothing else; it reaches nothing outside
   Arturo. The consequence of a forged sign-off (item 1, item 10) is therefore one extra
   Human Task on a person's list, which they can see came from that sign-off. The person must
   work at the Function's own business: `refuseHandOff` checks it whenever it is given the
   business, and `setHandOff` always gives it, so the terminal cannot send
   one business's signed-off results to another business's person (until this check, the
   terminal's `/function update --hand-off-to` accepted anyone registered anywhere). The
   terminal checks this before it changes anything else the same command asked for.

12. **A person's work page acts for the person its link names.** `/human-tasks link "<person>"`
   issues an HMAC credential binding a registered person's name (domain-separated from review
   and Human Task links), valid for 7 days and void once the person is removed. Opening the
   link exchanges it for an `HttpOnly`, `SameSite=Strict` cookie and drops it from the
   address. The page shows only Human Tasks assigned to that person and completes them through
   `completeHumanTaskAs`, the function behind `/complete-human-task`, as that person; the
   person comes from the credential, never from the request. Completion is accepted only as a
   same-origin JSON POST. An uploaded file is refused unless its ending is one of a short list
   and its first bytes match that ending, it is at most 10 MB, and it is stored under the data
   directory with a sanitised name, recorded as an Artefact version with its SHA-256. Arturo
   never opens, runs or serves it back. The link does not authenticate its holder: whoever
   has it can act as that person, as with a review link. The page is served by the overview on
   127.0.0.1, so today it only works on the owner's own computer, where the overview itself is
   unauthenticated; opening work pages to other computers needs real sign-in for both first.

13. **A result can be set aside from the overview as well as signed off.** `POST
   /api/task/setaside` takes the same guards as the sign-off route (item 10) and calls
   `setAsideTaskResult`, the function behind `/task setaside`, and nothing else. Who may set a
   result aside is decided exactly as for a sign-off. The record is HMAC-signed with its own
   purpose (`result-set-aside`), so it can never verify as a sign-off or an approval, and it is
   bound to the result's SHA-256 and the person's reason. A set-aside result cannot then be
   signed off or handed on. The bot attributes `/task setaside` lines to itself exactly as it
   does sign-offs (item 7).

14. **Held work can be approved or rejected from the overview.** `POST /api/task/approve` and
   `POST /api/task/reject` take the same guards as the sign-off route (item 10) and call
   `decideApproval` and `decideRejection`, the functions the terminal's `/approve` and
   `/reject` now print from, so who may decide, every refusal, the signed chain decision,
   the release, the Artefact decisions and the events are identical. The page always names
   the person; the terminal's choice of a sole eligible approver is never made from the page.
   This surface has the terminal's trust and no more: it does not authenticate who clicks,
   unlike the review server, which requires a signed-in User bound to the Human Worker.
   Approving releases work to run, a larger act than a sign-off, so before network access
   or a shared computer this surface needs real sign-in too. The page says in plain words
   what the chosen Worker could do outside Arturo, and says it does not know when no Worker
   has been chosen yet rather than implying it is confined.

15. **Work can be started from the overview.** `POST /api/task/create` takes the same
   origin, fetch-site and JSON guards as the decision routes (item 10), with the work page's
   larger body limit (item 12) so a document can come with it. It calls `createTask`, the
   function `/task create` prints from, with the arguments the terminal would pass, so routing,
   the staffed Worker, capabilities, approval holds and events are identical. Before anything
   is written it checks the company, that the area of work belongs to it, that the person
   asking is a Human Worker of that company (`--asked-by` makes the same check at the
   terminal), the instruction (non-empty, at most 4,000 characters, not starting with a dash
   that `/task create` would read as an option) and the document: only `.docx`, `.txt`, `.md`
   and `.csv`, which a Worker can read, through the same content checks as the work page. The
   document is kept as a version, never served back, and given to the Worker under the
   supplied-documents banner that marks it as data. If `createTask` refuses after the document
   was kept, the reply names the kept version. Starting work cannot release it: a held Task
   still waits for its approver. Like the decision routes, this does not authenticate who is at
   the keyboard; "asked for by" is the name chosen, not a proven identity. The form starts on
   someone at the business who can sign off work, or on whoever this browser chose last (kept
   in the browser's own storage, nowhere else). That only saves picking from a list. It
   decides nothing, and it is shown on the form where it can be changed.

16. **Failed work can be tried again from the overview.** `POST /api/task/retry` takes the same
   guards as the decision routes (item 10). It builds the plan with `planTaskRetry`, which
   `/task retry` also uses, and creates the new Task through `createTask` (item 15), so the
   retry is routed and governed afresh and no approval carries over. The page also refuses
   work already tried again (a later Task with the same instruction in the same area that has
   not failed), so a double click cannot start it twice. The pages show failure reasons in
   plain words; the recorded error is unchanged and shown as technical detail.

17. **A business is set up at the terminal, and clients can be taken down by an assistant.** The company page and its `/api/setup` and `/api/assistant/*` routes are gone (item 25). The same functions are used from the terminal:
   `POST /api/setup` calls `setUpBusiness` (behind `/setup`) and is offered only while no business
   exists. Clients are added by talking to an assistant (`POST /api/assistant/talk`, behind `/talk`),
   and no assistant exists until a named person agrees to the one Arturo proposes
   (`POST /api/assistant/create`, behind `/assistant create`). All three take the decision routes'
   guards (item 10); the two that wait on a model take a larger body. The model has two jobs only:
   proposing the business's own questions for a new client (shown to the person before they agree;
   the base questions never depend on it), and picking what the person said into those questions.
   Its answer is parsed against the known keys and anything else is dropped. Which questions to
   ask, the read-back, recognising "yes" and "cancel", the lookalike check and the save are decided
   without a model: nothing is entered until the person confirms Arturo's own read-back, and the
   save goes through `addClient`, as `/client add` does. A person's pasted text is passed to the
   model marked as information about the client, not instructions; the model can still mishear or
   be misled, which is what the read-back is for. The assistant is an "assistant" AI Worker that can
   message the business's own people through Arturo's governed contact capability; it cannot email
   or phone clients or search the web. Client details are personal data in the local database; work
   for a client quotes that one client's record as data, and `--client` refuses another business's
   client. "Added by" and the person talking are the names chosen, not proven identities.
   The lookalike check (`findClientLookalikes`, via `addClient`) compares a new client's name,
   email and phone with Arturo's own list. It is duplicate detection, **not a conflict check**:
   "other parties" is a question a model proposed, kept as free text and compared with nothing.
   When a business's questions mention a conflict check, the read-back says Arturo does not run
   one. The reply to "someone new, or the same person?" is decided by `lookalikeAnswer`, which
   takes a reply that says both, or neither, as no answer; before this, "It is the same person, do
   not add them" and "yes, that is the same person" both saved the client as new, with
   `--confirm-new`, in the person's name. Every message names the list ("Arturo's list of
   clients"), so nobody takes it to have reached other software.
   New task's box (`POST /api/request`, `requestFromPage`) recognises a request to add a new
   client by fixed rules (`clients/clientRequests.ts`, no model), only when nobody was chosen and
   nothing is attached, and then starts and writes nothing: the page asks first. Its "Check details
   and add" opens the same conversation, fresh (an unfinished one is set aside rather than merged,
   so one client's details never carry over to another), and the save still waits for the read-back
   and the person's yes. A wrong guess costs one question, never a record; "No, I want something
   written" sends it on as a task (`writeOnly`). The worker made for new clients is called
   "Clients AI worker", not an assistant.
   When new clients are handed to a person (`/assistant assign`), anyone else's request becomes a
   Human Task for them and no model is called; their own conversation saves through the same
   read-back and `addClient`, and closes the oldest such Task through `completeHumanTaskAs`
   (item 12).

18. **Passing work on, and the finished-work list, are terminal actions.** The company
    overview is gone (item 25), so a finished result is not passed on from a page. At the
    terminal, **+ New task from this result** is the same as `createTask` or
    `createHumanTaskFromArgs` with `--follows`: a Human Task is created only through
    `createHumanTaskFromArgs` (the function `/create-human-task` prints from, with
    `--assign-to`, `--follows` and `--artefact`), and an AI task through `createTask` with
    `--follows`. `startWorkFromPage` is no longer a network route; the same refusals run
    before anything is written: a result of another business, one that has not finished,
    one that was set aside, and one written by an AI model that nobody has signed off
    (`refuseUnacceptedHandOver`; item 11 states why); `createHumanTaskFromArgs` refuses
    the last again itself. The person must be someone who can be passed work at this
    business (`peopleWhoCanBePassedWork`). The off-terminal path cannot pass work on,
    start work, or give a go-ahead; it only signs off or sets aside one already-finished
    result, always with a device check, through `signOffTaskResult` and
    `setAsideTaskResult`. "Asked by" and the person given the task are names chosen at
    the terminal, which trusts whoever can type there (item 1), not proven identities.
    Finished work shown in the CLI is a read: it shows what was asked, who did it,
    whether anyone signed it off, and who it was passed to, from the same sign-off and
    Human Task records; it records and decides nothing.
    `createTask` with `--follows` used to accept an AI result nobody had signed off, and a
    set-aside one, so work typed at the terminal went from one AI Worker to another
    unchecked (a comment called it running "freely"). It now refuses both before anything
    is queued, with one exception: a result Arturo itself is passing on to be checked,
    under a business function's rule or a task's choice (item 23), which it may create
    once, under a claim only that delivery holds. The earlier result a Task works from is
    given to its Worker marked off as data, between fixed start and end lines
    (`taskExecutor.ts`), with any copy of the end line inside the result rewritten, so
    text in a draft cannot close the fence and speak as the instruction. A Function's
    automatic follow-on (`--follow-on on`, off by default) still sends unsigned AI work
    to another Task, as a model decides; it is now checked before it is queued, like any
    new task, against what the Function's AI workers can do and the Function's own checks
    (`refuseFollowUpWork`), and is refused otherwise.

19. **Workers and business functions are set up at the terminal.** The company page and its `/api/person/add`, `/api/worker/add` and `/api/area/create` routes are gone (item 25). The same functions are used from the terminal: `POST /api/person/add`,
    `POST /api/worker/add` and `POST /api/area/create` (`company/areaSetup.ts`) take the decision
    routes' guards (item 10). Nothing is saved on a model's say-so: the form's own fields become
    the same calls the terminal makes. A person is registered by `registerWorkerFromArgs` (`/worker add`), an area by
    `createEnterpriseFunction` (`/function create`), its helper by `registerWorkerFromArgs`
    again, who approves its work by `applyStaffingPlan` (the function `/staff` applies a plan
    with, which also writes the approval rule and starts the Function), and where results go by
    `setHandOff` (`/function update --hand-off-to`; item 11). Every check the page can make runs
    before the first write, so a refused form creates nothing. Two refusals matter for
    authority: only someone who can approve work may add a person or set up an area, because
    both decide who may sign things off; and a name already used by any Worker is refused,
    because registering a Worker replaces any Worker of the same name. An AI worker's archetype
    (and so its capabilities) is worked out in code from fixed words in what was typed
    (`suggestArchetype`, `company/workerSuggestion.ts`), shown with what it can do, asks first and
    cannot do, and may be changed by the person, but only to one of `PAGE_ARCHETYPES`: every
    archetype except the operator, whose Office and tool capabilities are given at the terminal.
    None of those can change records or send email, but all except the converter, observer and
    simulator hold `human-contact`, through which Arturo emails a registered person a review
    request (item 22); this item used to say they could not act outside Arturo. A person's kind is a
    label, except that the two archetypes that can approve are never inferred: a person can sign
    off work only when "Can sign off work" is ticked (`POST /api/worker/add` accepts only a real
    `true`). An AI worker added on its own is staffed through `applyStaffingPlan` with no approver
    changes, so it cannot alter who signs off its business function's work. What is required of a
    worker and its guardrails are stored as the Worker's refinement. They are instructions to a model, not enforced by Arturo:
    a model can ignore them, and what stands between a broken rule and a person is the sign-off
    (item 11). The page says this beside the rules. "Who is setting this up" is a name chosen on
    a page that trusts whoever is at the computer (item 10), not a proven identity. First-day
    setup is three steps:
    1. the business;
    2. **Add business functions**, Arturo's suggestions for the whole business (below);
    3. the first task.

    Step 2 runs only when the person asks ("Suggest my business functions"), and can be skipped.
    Its one button, "Set up these N business functions", names how many will be set up. It sets
    up each card not left out, one by one, through the same route as a card's own click. There
    is no wizard form for a business function or a worker. A first task that no worker fits
    leads to Arturo's suggestion below, like any other. A business function and its AI worker are set up through one
    route, `POST /api/area/create`. That holds whether they come from the suggestion, from the
    full form opened from it ("Create a custom worker instead"), or from the form under Your
    business → Advanced. The client desk (item 17) is the exception and keeps its own route.

    **Arturo suggests a worker when a task needs one; a person confirms it.** With nobody
    chosen, New task uses a business function only when `/task create`'s measure picks it clearly
    *and* the words agree (`pageFit` in `company/newWork.ts`: the request names it, or shares two
    words with it in any form, or one word and the kind of work). Otherwise nothing is started.
    First, fixed rules (no model) offer the business functions that may fit, at most three:
    those tied at the top, one that fits by the kind of work alone, and those whose names share a
    word stem with the task (`business/functionNames.ts`). The person picks one ("Use Lease
    reviews") or says no. Only then may a model be asked, through `POST /api/worker/suggest`,
    for a business function name and one sentence each of what is required and the guardrails.
    The task goes to it between markers, marked as data and not instructions. Its answer is
    parsed as JSON, cleaned and clipped, and a job title ("Personal Assistant") is not taken as
    a name. A suggested name that looks like a business function the business already has is
    offered as that function, never numbered into a second one. The worker's name ("<business
    function> AI worker") and the "It can" / "It cannot" lines are fixed in code. The **kind of
    worker (archetype) comes only from the person's own words**, the task, by `suggestArchetype`.
    The model's name for the work is not used, because a model saying "Research…" would
    otherwise make a worker that searches the web. A business may ask for five suggestions a
    minute, and the route writes nothing.

    The card shows everything the worker would be set up with before it exists:
    - the business function's name;
    - the kind of worker, with what it can do, asks first and cannot do;
    - the AI's two sentences, each editable or left out, with "Arturo does not enforce them";
    - who signs off its work.

    Nothing is saved until someone clicks "Create worker and start task" (or "Create and start
    task" on the full form). Only someone who can sign off work can do it, and the click is
    recorded under the name of the person who asked, never an approver the page picked for them.
    Someone who cannot sign off is told who can and is shown no suggestion, so no model is asked.
    Who signs off is the only approver when there is one, and otherwise the person asking unless
    they change it. That is still a page-chosen name, not a proven identity (item 7).

    `createEnterpriseFunction` refuses a name with the same words as an existing business
    function ("Reviewing leases" when there is "Lease reviews"). This applies at the terminal
    and on the page alike, and the page never numbers a function name. The page may set up at
    most 30 business functions per business.

    Each business function set up from the page keeps one record of where it came from
    (`business/functionOrigin.ts`, the `function_origins` table):
    - the way it was set up: suggestion, custom or form;
    - the task it was for, as Arturo kept it with the suggestion rather than as the page sent it;
    - the model's suggestion as it came back, beside what was saved;
    - how the archetype was chosen;
    - who set it up.

    The task page says "Arturo set up X for this … Confirmed by …". Your business shows the same
    in a few words. The record is removed with the function. Suggestions are kept only in the
    page's process, so one accepted after Arturo restarted is recorded without what the model
    said. A misled model can at
    worst propose a misleading name or instruction. The person sees it before anything is
    created, and it is bounded by the archetype chosen from their own words and by the sign-off.
    The task itself still goes through `createTask`, and no go-ahead or sign-off carries over.
    The word rules are English only and can be wrong both ways: a task that fits may be asked
    about, and one that does not may be offered. Either way a person decides, and nothing is
    created or routed by a near match alone.

    **Arturo can also suggest business functions for the whole business** (`POST
    /api/business/suggest`, `company/businessSuggestion.ts`). This is the page's `/next`. The
    recommendations come from `createNextGuidanceResultForEnterprise`, the function behind
    `/next`, so the prompt, model choice, validation and repair are the terminal's own. The route
    writes nothing, and fixed rules shape what is shown:
    - a job title is left out, and so is a name the business already has in other words;
    - at most five are shown;
    - it shares the five-a-minute limit with suggestions for a task.

    Each suggestion is a card with its name, what it keeps doing, example tasks, its AI worker and
    who signs off. Each is set up only by its own click, or by "Set up all", which sets up each
    card not skipped, one by one. Both go through `POST /api/area/create`, recorded as
    `via: "business"` with what the model suggested.

    Here the kind of worker is worked out in code from the business function's name and what it
    keeps doing. Both of those were written by the model, so the model can steer the kind by its
    choice of words. That is why the card shows the kind, with what it can do (for example
    "Search the web"), before anything is set up, and the person can change the kind or the name.

    Nothing else the model wrote is given to the worker as an instruction: Required and
    Guardrails stay empty until the person adds them. What it keeps doing becomes the business
    function's objective, as `/next` makes it at the terminal.

    A business function with no AI worker (one made at the terminal, or left half-made) shows
    "Set up its AI worker" on Your business. That opens the Add a worker form for it, through
    `POST /api/worker/add` (`addWorkerFromPage`). The page has no form of `/staff`'s model plan:
    no model chooses workers or their kinds on the page, and setting up a worker never changes
    who signs off.

    **What an AI worker is told can be changed from a task's page** ("Add instructions for next
    time", `POST /api/worker/instructions`). This calls `refineWorker`, the function behind
    `/refine`, through `changeWorkerInstructionsFromPage`. Only someone who can sign off work may
    change it, and only for an AI worker that belongs to the business and works in one of its
    business functions. Anything else the worker was told is kept as it was. The page says
    Arturo does not enforce it. First-day setup refuses to
    make an owner of a person already registered who cannot approve work, rather than tell
    them they can. The menu's **Waiting for you** keeps go-aheads (permission to run or act)
    apart from sign-offs (accepting a result) with separate lists, counts and button words,
    and leaves Human Tasks out, since they are not approvals.

20. **Arturo can check two things about work itself, so they do not rest on a model.** A rule
    written for an AI helper ("reject a manuscript over 5,000 words") is an instruction a model
    can ignore, and a model asked to review a manuscript nobody attached can invent one. For
    each area of work, `business/functionChecks.ts` can hold two checks: work needs a document,
    and a document may not exceed a word limit. They are made inside `createTask`
    (`repl/taskRoutingCommands.ts`), the function behind `/task create`, after the document is
    stored and before any Task exists, so the terminal refuses identically and a
    refusal starts nothing. Arturo counts the words itself from the verified document version
    (`readTextOfVerifiedArtefactVersion`), and fails closed: a document it cannot read, whose
    file no longer matches its recorded fingerprint, or which is too large to read in full is
    refused, not passed. The settings are set with the area (`POST /api/area/create`), changed
    from the page (`POST /api/area/checks`, `company/areaSetup.ts`) or at the terminal
    (`/function update --needs-document --max-words`), all through `setFunctionChecks`; only
    someone who can sign off work and give go-aheads may change them at the terminal, and an invalid limit is refused
    before anything is written. Known limits: the checks bind work somebody asks for, not Tasks
    a running Function creates from an event; follow-on work is exempt from "needs a document"
    because it carries the first Task's document; a refusal is a refusal, not a decision
    someone can override and record; and only these two checks exist. Everything else in a
    helper's rules is still for the model to follow and a person to catch at sign-off (item 11).
    "Who changed it" is a name chosen on a page that trusts whoever is at the computer
    (item 10), not a proven identity.

21. **An AI Worker cannot change records, and a result that says it did fails.** Every Worker
    prompt carries `RECORDS_BOUNDARY` (`agents/outputBoundaries.ts`, in `OUTPUT_BOUNDARIES`, so
    the Task and Workflow step prompts and the executor's fallback prompt all have it): it cannot add, change or remove a
    record or send anything, must never say it did, and, when asked to, says so and sets out the
    details for a person rather than writing steps for software it knows nothing about. Asked to
    add a client, a Worker had written a "Method for Adding New Client Information" for practice
    software it had never seen. Because prompts are followed intermittently, `findClaimedRecordChange`
    in `validateWorkerOutputIntegrity` fails the Task when the instruction asked for a record to be
    added, changed, removed, booked or logged and the result says it was ("I've added Joe Bloggs…",
    "…has been entered"), ignoring "nothing has been added" and the like. Known limits: it reads
    English phrasing, so a claim worded otherwise passes; it only applies when the instruction
    asks for a change, so a draft letter that says "we have added your details" is left alone; and
    it detects claims, it does not prevent a Worker with a real capability from acting (those go
    through the capability and go-ahead rules above). A sign-off accepts text and never changes a
    record; a client is saved only through the read-back and `addClient` (item 17).

22. **What a worker can do is said in one place, worked out from its archetype, and a task
    nobody can do is refused before it starts.** `capabilities/abilities.ts` groups the capability
    catalogue into plain abilities ("Write and check", "Search the web", "Ask a person here for a
    review", "Update Office records", "Send email", "Change records in other software", "Add or
    change clients, workers and checks", "Set reminders"). An ability describes and never grants:
    an AI Worker's capabilities still come only from its archetype (`normalizeWorkerCapabilities`),
    and whether an ability waits for a go-ahead is computed from the catalogue
    (`requiresDefaultJobApproval`), never written in the table; a test fails if the table and the
    catalogue disagree. The terminal's labels, the go-ahead card's "what it could do outside
    Arturo" and the worker suggestion's "It can / Asks you first / It cannot" are all generated
    from it, so they no longer drift: the page used to label a worker holding `human-contact` as
    working only inside Arturo, although Arturo emails a registered person a review link for it
    (registering a person proves nothing about who they are).
    `inferTaskAbilities` looks, by fixed rules, for what a request asks beyond writing: a new
    client (people only, through the read-back, item 17), an email to send, a change in other
    named software, a reminder. `findMissingAbility` is checked inside `createTask`, before any
    Worker is chosen or anything queued, against the AI Workers staffed on the Function, so the
    terminal, New task, watched folders and suggestions refuse alike, and on the page before any
    document is kept. No archetype holds `email-send` or `web`, so today such a request is always
    refused unless the person asks for it to be written out only (`--write-only`; the page's "Have
    a worker write it out instead"). A retry passes `--write-only`, since the Task it repeats was
    already created. A request given to a person is not checked: a person can do it. Known limits:
    the rules read English phrasing and miss other wording (the Worker then only writes, and
    item 21 catches a false claim of having done it); Tasks a running Function creates from an
    Event and recurring Schedules are not checked; and archetypes and the abilities they give are
    stored unsigned, so someone who can write the data directory can change a Worker's archetype
    (item 1). Office: in Office's own business functions (Accounts, Customers, Operations) an
    operator's `office-write` changes are applied as soon as its Task runs, without a go-ahead
    (`officeJobGovernance.ts`, `staffing:office-drafts`), and only invoices wait for a person to
    confirm a plan (`confirmedOfficePlan.ts`, which is not signed). The page says the first plainly
    beside the ability; making Office customer and job changes wait for a confirmed, signed change
    is planned together with merging Office customers and Clients into one list, which today are
    two separate lists.

23. **A result can go to another AI worker to be checked before a person signs it off.** A person
    who can sign off work may set a business function so that its results go to another
    business function's AI worker first (`/function update --pass-on-to`, the business function's
    page, `POST /api/area/passon`, all through `setPassOn` in `runtime/passOnRules.ts`); set it to
    never pass results on (`--pass-on never`), which no task can override; or leave it bringing
    results straight to a person. The person asking may choose for one task (`--pass-on
    <business function|off>`, New task's "When the result is ready"), checked inside `createTask`
    before anything is queued. When a task finishes, `deliverPassOn` (`runtime/resultPassOn.ts`)
    sends it on only by that rule or choice: no model decides where a result goes, and nothing a
    model wrote is read to decide it. Fixed in code: only a plain AI-written result is passed on
    (one carrying the unverified-model banner; an Office receipt, a conversion or a record a
    person confirmed is not); only to another business function of the same business that has an
    AI worker, and never to one whose AI worker can reach outside Arturo without asking first
    (search the web, change Office records), because a result nobody has signed off must not
    leave Arturo; one step only (`PASS_ON_STEPS`): a check is never passed on again; each result
    is passed on once (`INSERT OR IGNORE` on the delivery); and the check is created through
    `createTask` with `--follows`, so every check on new work (what no AI worker can do, the
    function's own checks, who may ask, go-aheads) is made again, as the person who asked. A
    target that can no longer check (no AI worker, an outside reach since added) stops the
    delivery, records why, and leaves the result for a person. The checking worker is told in
    fixed words to list the points needing attention, say where each is and what it did not
    check, never rewrite the result and never give an overall verdict; the result is given to it
    as data (item 18). It cannot change the result: it writes its own.
    The end of every chain is a person's sign-off. The check is never signed off on its own
    (`signOffTaskResult` refuses it and names the result to sign off instead); it is never
    passed on, and nothing follows from it. The result waits on Waiting for you as one item,
    shown once the check is done or has failed, with the check beside it on its page: who checked
    it, "Checked by … AI worker, not by a person", a count ("Points to check: 2", or "No points
    raised. That does not mean the result is right."), never a tick or "looks fine", and "Read
    the result yourself: the check can be wrong too". A person can still sign the result off
    while the check runs. Known limits: an AI check is not evidence; a person who signs off
    beside a short list of points may read less carefully (rubber-stamping), which the page's
    wording argues against but cannot prevent; a check that ignores its instructions and says
    "looks fine" is shown as it wrote it, since Arturo checks only that it began with a count;
    what the check said when the result was signed off is now bound into the sign-off's HMAC
    (`alongside`, item 24), as well as kept with the delivery (`seenAtSignOff`); rules are now
    HMAC-signed with the local signing key (item 24), so an edited rule is not followed, with the
    local-key caveat of item 1; and "who set it" is a name chosen on a page that trusts whoever is
    at the computer (item 10).

24. **A result can go along a route of steps a person set, before anyone signs it off.** A person
    who can sign off work may set a business function so that its results go along a route of at
    most `MAX_ROUTE_STEPS` (2) steps, each another business function of the same business and a
    fixed instruction that person wrote (`/function update --route-step "<function>: <what it
    does>"`, the business function's page, `POST /api/area/passon`, all through `setPassOn`).
    Arturo runs it (`runtime/resultPassOn.ts`): each step is created through `createTask` with
    `--follows` the step before, under a one-time claim, once (`claimPassOnDelivery`); a step's
    own business function's rule is never followed, so routes do not chain and cannot loop; each
    business function appears once and never the starting one; a business function set to never
    pass on cannot be a step; a step goes only to an AI worker that cannot reach outside Arturo
    without asking, checked when the route is set and again before each step. No model chooses
    the route or the next step, and nothing a model wrote is read to decide either.
    Fixed in code: Arturo stops for a person to sign off the first result before the route goes
    on, unless the person who set the route turned that off (`--route-stop-first off`), because
    a wrong first result is carried, consistently, into every step after it. Before the first
    step Arturo looks, by name and with no model, for the business's other clients in the task
    and its result (`otherClientsNamed`) and stops the route if it finds one, so a person can
    check for a conflict. Anyone who can sign off may stop a run (`/task stop-route`, the task
    page, `POST /api/route/stop`, all `stopRoute`); a step already running finishes and nothing
    more starts. A failed step ends the run. Rules are HMAC-signed (`purpose: "pass-on-rule"`),
    and each run records the SHA-256 of the rule it ran under and copies its steps, so changing
    the rule does not change a run.
    The end is still each document's own sign-off: nothing signs off a run, there is no button
    that signs several documents, and Waiting for you shows a run as one item only once nothing on
    it is still working. Each sign-off binds, inside its HMAC, the SHA-256 of every result it was
    built on along the route and of a check kept with it (`alongside`, `signOffAlongside`), so
    the record says what the whole pack read when each document was accepted; a later edit to any
    of them makes the sign-off fail to verify.
    Known limits. The fence (item 18) stops text in a document from giving instructions, not from
    persuading: a clause the other side put in their draft can be written in by one step as
    substance and explained to a client by the next, after which it is model-written content no
    fence can tell apart. One person signing off several documents reads less carefully than
    several separate sign-offs; the page says the steps in between were not signed off and that
    the reader is the first person to read them, but cannot make anyone read. The other-clients
    check matches names only and misses a party called something else. A step whose worker holds
    an ability that reaches outside Arturo after asking (every archetype can ask a person here for
    a review) still waits for that go-ahead; it is not refused outright. Each step is given the
    result before it, not every earlier one. Signing off any one document records who accepted
    it; it does not show the signer is qualified to supervise the work (a lawyer's review, for
    a law practice), which remains the business's duty.


25. **The company page, and the HTTP servers that served it, are gone.** `cli/src/company`
    (including `companyServer`) and `officeServer` are not in this tree. Nothing from
    `cli/dist/company/` is served. Arturo is still a single-operator process on a trusted
    host for setup, go-aheads, enrolment confirmation and switching the off-terminal path
    on or off: those decisions are made at the terminal, with the same trust as anyone
    who can type there or write the data directory (item 1). A new, small sign-off
    listener may be started on that host. It binds only `127.0.0.1` and serves only
    pairing and the sign-off or set-aside of one result (items 4 and 5). No link is
    issued unless `PUBLIC_BASE_URL` is `https://` plus a hostname. The path starts off;
    switching on is owner-only loosening (typed reason, 12-hour wait, claim-once email
    notice) and switching off is immediate. The sign-in, invite, session-cookie and
    `ARTURO_COMPANY_BIND` controls in earlier revisions applied only to the company page
    and are not in force. Leftover identity code (`identity/companySignIn.ts`,
    `npm run identity`) can still issue invites and record a signed-in actor, but it
    does not expose a network service. Known limits: decisions at the terminal are not
    bound to a signed-in account; one signing key still serves every business (items 1
    and 8); a person who can sign off can still sign off without reading (item 24);
    behind a tunnel, loopback is not proof of presence at the host (item 5); the
    real-person test gate must be passed on the business's own tunnel before a hosted
    relay is considered.

## Direction of travel

Closing items 1 and 3 now means moving from file/env HMAC secrets to external
KMS/asymmetric signing with rotation, and from the current host-capability fail-closed
guard to an actual Worker sandbox with process isolation, filesystem mediation, egress
control, and resource budgets. Those items, plus production identity, tenant isolation,
backup/retention/recovery, and authenticated network services, are prerequisites for any
public or hosted offering.
