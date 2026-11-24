export type UiCommandHelp = {
  readonly command: string;
  readonly summary: string;
  readonly usage: readonly string[];
  readonly examples: readonly string[];
  readonly notes?: readonly string[];
};

export type UiCommandGuidance = {
  readonly prerequisites: readonly string[];
  readonly effect: string;
  readonly related: readonly string[];
};

const COMMAND_EXPLANATIONS: Readonly<
  Record<string, string>
> = {
  "/overview": "The Overview is Arturo's read-only front page for the company currently represented in its records. It brings together Enterprise, ongoing Function, Worker, Task, approval, and Human Task counts so an operator can see what exists and where attention may be needed without opening every list. It is a navigation and situational-awareness view, not an AI-written business report: its counts come from stored Arturo state, and any important item should be checked with the relevant inspect command.",
  "/next": "The /next command helps turn an Enterprise mission into a small set of ongoing Functions. A Function is a responsibility the Enterprise must keep doing, such as finding science news or summarising it; it is not one temporary piece of work. Arturo gives an approved model the Enterprise name, mission, and existing Function names, validates the recommendations, and waits for an explicit yes or no before creating anything.",
  "/enterprise": "An Enterprise is the top-level organization Arturo is modelling, such as a company, charity, internal venture, or deliberately isolated demonstration. Its name, mission, and description provide the shared context used when Arturo proposes ongoing Functions or prepares Worker instructions; creating an Enterprise does not legally incorporate a company or verify its identity. Use this command to create that organizational boundary, inspect everything attached to it, revise its descriptive context, or distinguish several Enterprises stored in one installation.",
  "/function": "The /function command creates, changes, lists, inspects, and starts an ongoing Enterprise responsibility. A Function is closer to the answer to “What is your function?” than to a single to-do item: Science Discovery may run every day and reactivate its completed recurring Task when news is due. Use /function create, /function update, /function inspect, and /function list; starting a Function activates its internal operating process and does not invent missing Workers, tools, evidence, permissions, or schedules.",
  "/staff": "Staffing converts an Enterprise's ongoing Functions into a reviewable proposal for Worker coverage. Arturo asks a selected model to suggest the smallest useful set of AI Workers, shared assignments, and any required Human approval coverage, then validates and formats the proposal. The plan changes nothing until the operator explicitly answers yes; after it is applied, each Worker is attached to the Functions it is expected to carry out.",
  "/start-functions": "The /start-functions command is a compatibility batch shortcut from Arturo's earlier terminology. It checks staffing and Human approval coverage before starting every ready ongoing Function, while blocked Functions remain stopped with a reason. New users can normally start one responsibility more clearly with /function start, so this older batch command is omitted from the main command guide.",
  "/ask": "The /ask command is Arturo's general one-off workflow entry point for objectives that may require several ordered steps or different kinds of Workers. Arturo classifies the objective, creates and validates a workflow plan, routes its steps, and records the resulting Tasks so they can be inspected later. It is broader than /task create, which creates one capability-routed Task, but it still cannot grant tools, evidence, external access, or authority that the configured operating process does not provide.",
  "/workflow": "A Workflow is a reusable, ordered path through several AI and Human Workers. Use the model-generated form when you want Arturo to propose the steps, or the deterministic create form when the order and named participants must be fixed—for example, research, design, Human file creation, Human review, and costing. The command saves a plan but does not start it; every Human step remains a real Human Task or review gate, and naming a Worker with web capability does not create a social-media connector.",
  "/run": "The /run command starts one saved Workflow and creates the first Task in its ordered sequence. Each completed step supplies bounded context to the next, Human creator steps pause as assigned Human Tasks, and Human reviewer steps can bind approval to exact Artefact versions before downstream work is released. Running a Workflow does not make its model output true or grant missing connectors, file access, professional authority, or external side effects; use the Workflow Run, Task, Human Task, Artefact, and Timeline records to verify progress.",
  "/workers": "Workers are the named AI and Human participants Arturo can route work or decisions to. An AI Worker combines an organizational role, archetype, capabilities, specialization, model, and availability; a Human Worker records accountable participation metadata for approvals or Human Tasks. This command lists, filters, inspects, and safely removes Workers. Removal deletes current registration and staffing coverage but preserves historical Tasks and audit records; system Workers and Workers referenced by unfinished work cannot be removed.",
  "/archetypes": "An archetype is a reusable starting template for a Worker role. It combines a base prompt, behavioral guardrails, and default routing capabilities—for example, a researcher is prompted to separate evidence from speculation, while a guardian is oriented toward constraints and safety. Archetypes influence model behavior and routing, but they are not deterministic permissions, professional credentials, or tool grants; use --refine for domain specialization and Governance for enforceable execution controls.",
  "/capabilities": "A capability is a canonical label that Arturo uses to match a Task's requirements with eligible Workers. Labels such as analysis, writing, safety, or web-research make routing deterministic and inspectable, but they describe eligibility rather than actual access: a Worker with web-research capability still needs a configured connector and policy before any search can occur. This command lists the accepted IDs and explains their boundaries so users do not have to guess values for /workers, /task create, or Governance policies.",
  "/add-ai-worker": "An AI Worker is a durable organizational role backed by a configured language model, not merely a model name or a disposable chat session. The archetype supplies its base instructions and default capabilities, and refinement appends a narrower specialization; together these determine how future Tasks are routed and prompted. Which model does the thinking is not a property of the Worker: it is chosen once with /model and applies to every Worker until you change it there. Registration persists the Worker and may assign compatible queued Tasks, but it does not test expertise, create new tool permissions, or allow an always-on Worker to spend from an external-model budget.",
  "/add-human-worker": "A Human Worker record lets Arturo represent a real person as an accountable participant rather than treating every decision as AI work. Archetype and refinement describe the person's intended role, email is unverified contact metadata, and availability records whether Arturo should currently regard the person as available, busy, or offline. Human Workers do not use an AI model, and registration does not authenticate the person, notify them, prove their qualifications, or automatically assign every relevant Human Task.",
  "/refine-worker": "Refinement adds durable, Worker-specific instructions after the broad archetype prompt. It is useful when a generic coach, researcher, reviewer, or analyst needs a clear domain focus, evidence rule, audience, or way of working. Write it in the second person and as an identity rather than a note—\"You are an expert valuer of second-hand stringed instruments who reasons only from supplied findings\"—because the text is appended to the Worker's prompt and is read as one. Refinement changes future prompt context, not deterministic authority: it cannot add capabilities, connectors, credentials, evidence, approvals, or permissions, and sensitive secrets should never be placed in persistent refinement text.",
  "/functions": "Functions are the ongoing responsibilities that make up an Enterprise, such as Science Discovery, Product Safety, or Customer Support. A Function states what result must keep being produced over time; it can be staffed with Workers, started so it can react to Events, and inspected for its objective and operating state. Use /tasks for the temporary pieces of work created while a Function is running.",
  "/jobs": "Compatibility alias for /functions. It lists the Enterprise's ongoing Functions; existing scripts that use /jobs remain supported.",
  "/job": "Compatibility alias for /function. It creates, changes, lists, inspects, and starts an ongoing Function; existing scripts that use /job remain supported. For compatibility, /job <old-task-id> still opens an execution record.",
  "/tasks": "Tasks are Arturo's persistent records of bounded pieces of work. A Task moves through states such as queued, awaiting approval, running, completed, or failed and records its instruction, required capabilities, Worker, routing reason, evidence status, and result preview. Completed means execution returned an output; it does not by itself mean the answer is true, externally verified, approved, or successful in the real world.",
  "/task": "The /task command creates or inspects one bounded piece of work for an ongoing Function. A bounded Task has a clear input or supplied context, one understandable deliverable, relevant constraints, and a stopping point—for example, summarise the five captured science-news results and label uncertainty. Arturo infers the owning Function only when one is clearly suitable, then selects its staffed AI Worker and applies Governance before execution; use --job to override the inference. Repeating or always-on responsibilities belong in Functions, with Events or Schedules creating or reactivating Tasks when work becomes due.",
  "/task-cap": "The /task-cap command remains a compatibility alias for /task create. New commands use /task create with one outcome and an optional --job override; Task capabilities are derived from the selected Function's staffed Worker rather than supplied by a user flag.",
  "/chat": "Worker Chat lets you talk directly to a registered AI Worker about its role, specialization, recent Tasks, and eligible Operational Memory. Conversations are strictly read-only: the Worker cannot execute Tasks, modify records, send email, call tools, or sign off work or give go-aheads, and every model response remains unverified synthesis. Chat history is persisted locally per Worker so you can inspect or clear past turns at any time.",
  "/artefacts": "Artefacts are Arturo's records of files or external file references produced or supplied during work. The list shows stable identities, kinds, Enterprises, latest exact versions, and Human review state so a design, evidence note, specification, price list, or costing sheet is not reduced to an unnamed block of text. Arturo stores metadata and hashes rather than copying or uploading the file itself, so a listed Artefact can still become unavailable if its external location disappears.",
  "/artefact": "The /artefact command manages versioned file evidence and post-output review. A local file is recorded with an exact version, media type, size, source links, creator, and SHA-256 hash; an HTTPS reference can carry a supplied hash but Arturo does not fetch it. Review always targets an exact reference such as artefact-2@1, and the signed Human decision is bound to that version, URI, hash, reviewer, notes, and time. A changed file must become a new version—it never inherits approval silently.",
  "/memory": "Operational Memory is Arturo's shared company notebook for knowledge that should help with future work. An entry can be a lesson, rule, assumption, or organizational fact, and Arturo may include it in later Worker context when its Enterprise or Function scope matches. Memory is not the same as a Task result, Event history, chat transcript, or document store; model-derived lessons can be quarantined, and manual entries remain Human assertions rather than proven facts.",
  "/event": "An Event is a durable signal that records something meaningful as having happened, such as evidence becoming ready or a revised design being submitted. A person can publish one explicitly, or a deterministic rule can publish one after a Task owned by an ongoing Function completes. Arturo—not the model—applies that rule once, records the source Task and Worker, and offers the Event to other running Functions in the Enterprise.",
  "/schedule": "A Schedule is Arturo's deterministic clock for recurring work. It belongs to one bounded Task, which belongs to an ongoing Function, and can run every day or on one named weekday at a fixed local time. A Task stays dormant until due; the schedule then queues it and the Worker runtime decides whether it can start. Later occurrences reuse the completed Task and reselect a qualified staffed Worker. An unfinished Task causes the occurrence to be skipped and recorded. An optional fixed search query can travel into a web-research Task, while the actual search still requires an authorized Worker, ready provider, and call budget.",
  "/events": "The Events view is Arturo's durable organizational history of meaningful signals and outcomes. It includes Event publication, Task lifecycle changes, Memory additions, Governance checks, approvals, and other notable operations. Events provide the broader organizational story, while Timeline focuses on recent operational ordering; neither independently proves model-generated or Human-entered claims.",
  "/health": "Health is Arturo's computed operational assessment of one ongoing Function, based on completed and failed Tasks, open work, measured outcomes, eligible lessons, and governed criteria. A Function can have every Task completed yet still be Degrading when outcomes were not measured, or remain Unknown when evidence is insufficient. Health is not a claim about profit, safety certification, compliance, or real-world success.",
  "/delegation": "Delegation is a formal handoff in which one ongoing Function asks another Function in the same Enterprise to complete one bounded Task. The requesting Function retains accountability, the receiving Function determines the execution route, and the Task result remains inspectable through both histories. Delegation is not permanent ownership transfer, endless monitoring, cross-Enterprise federation, or proof that returned model synthesis is correct.",
  "/timeline": "Timeline is the recent reverse-chronological audit view of Arturo activity. It shows Task routing, Function evaluation, Governance decisions, approvals, Delegations, Worker Chat records, Human Tasks, and failures with timestamps and IDs. It deliberately contains concise metadata, so use the relevant inspect command for full content; an audit trail shows what Arturo recorded, not whether every assertion was true.",
  "/model": "The /model command chooses which AI model does Arturo's thinking, and it is the answer whenever a result reads poorly: pick a different model and run the command again. It lists the models already on this computer first, because they are free and private; a model that needs downloading, or an external paid service, is clearly marked and only ever used after you answer yes to a question that names exactly what will happen. Arturo never uses a paid model by default, and paid calls always stay inside the session limit. The choice is remembered across restarts and applies to every model-backed command.",
  "/model-routing": "Model routing is Arturo's policy for choosing between local and external language models while controlling cost and data transfer. The view shows the local default, approved external tier, whether external escalation is correctly configured, the per-process external-call allowance, calls used and remaining, approved aliases, and the narrow automatic escalation trigger. It is a configuration and budget-boundary inspection rather than a benchmark or live availability test, and viewing it neither changes the policy nor spends a model call.",
  "/web-search": "Web Search is Arturo's governed route for giving an authorized AI Worker current public search evidence. Arturo sends one bounded query to the configured Brave Search API or operator-controlled SearXNG service, filters the returned HTTPS result links through domain policy, normalizes titles and snippets, and stores the exact dated result set as a hashed evidence Artefact before the model runs. Search snippets remain unverified third-party claims: Arturo does not open result pages, sign into social networks, bypass access restrictions, or treat provider ranking as proof, and a process-local call allowance prevents silent unbounded searching.",
  "/governance": "Governance is Arturo's deterministic pre-execution control layer. A policy matches Task metadata such as capability, risk, acting role, trust boundary, and Enterprise scope, then allows, denies, or requires approval before the Task runs. Application rules enforce these controls, but they cannot understand every real-world risk, validate the output, or turn approval to execute into certification of the result.",
  "/approvals": "Approvals are signed, auditable Human decisions controlling whether governed Tasks may execute. The list shows each Task, required count, current decisions, participant attribution, and policy where available. Because approval happens before unknown model output exists, it authorizes the proposed execution boundary rather than verifying the eventual answer.",
  "/approve": "The /approve command records a positive decision on one pending governed Task. Arturo verifies the approval chain, attributes the decision to an eligible Human participant, signs and persists it, and releases the Task only when the required number of approvals has been reached. The approver should review the exact instruction, capability, policy, available evidence, and authority boundary; approval is not a prediction that the Worker will produce a correct or safe result.",
  "/reject": "The /reject command records that a pending governed Task must not execute in its current form. A meaningful reason becomes part of the durable approval history, the rejection prevents that chain from releasing the Task, and the record remains available for audit rather than being deleted. Rejection does not automatically rewrite the instruction or create a safer replacement, so corrected work must be submitted explicitly.",
  "/approval-status": "Approval status is the focused inspection view for one governed Task's decision chain. It reports whether the chain is pending, approved, or rejected, how many decisions are required and recorded, and which Human participants made those decisions after stored integrity checks. The status describes authorization to execute, not the factual quality of a completed result.",
  "/setup": "Setup walks you through four numbered steps: the business and its mission, its Functions, staff, and the first Task. /enterprise typed on its own is an alias for the same route. Typing /setup again resumes at the first missing step, and nothing already saved is asked again. Each screen asks one question, with a way back and a way to quit. The script form can create the business record, but it cannot finish setup without the staff step.",
  "/assistant": "The assistant takes down new clients for a business, the way a personal assistant would after a phone call. Arturo never creates one unasked. /assistant shows who does it now or, if nobody does, proposes a Personal Assistant: what it can and cannot do, and the questions it will ask about a new client, which Arturo works out from what the business does. /assistant create sets it up only when a named person agrees, in an area of work called Clients with that person approving its work. /assistant assign hands new clients to a person instead, such as a human PA: anyone else's request then becomes a Human Task assigned to them.",
  "/talk": "Talk tells the assistant about a new client in your own words, as you would tell a personal assistant. It picks out what you said, asks for what is still missing (each question once, the name until it is given), then reads the whole record back. Nothing is entered until you say yes; then it is saved exactly as /client add would save it, after the same check for an existing client who may be the same, and recorded as a finished Task done by the assistant. Say cancel at any point to stop.",
  "/client": "A client is someone a business works for, kept as a record of its own: name, email, phone, address, notes and any further details the business asks for. Adding one first compares it with the existing records (same email, same phone, same or nearly the same name) and keeps nothing until the person confirms it is someone new. The usual way to add one is to tell the assistant with /talk; /client add records one directly. Work can name the client it is for with /task create --client, and that client's record is given to the AI helper as data.",
  "/work": "Named work is a matter, a book or a deal that Tasks belong to. Each piece is a signed record, and every change to it is kept in a signed change log. Turning \"no AI\" on for a piece of work stops anything more on it from going to an AI worker: Tasks not started are cancelled, running ones have their results set aside when they finish, and what was already sent is listed but can't be recalled. On a law practice, only a matter with a number and a type can be opened, and a Task for a client, with a document, or naming a client must belong to a matter; locked work types (wills, court, disputes, enduring powers of attorney, estates, relationship property) never go to an AI worker. Anyone working at the business may turn \"no AI\" on, with no reason. Only the owner turns \"no AI\" off, changes a matter's type or the law-practice setting, switches on paid escalation, or adds or unlocks a work type; turning \"no AI\" off, changing a type, switching on paid escalation and turning the law-practice setting off each need a typed reason, kept in the signed log. Turning \"no AI\" off means material for that matter can be sent to the configured AI provider again. Someone who can sign off work may cancel a piece of work, with a typed reason: a book's deals are cancelled with it, Tasks not started are cancelled, nothing is deleted, and cancelled work can't be reopened. A matter number is unique among work that isn't cancelled; reusing a cancelled one needs a signed link naming the work it replaces.",
  "/clients": "Lists one business's clients, whatever kind of business it is. Each line shows the reference used to name the client on a piece of work, with their email and phone where recorded, so you can find who a piece of work is for or check whether someone is already a client. It reads only what was recorded in Arturo and changes nothing.",
  "/human-tasks": "Human Tasks represent work or judgment that must be performed by a person rather than simulated by an AI Worker, such as inspecting a physical item, reviewing an exact external file, or making an accountable release decision. This command lists their open, blocked, revision, and completed states so the operator can find IDs and see where Human participation is waiting. A Human Task record currently stores instructions, notes, and attribution but does not by itself assign, notify, authenticate, or prove that a person completed an external action.",
  "/human-task": "The Human Task detail view shows one person's requested work in full: title, purpose when supplied, instructions, source Task when linked, current state, completion or block notes, participant attribution, and the actions still permitted. It should be inspected before completing, blocking, or revising the task so the operator acts on the correct record and preserves a clear rationale. The view is an Arturo record rather than an attachment system or independent proof of offline work.",
  "/create-human-task": "Creating a Human Task records a clear request for accountable Human judgment, investigation, or external action that Arturo should not pretend an AI completed. Good instructions identify the decision or deliverable, the evidence the person must examine, the stopping point, and the notes that must be preserved. Arturo stores an open task and may provide a signed local review link when configured, but creation does not assign or notify a person, perform the work, verify identity, or prove that an external action later occurred.",
  "/complete-human-task": "Completing a Human Task records that the requested Human work or decision has finished and preserves the supplied notes and participant attribution. The notes should state what was decided or done, the evidence considered, important limitations, and the next required action so later operators can understand the record without guessing. Completion may allow a linked workflow to continue, but it remains a Human assertion inside Arturo and is not independent verification of an external file, inspection, conversation, or physical act.",
  "/block-task": "Blocking a Human Task records that it cannot currently proceed because a dependency, participant, authority, evidence source, or external condition is unavailable. The reason should identify the concrete blocker and, where possible, who owns the next action, allowing the task list and audit history to explain why work stopped. Blocked is a temporary operational state rather than a final rejection, and it does not automatically pause unrelated ongoing Functions.",
  "/revise-task": "Revision returns Human work with explicit instructions about what must change before it can be completed. It is appropriate when the original response lacks evidence, follows the wrong scope, refers to the wrong artefact version, or needs a clearer deliverable, while preserving the earlier history rather than rewriting it. Revising the task does not perform the correction or notify a participant automatically, and completed historical records may require a new linked task instead.",
  "/suggest": "The /suggest command asks Arturo to propose bounded Tasks that a staffed ongoing Function could usefully perform now. It exists for the moment just after staffing, when an Enterprise has Workers but no work and the operator has no obvious way to learn what to ask for. Arturo reads the Enterprise mission, the Function's objective, and the capabilities its staffed Workers actually hold, then proposes work those Workers could genuinely do. Suggestions are unverified model output offered for judgement, not checked business advice; nothing is created until you accept, and anything accepted becomes an ordinary Task subject to the same routing, capability checks, and Governance as one you typed yourself.",
  "/start": "The /start command turns a drafted workflow plan into real Tasks. When /ask interprets a plain-English objective it deliberately stops at a plan: the steps are written down, a Worker is chosen for each, and nothing executes. That pause exists so an operator can read what Arturo intends to do before any model runs or any record is created, which matters most when the objective was ambiguous or the plan is longer than expected. Starting the run creates the Tasks and hands each one to the normal routing, capability, and Governance path, so a step whose Worker lacks the required capability still fails closed and a step a policy governs still waits for a human decision. Starting a plan authorises execution only; it is not approval of whatever the Workers subsequently produce.",
  "/clear": "The /clear command removes visible Arturo output from the current terminal display so the operator can continue with a less cluttered screen. It affects presentation only: Enterprises, ongoing Functions, Workers, Tasks, Events, Memory, approvals, Human Tasks, chat history, and other stored records remain intact and can be displayed again. The surrounding terminal application may still retain its own scrollback outside Arturo's control.",
  "/reset": "Reset asks for confirmation, listing what would be destroyed, then returns the local Arturo application to first-use state by deleting its stored records, including Enterprises, ongoing Functions, Workers, Tasks, workflows, approvals, Events, Schedules, Memory, Human Tasks, Delegations, and chat state. It is intended for disposable demonstrations or deliberately abandoned local data, not routine troubleshooting, and Arturo has no built-in undo for it. Reset cannot retract external model calls, emails, HTTP actions, files, provider logs, or backups that already exist outside Arturo.",
  "/help": "Help is Arturo's built-in guide to the supported terminal surface. The overview groups primary commands by purpose, while /help followed by a command explains the concept, prerequisites, syntax, switches, examples, internal workflow, side effects, verification, recovery, and safety boundaries; /help all exposes lower-level developer commands separately. Help is read-only and reflects the maintained command catalog, but it cannot prove that an external provider, credential, connector, or Human participant is currently available.",
  "/exit": "Exit closes the current native Arturo terminal process cleanly and returns control to the surrounding shell. It does not reset the installation or delete persistent records, so the next Arturo session can reload the saved Enterprises, Functions, Workers, Tasks, Events, and other state. Work already sent to an external system is not undone merely because the local terminal closes.",
};

const COMMAND_OPTION_HELP: Readonly<
  Record<string, readonly string[]>
> = {
  "/next": [
    '--feedback "<correction>" — Tell the selected model what was wrong or missing in an earlier recommendation.',
  ],
  "/function": [
    '--enterprise "<reference>" — Select the owning Enterprise by exact name or ID.',
    '--objective "<outcome>" — State the enduring result the ongoing Function owns.',
    '--description "<context>" — Explain the Function in more detail for people and Worker context.',
  ],
  "/staff": [
    '--enterprise "<reference>" — Select the Enterprise whose Functions need Worker coverage; required when more than one Enterprise exists.',
    '--instructions "<constraints>" — Add staffing constraints for this generation, such as “prefer shared Workers.”',
  ],
  "/start-functions": [
    "--ready — Confirm that Arturo should run readiness checks and start every Function that passes.",
    '--enterprise "<reference>" — Limit the batch operation to one Enterprise.',
  ],
  "/add-ai-worker": [
    "--archetype <id> — Choose the built-in role prompt and default capabilities. Run /archetypes for valid IDs.",
    '--refine "<specialization>" — Append specific role guidance after the archetype prompt without changing the archetype defaults.',
  ],
  "/add-human-worker": [
    "--archetype <id> — Optionally describe the Human's participation style and default capability metadata.",
    '--email "<address>" — Store contact metadata; Arturo does not verify or automatically email it.',
    "--availability <available|busy|offline> — Record whether the Human should currently be considered for participation.",
    '--refine "<specialization>" — Store specific role guidance, responsibilities, or domain focus.',
  ],
  "/task": [
    '--job "<reference>" — Optionally select the owning Function. Omit it only when Arturo can identify one suitable Function.',
    '--enterprise "<reference>" — Limit Function inference to one Enterprise; required when more than one Enterprise exists and --job is omitted.',
    '--search-query "<query>" — Request governed Web Search through the selected Function’s staffed Worker.',
    "<one-clear-outcome> — State one clear outcome, its relevant context, and where the Worker should stop.",
    "--input-artefact <id@version[,id@version]> — Supply exact Artefact versions as bounded Task input. Matching local text is included; other files remain metadata-only.",
    "--after-artefact-approval <id@version[,id@version]> — Keep the Task blocked until every exact version has an approved Human review.",
    "--follows <task-id|human-task-id> — Work from something that has already finished: another Task's result, or what a person reported on a completed Human Task. Arturo supplies it at execution, labelled by which it is. Refused for work that has not finished, or a Human Task completed without notes.",
  ],
  "/task-cap": [
    '--job "<reference>" — Optionally select the owning Function. Prefer /task create for new commands.',
    "<one-clear-outcome> — State one clear outcome, its relevant context, and where the Worker should stop.",
    "--input-artefact <id@version[,id@version]> — Supply exact Artefact versions as bounded Task input. Matching local text is included; other files remain metadata-only.",
    "--after-artefact-approval <id@version[,id@version]> — Keep the Task blocked until every exact version has an approved Human review.",
    '--enterprise "<reference>" — Select the Enterprise that owns the Task and any Web Search evidence; use it whenever several Enterprises exist.',
    '--search-query "<query>" — Request governed Web Search through the selected Function’s staffed Worker.',
  ],
  "/artefact": [
    "--kind <design|evidence|specification|price-list|costing|other> — Classify a new Artefact for people and later routing context.",
    '--file "<path>" — Record a local file and compute its SHA-256 and size immediately.',
    '--uri "<https-url>" — Record an external reference without fetching it; use --sha256 when an authoritative hash is available.',
    '--created-by "<worker>" — Record the registered AI or Human Worker responsible for this version.',
    "--task <task-id> — Link the version to the bounded AI Task that produced it.",
    "--human-task <human-task-id> — Link the version to the Human Task that produced or supplied it.",
    "--job <old-task-id> — Compatibility alias for linking an older execution Function ID.",
    '--reviewer "<human-worker>" — Assign exact versions to a registered Human for post-output review.',
    "--decision <approve|reject|revise> — Record the Human outcome for exact submitted versions.",
  ],
  "/workflow": [
    '--objective "<outcome>" — Give an explicitly defined Workflow a clear overall result.',
    '--step "<worker>" "<instruction>" — Add one ordered step using an exact registered Worker; repeat the switch for every step.',
  ],
  "/run": [
    "--input-artefact <id@version[,id@version]> — Supply exact starting evidence to the first step and carry the references through later handoffs.",
    '--enterprise "<reference>" — Select the Enterprise that owns the Workflow Run and any Web Search evidence.',
    "--auto-workers — Allow Arturo to create missing AI roles for model-planned Workflows; explicit Human participants still require deliberate registration.",
  ],
  "/create-human-task": [
    '--assign-to "<human-worker>" — Assign the task to one available registered Human and enforce that ownership at completion.',
    "--artefact <id@version[,id@version]> — Supply exact input versions the Human must inspect.",
    '--purpose "<reason>" — Explain why Human work or judgment is needed.',
    "--follows <task-id> — Hand over the result of a Task that has finished, so the person can act on it without it being pasted into the instructions. Refused for a Task that has not finished.",
  ],
  "/complete-human-task": [
    '--as "<human-worker>" — Attribute completion to a registered Human; an assigned task must be completed by its owner.',
    "--artefact <id@version[,id@version]> — Record exact versions produced by the Human as task outputs and pass them to the next Workflow step.",
  ],
  "/event": [
    '--source "<job>" — For manual publish, record which ongoing Function originated or owns the signal; the Function must belong to the selected Enterprise.',
    "--when task.completed — Use the currently supported trigger: completion of a Task owned by the source Function.",
    '--job "<job>" — Identify the ongoing Function whose completed Tasks are eligible to trigger the rule.',
    "--capability <id> — Optionally narrow a rule to completed Tasks declaring this required capability. Run /capabilities to list IDs. web-research also activates the verified-evidence gate.",
    '--publish "<event-name>" — Name the Business Event Arturo will publish after the rule conditions pass.',
    '--enterprise "<enterprise>" — Scope provenance, rule ownership, and Function evaluation to one Enterprise.',
  ],
  "/schedule": [
    '"<one-clear-outcome>" — Describe the bounded Task that should recur. Arturo creates it dormant, so it cannot run before the schedule is due.',
    '--every <daily|weekday> — Choose daily or one weekday such as friday. Omit it for daily.',
    '--at "HH:MM" — Set the 24-hour local time, such as 09:00 or 18:00.',
    '--timezone "<IANA-timezone>" — Define which local clock the time belongs to, such as Pacific/Auckland; this avoids depending on the computer display timezone.',
    '--job "<job>" — Identify the Task’s owning Job. Omit it only when Arturo can infer one unambiguous Function from the outcome.',
    '--enterprise "<enterprise>" — Store and evaluate the schedule inside one Enterprise boundary.',
    '--search-query "<query>" — Optionally carry one fixed public-search query into a web-research Task. It does not perform a search by itself.',
  ],
  "/delegation": [
    '--from "<job>" — The requesting ongoing Function, which keeps accountability.',
    '--to "<job>" — The receiving ongoing Function, whose operating process routes the delegated Task.',
    '--enterprise "<reference>" — Restrict Function-name resolution to one Enterprise when names may be repeated.',
  ],
  "/governance": [
    "--effect allow|deny|require-approval — Decide what happens when every supplied matcher applies.",
    '--capability "<id>" — Match Tasks requiring this canonical capability. Run /capabilities for IDs.',
    "--risk low|medium|high — Optionally match the Task's declared risk level.",
    "--role admin|operator|auditor|worker — Optionally match the acting role recorded for the operation.",
    "--boundary trusted|restricted|external|untrusted — Optionally match the declared trust boundary.",
    "--scope enterprise|global — Store the policy for the current Enterprise or across the installation; use global sparingly.",
    '--enterprise "<reference>" — Select the policy owner when --scope is enterprise and more than one Enterprise exists.',
  ],
};

export function getUiCommandExplanation(
  detail: UiCommandHelp
): string {
  const specific =
    COMMAND_EXPLANATIONS[
      detail.command
    ];
  if (specific) {
    return specific;
  }

  const effect =
    EFFECTS[
      detail.command
    ] ??
    "Arturo reports any state change in the command output.";
  return `${detail.summary} ${effect}`;
}

export function getUiCommandOptionHelp(
  command: string
): readonly string[] {
  return COMMAND_OPTION_HELP[
    command
  ] ?? [];
}

/**
 * Commands that ask for what they need when typed on their own, and what they
 * ask for.
 *
 * Every value these commands take can be given by answering a numbered
 * question, so help leads with that rather than with a switch an operator has
 * to copy-paste. The switch forms remain documented below it for scripts and
 * headless runs, where nothing can answer a prompt.
 */
const COMMAND_GUIDED_PROMPT: Readonly<
  Record<string, string>
> = {
  "/enterprise": "Asks whether to set up a business, look at one, or list them.",
  "/function": "Asks whether to add a Function, look at one, or list them; adding asks for the name and objective.",
  "/task": "Asks what you want done, which Function should do it, and what it should work from — a file, a web search, a file it must wait to be approved, or one of your Procedures.",
  "/schedule": "Asks what should recur, how often, at what time, and which Function owns it.",
  "/artefact": "Asks whether to attach a file, record a new version, send one for review, record a decision, or list them.",
  "/add-ai-worker": "Asks for the Worker's name, then its role as a numbered list.",
  "/add-human-worker": "Asks for the person's name, what they will be allowed to do — with the full role list one step further in — and how to reach them.",
  "/refine-worker": "Lists the Workers to pick from, then takes the specialization, written in the second person as the Worker's own expertise.",
  "/suggest": "Lists the Functions to pick from, then proposes work its Workers could do.",
  "/create-human-task": "Asks what the person must do, whether they are acting on work a Task has already finished, who it goes to, and which file they must look at.",
  "/complete-human-task": "Lists the open Human Tasks, then asks what was done, who did it, and whether it produced a file.",
  "/block-task": "Lists the open Human Tasks, then asks what is blocking it.",
  "/revise-task": "Lists the Human Tasks, then asks what must change.",
  "/governance": "Asks what the rule is for, what should happen, what work it covers, and its risk level.",
  "/event": "Asks whether to announce something now or automatically, and what to announce.",
  "/memory": "Asks what to remember, then which Function, business, or everything it applies to.",
  "/delegation": "Asks which Function needs help, which one does the work, and what the work is.",
  "/workflow": "Asks whether to describe it or set the steps yourself, one Worker and instruction at a time.",
  "/run": "Lists the saved Workflows to pick from, asks before creating any missing roles, then asks for a starting file and anything else the run should know.",
  "/start-functions": "Asks which business, then for an explicit yes before starting anything.",
  "/model": "Lists the models to pick from by number.",
  "/staff": "Reviews the proposed Workers one at a time, and asks what should be different if you skip them all.",
  "/next": "Reviews the proposed Functions one at a time, and asks what was wrong if you skip them all.",
};

/**
 * Returns what a command asks for when typed on its own, or undefined when it
 * takes no interactive form.
 *
 * PURE: No side effects.
 */
export function getUiCommandGuidedPrompt(
  command: string
): string | undefined {
  return COMMAND_GUIDED_PROMPT[
    command
  ];
}

export type UiCommandHelpGroup = {
  readonly title: string;
  readonly commands: readonly string[];
};

const help = (
  command: string,
  summary: string,
  usage: readonly string[],
  examples: readonly string[],
  notes: readonly string[] = []
): UiCommandHelp => ({ command, summary, usage, examples, notes });

export const UI_COMMAND_HELP: readonly UiCommandHelp[] = [
  help("/overview", "Show the live executive view of the current Arturo state.", ["/overview"], ["/overview"]),
  help("/next", "Recommend ongoing Functions, one at a time, for you to accept or decline.", ['/next ["<enterprise-name-or-id>"] [--feedback "<correction>"]'], ['/next "Koru Kids"', '/next "Koru Kids" --feedback "Use fewer, more independent Functions."'], ["Which model writes the recommendations is chosen with /model, and holds until you change it there.", "Nothing is created until you accept a recommendation."]),
  help("/enterprise", "Create, inspect, update, or list Enterprises.", ['/enterprise "<name>" --description "<description>" [--mission "<mission>"]', '/enterprise create "<name>" [--mission "<mission>"] [--description "<description>"] [--advise]', '/enterprise create --advise', '/enterprise inspect "<name-or-id>"', '/enterprise update "<name-or-id>" --description "<description>"', '/enterprise update "<name-or-id>" --mission "<mission>"', '/enterprise update "<name-or-id>" --name "<corrected-name>"', "/enterprise list"], ['/enterprise "Acme Real Estate" --description "Acme Real Estate is a small real estate business specialising in rural property."', '/enterprise create "Koru Kids" --mission "Help children learn through imaginative play."', '/enterprise create "Ethical Toys" --advise', "/enterprise create --advise"], ["The short form creates a new Enterprise. It does not update an existing Enterprise with the same name.", "--name corrects the Enterprise's name. Functions, Workers, Tasks, and history stay attached.", "When mission is omitted, Arturo uses the description as context for guidance and Worker tasks.", "--advise (alias --chat) starts a real conversation: Arturo talks with you in plain language, reacting to what you say rather than working through a fixed list, then creates the Enterprise with a mission drawn from the conversation and recommends Business Functions. Answer in plain text; type \"cancel\" to stop. It needs an interactive terminal.", "With --advise, <name> is optional. If you don't provide one, Arturo will suggest a name once it understands the business, and you can accept it, decline to be asked again, or type your own."]),
  help("/function", "Create, update, inspect, list, start, or remove one ongoing Function.", ['/function create "<name>" --enterprise "<enterprise>" [--objective "<objective>"] [--description "<description>"]', '/function update "<name-or-id>" [--objective "<objective>"] [--description "<description>"] [--follow-on <on|off>] [--hand-off-to "<person>" --hand-off-task "<what they do>"] [--hand-off off] [--pass-on-to "<business function>" | --pass-on <off|never> | --route-step "<business function>: <what it does>" ... [--route-stop-first <on|off>]] [--as "<your name>"] [--enterprise "<enterprise>"]', '/function inspect "<name-or-id>" [--enterprise "<enterprise>"]', '/function list [--enterprise "<enterprise>"]', '/function start "<name-or-id>" [--enterprise "<enterprise>"]', '/function remove "<name-or-id>" [--enterprise "<enterprise>"]'], ['/function create "Science Discovery" --enterprise "Science Tracker" --objective "Find the latest public science news."', '/function inspect "Science Discovery" --enterprise "Science Tracker"', '/function start "Science Discovery" --enterprise "Science Tracker"', '/function update "Design Briefs" --hand-off-to "Kevin" --hand-off-task "Design the garment this brief describes"', '/function remove "Marketing and Advertising"'], ["A Function is ongoing; each individual execution is a Task.", "--follow-on on lets a Function add to its own work: when one of its Tasks finishes, an AI model decides whether more is needed and Arturo creates it, up to three Tasks deep, carrying the same supplied documents. It is off unless you turn it on, and a Task that failed never leads to more.", "--pass-on-to sends each result to another business function's AI worker to be checked before a person signs it off; the result and the check then come to the person together, and only the result is signed off. Only someone who can sign off work may set it (--as), the other business function must have an AI worker that cannot reach outside Arturo without asking first, and a check is never passed on again. --pass-on off brings results straight to a person; --pass-on never does too, and stops any single task from sending them on.", "--route-step, given once for each step in order (at most 2), sends each result along a route: each step's AI worker works from the one before, as the instruction after the colon says, and every document comes to a person to sign off on its own. Arturo stops for the first result's sign-off before the route goes on unless --route-stop-first off, and stops the route itself when another of the business's clients is named in the work. Steps go only to business functions of this business whose AI worker cannot reach outside Arturo without asking first, each once, never to one set to never pass on. Stop a running route with /task stop-route.", "--hand-off-to and --hand-off-task send each result to a person once it is signed off: it becomes a Human Task for them, carrying the result and its documents. Only a sign-off triggers it, from the terminal or the browser, and each result is handed over once. Results signed off before the hand-off was set are not sent.", "Removal refuses while the Function is running or still owns unfinished Tasks.", "Removal releases staffing but preserves completed Tasks, Events, approvals, and Timeline records."]),
  help("/staff", "Generate an Enterprise-specific, AI-assisted staffing proposal.", ['/staff [--enterprise "<enterprise-name-or-id>"] [--instructions "<planning-constraints>"]'], ["/staff", '/staff --instructions "Do not invent Human approvers."'], ["When exactly one Enterprise exists, --enterprise may be omitted.", "A selected plan is advisory until you answer yes.", "Which AI model writes the plan is chosen with /model, and holds until you change it there.", "If paid escalation is configured and the local model repeatedly returns an unusable plan, Arturo may spend one paid external call here. It says so when it does; set ARTURO_PAID_ESCALATION_ENABLED=false to prevent it.", "A Function may be staffed by a team of Workers whose archetypes together cover what it needs; Workers never receive capabilities directly. Arturo fills any capability a plan leaves uncovered with an extra Worker marked for review."]),
  help("/model", "Choose which AI model Arturo uses, by number, in plain words.", ["/model"], ["/model"], ["Lists the models on this computer first — they are free to use.", "A model that needs downloading, or an external paid service, is only ever used after you say yes to a question that names the cost.", "Arturo never uses a paid model unless you choose one here, and paid calls stay inside the session limit.", "The choice is remembered next time you open Arturo."]),
  help("/start-functions", "Legacy batch shortcut that starts every staffed Function passing readiness checks.", ['/start-functions --ready [--enterprise "<enterprise-name-or-id>"]'], ['/start-functions --ready --enterprise "Koru Kids"'], ["Prefer /function start for a clear one-Function-at-a-time flow.", "Functions blocked by missing required coverage or approval remain stopped."]),
  help("/suggest", "Ask Arturo to propose bounded Tasks a staffed Function could do now.", ['/suggest [--function "<function-name-or-id>"] [--enterprise "<enterprise>"]'], ["/suggest", '/suggest --function "Client Intake"'], ["When exactly one Function exists, --function may be omitted.", 'Reply "yes" to create every suggestion, a list such as "1,3" to create some, or "no" to create none.', "Suggestions are unverified model output, not checked business advice.", "Accepting a suggestion creates an ordinary Task, subject to the same routing and Governance as /task create."]),
  help("/ask", "Submit a one-off plain-English objective to Arturo's workflow planner.", ['/ask "<objective>"'], ['/ask "Compare three launch options and identify missing evidence."']),
  help("/start", "Start a drafted workflow plan and create its Tasks.", ["/start <workflow-run-id>"], ["/start run-1"], ["/ask drafts a plan without executing it; /start is what turns the plan into Tasks.", "The run ID is printed by /ask when the plan is created."]),
  help("/workflow", "Create a reusable model-planned or explicitly ordered multi-Worker Workflow.", ['/workflow "<workflow request>"', '/workflow create "<name>" [--objective "<objective>"] --step "<worker>" "<instruction>" [--step "<worker>" "<instruction>" ...]'], ['/workflow "Create a five-step product launch review"', '/workflow create "Fast Fashion Production" --objective "Turn supplied trend evidence into approved design files and a bounded costing." --step "Trend Evidence Researcher" "Summarize only supplied dated trend evidence." --step "Design Brief Creator" "Create design briefs from the preceding evidence." --step "Design File Creator" "Create exact text-and-image design files and attach them as Artefacts." --step "Design Approver" "Review every exact Artefact version." --step "Material Cost Analyst" "Calculate quantities and costs only from approved design specifications and supplied prices."'], ["The explicit create form makes no planning-model call and preserves the named order.", "Use /run <workflow-name> to start the saved Workflow."]),
  help("/run", "Start a saved Workflow and progress through its AI, Human Task, and Human review steps.", ['/run [--auto-workers] <workflow-name> ["<run-context>"] [--enterprise "<enterprise>"] [--input-artefact <id@version[,id@version]>]'], ['/run fast-fashion-production', '/run fast-fashion-production "Create two designs for the supplied youth collection."'], ["Run /run on its own to pick a Workflow and be asked the rest.", "Use the normalized name printed by /workflow.", "Human work and exact Artefact review pause the sequence until the required Human action is recorded.", 'A Web Search workflow step must contain a line beginning "Web search query:" and its AI Worker must have web-research capability.']),
  help("/workers", "List, inspect, or safely remove registered AI and Human Workers.", ["/workers", '/workers inspect "<worker-name>"', '/workers remove "<worker-name>"'], ["/workers", '/workers inspect "Resource Development Analyst"', '/workers remove "Old Research Worker"'], ["/workers lists every Worker, so nothing is hidden behind a filter.", "Removal preserves historical Tasks, Events, decisions, and chat records.", "System Workers and Workers referenced by unfinished Tasks, Workflows, or Human Tasks cannot be removed."]),
  help("/archetypes", "Compare Worker archetypes or inspect their capabilities and prompt guardrails.", ["/archetypes", "/archetypes <archetype>"], ["/archetypes", "/archetypes guardian"], ["Archetypes guide routing and model behaviour. They are not permissions, qualifications, or proof of expertise."]),
  help("/capabilities", "List Arturo's canonical Worker-routing capabilities or explain one capability.", ["/capabilities", "/capabilities <capability>"], ["/capabilities", "/capabilities safety"], ["A capability is routing metadata, not a tool permission, qualification, or proof of expertise."]),
  help("/add-ai-worker", "Register an AI Worker with an archetype and optional specialization.", ['/add-ai-worker "<name>" --archetype <archetype> [--refine "<specialization>"]'], ['/add-ai-worker "Curriculum Research Worker" --archetype researcher', '/add-ai-worker "Fashion Web Researcher" --archetype researcher --refine "Use captured public sources and label uncertainty."', '/add-ai-worker "Girls Softball Coach" --archetype coach --refine "You specialise in coaching softball for girls under 15."'], ["Use an organizational role as the Worker name, not a model name.", "Every Worker uses the model chosen with /model; a Worker does not carry its own.", "Capabilities come only from the selected archetype; run /archetypes to compare them.", "An archetype capability does not bypass connector configuration, call allowance, or Governance.", "The older positional form remains accepted only for existing scripts."]),
  help("/workflow-run", "Queue deterministic work through normal governance.", ['/workflow-run <name> "<input>" [--enterprise <id>]'], ['/workflow-run Formatter "Matter 12"'], ["Requires an available workflow Worker owned by the selected Enterprise, or a legacy unowned Worker."]),
  help("/workflow-worker", "Register a bounded deterministic conversion Worker.", ["/workflow-worker <name> <definition.json>"], ['/workflow-worker Formatter workflow.json'], ["Definitions contain version 1 template or json-select steps. No models or external tools."]),
  help("/worker-availability", "Set whether a Worker accepts new work.", ["/worker-availability <name> <available|busy|offline>"], ['/worker-availability Formatter offline'], ["Busy and offline accept no new work; running work is unchanged."]),
  help("/add-human-worker", "Register a Human Worker with optional role guidance, contact metadata, availability, and specialization.", ['/add-human-worker "<name>" [--archetype <archetype>] [--email "<email>"] [--availability <available|busy|offline>] [--refine "<specialization>"]'], ['/add-human-worker "Kevin" --archetype guardian --availability available', '/add-human-worker "Mia" --archetype creator --email "mia@example.com" --availability busy --refine "Creates production-ready garment design files."'], ["Human Workers do not use models at all.", "Registration does not verify identity, employment, email ownership, or professional authority."]),
  help("/refine-worker", "Update a Worker's specialization using the supported refinement workflow.", ['/refine-worker "<worker-name>" "<refinement>"'], ['/refine-worker "Curriculum Research Worker" "You are a curriculum researcher who reasons only from supplied evidence and labels what is uncertain."']),
  help("/functions", "List the ongoing Functions.", ["/functions"], ["/functions"], ["Every Function is listed, with the business it belongs to.", "Use /tasks to see bounded work created by running Functions."]),
  help("/jobs", "Compatibility alias for /functions.", ["/jobs"], ["/jobs"], ["Prefer /functions for new commands. Existing scripts remain supported."]),
  help("/job", "Compatibility alias for /function.", ['/job create "<name>" --enterprise "<enterprise>" [--objective "<objective>"] [--description "<description>"]', '/job inspect "<name-or-id>" [--enterprise "<enterprise>"]', '/job start "<name-or-id>" [--enterprise "<enterprise>"]'], ['/job create "Science Discovery" --enterprise "Science Tracker" --objective "Find the latest public science news."'], ["Prefer /function for new commands. Existing scripts remain supported.", "For compatibility, /job <old-task-id> still opens an execution record."]),
  help("/tasks", "List bounded Tasks and their current state, routing, evidence, and result preview.", ["/tasks", "/tasks all"], ["/tasks", "/tasks all"], ["/tasks shows the 8 oldest and says how many more there are.", "A completed Task is not necessarily verified evidence."]),
  help("/task", "Create one bounded Task for an ongoing Function, or inspect one complete Task record.", ['/task create "<one-clear-outcome>" [--function "<function>"] [--job "<job>"] [--enterprise "<enterprise>"] [--search-query "<query>"] [--input-artefact <id@version[,id@version]>] [--after-artefact-approval <id@version[,id@version]>] [--procedure <proc-id@version>] [--follows <task-id|human-task-id>] [--pass-on <business-function|off>] [--write-only]', '/task inspect "<task-id>"', '/task retry "<task-id>"', '/task reply <task-id> "<your reply>" [--as "<human-worker>"]', '/task signoff <task-id> [--as "<human-worker>"]', '/task setaside <task-id> "<why>" [--as "<human-worker>"]', '/task stop-route <task-id> --as "<your name>"'], ['/task create "Review the supplied toy evidence and list release-blocking gaps."', '/task inspect "59ae73e7-affc-40e8-9f49-3b6962f5c18f"', "/task retry task-1", '/task reply task-1 "Use recycled cardboard, 20cm x 20cm, minimum order 500."', "/task signoff task-1", '/task setaside task-3 "No agreement was attached."'], ["/task reply sends additional context in response to a finished Task (for example when an AI Worker asked for missing details) and creates a fresh governed Task carrying forward the original instruction, Function, and documents.", "/task signoff records that a named person has read a finished result and accepts it. It is separate from /approve, which on governed work only lets the work start. A sign-off is signed, is tied to the exact text of the result, and may only be given by someone who can sign off work and give go-aheads for that Function. It records acceptance; it does not prove the result is correct.", "/task setaside records that a named person read a finished result and did not accept it, with their reason. It is signed and tied to the exact text, may only be given by someone who could sign it off, takes the result off the list of results waiting for a sign-off, and means it can no longer be signed off or handed on. Ask for the work again if it is still needed.", "/task retry creates a failed Task again as a new Task with the same instruction, Function and supplied Artefacts. It is routed and governed afresh, so an approval given to the failed Task does not carry over. It is refused for a Task that searched the web, followed earlier work, waited on an Artefact approval, ran a Procedure or was a Workflow step; create those again with /task create.", "Every Task belongs to one ongoing Function.", "Arturo infers the Function only when one is clearly suitable; use --job to choose explicitly.", "Task capabilities are derived from the Function's staffed Worker.", "--procedure references a versioned, governed Procedure (proc-id@version) that supplies how to perform the Task; the Worker must hold every capability the Procedure declares or the Task fails closed.", "Governance may place the Task in awaiting-approval state.", "--follows carries a finished Task's result, or a person's notes from a completed Human Task, into this Task's context — so what a person observed reaches the Worker without being retyped into the instruction.", "--follows needs a result written by AI to have been signed off first, unless its business function passes its results on to be checked (/function update --pass-on-to).", "--pass-on chooses for this Task alone where its result goes before a person signs it off: another business function's AI worker to check it first, or off to bring it straight back (and off its business function's route). It is refused for a Function set to never pass its results on, and the result always comes to a person to sign off in the end.", "/task stop-route stops a route's run from any of its Tasks: nothing more on it starts, and what was written comes to a person to sign off. Only someone at the business who can sign off work may stop it."]),
  help("/task-cap", "Compatibility alias for /task.", ["/task-cap", '/task-cap "<one-clear-outcome>" [--job "<job>"]'], ["/task-cap", '/task-cap "Compare the supplied options." --job "Product Safety"'], ["Prefer /task for new commands.", "Run it on its own to be asked what you want done.", "The --capability and --bounded-task flags this alias was named after no longer exist; capabilities come from the Function's staffed Worker."]),
  help("/chat", "Talk to an AI Worker in read-only mode.", ['/chat "<worker-name>" "<message>"', '/chat with "<worker-name>"', "/chat status", "/chat end", '/chat history "<worker-name>"', '/chat clear "<worker-name>"'], ['/chat "Curriculum Research Worker" "What is your current focus?"', "/chat end"], ["Worker chat is read-only and model responses remain unverified.", "Chat history is persisted locally."]),
  help("/artefacts", "List versioned file and external-reference Artefacts.", ["/artefacts"], ["/artefacts"], ["Every Artefact is listed, with the business it belongs to.", "Arturo stores references and integrity metadata; it does not copy, upload, or preview the source files."]),
  help("/artefact", "Add, version, inspect, verify, submit, and review exact Artefact versions.", ['/artefact add "<name>" --enterprise "<enterprise>" --kind <kind> (--file "<path>"|--uri "<https-url>") --created-by "<worker>" [--task <task-id>] [--human-task <human-task-id>] [--media-type "<type>"] [--sha256 <hash>] [--notes "<notes>"]', '/artefact version <artefact-id> (--file "<path>"|--uri "<https-url>") --created-by "<worker>" [--task <task-id>] [--human-task <human-task-id>] [--media-type "<type>"] [--sha256 <hash>] [--notes "<notes>"]', "/artefact inspect <artefact-id> [--version <number>]", "/artefact verify <artefact-id>@<version>", '/artefact submit <artefact-id>@<version>[,...] --reviewer "<human-worker>" [--notes "<instructions>"]', '/artefact review <artefact-id>@<version>[,...] --decision <approve|reject|revise> --as "<human-worker>" --notes "<reason>"', '/artefact watch add "<folder>" --function "<function>" --enterprise "<enterprise>" --task "<instruction>" --created-by "<person>" [--each "<list>" --first <number>]', "/artefact watch list", "/artefact watch remove <watch-id>"], ['/artefact add "Look 01 design" --enterprise "Threadline Fashion" --kind design --file "./designs/look-01.svg" --created-by "Design File Creator" --human-task human-task-1', '/artefact submit artefact-1@1 --reviewer "Design Approver"', '/artefact review artefact-1@1 --decision approve --as "Design Approver" --notes "Approved for costing."'], ["Use exact id@version references for every handoff and review.", "The older --job execution-ID flag and --task Human-Task form remain accepted for existing scripts.", "External URLs are not fetched or independently verified.", "/artefact watch has Arturo register each new file that arrives in a folder and hand it to one Task, as if both commands had been typed. It is for material gathered by a script or another program. Arturo reads the files; it never runs them and does not follow links out of the folder. Files already there are left alone, and files are picked up only while Arturo is running. Each Task is routed and governed like any other.", "With --each and --first, a JSON file is not handed over whole: Arturo takes the first few entries of the named list, in the file's own order and with no AI model involved, and creates one Task for each, given only that entry. Arturo does not rank the entries; the program that wrote the file does."]),
  help("/memory", "Inspect, add, or remove Operational Memory with explicit scope.", ["/memory", '/memory add "<entry>" --scope "<enterprise-or-job|global>"', "/memory remove <memory-id>"], ['/memory add "Use imaginative play as the core learning approach." --scope "Koru Kids"', "/memory"], ["Human-entered Memory is an assertion, not independently verified evidence."]),
  help("/event", "Publish an organizational Event manually, or manage deterministic rules that publish after eligible Tasks complete.", ['/event publish "<event-name>" --source "<job>" --enterprise "<enterprise-name>"', '/event rule add --when task.completed --job "<job>" [--capability <id>] --publish "<event-name>" [--enterprise "<enterprise>"]', "/event rule list", "/event rule inspect <event-rule-id>", "/event rule remove <event-rule-id>"], ['/event publish "New toy concept submitted" --source "Resource Development" --enterprise "Koru Kids"', '/event rule add --when task.completed --job "Science Discovery" --capability web-research --publish "Science evidence ready" --enterprise "Science Tracker"', "/event rule list"], ["Quote names containing spaces.", "A rule applies only to Tasks owned by the selected ongoing Function.", "For web-research, Arturo publishes only after the captured search evidence file passes its hash and provenance checks and contains at least one result.", "The model cannot publish the Event itself. Arturo's deterministic operating process applies the stored rule once per Task."]),
  help("/schedule", "Create, inspect, list, or remove a persistent daily or weekly Schedule for one bounded Task.", ['/schedule add "<one-clear-outcome>" [--function "<function>"] [--job "<job>"] [--enterprise "<enterprise>"] [--every <daily|monday|tuesday|wednesday|thursday|friday|saturday|sunday>] --at "HH:MM" --timezone "<IANA-timezone>" [--search-query "<query>"]', '/schedule list [--enterprise "<enterprise>"]', "/schedule inspect <schedule-id>", "/schedule remove <schedule-id>"], ['/schedule add "Verify the weekly code backup" --every friday --at "18:00" --timezone "Pacific/Auckland" --job "Back up code" --enterprise "Code Keeper"', '/schedule add "Retrieve current public science news" --every daily --at "09:00" --timezone "Pacific/Auckland" --job "Science Discovery" --enterprise "Science Tracker" --search-query "latest public science news"', '/schedule list --enterprise "Science Tracker"'], ["Schedule creation creates a dormant Task immediately; it cannot run before its first due occurrence.", "When due, Arturo queues the Task and the Worker runtime alone changes it to running.", "Later occurrences reuse the Task only after it completes; an unfinished Task causes a recorded skip.", "The Task's Function provides staffing and capability context, but the Function itself is never scheduled.", "For web research, the Task outcome and Worker need web-research capability and /web-search must report Ready: yes.", "If Arturo was not running at the due time, the persistent Schedule queues one missed occurrence when Arturo next starts, then advances to the next occurrence.", "Remove stops future occurrences but preserves prior occurrence history and the Task."]),
  help("/events", "List the durable organizational Event history.", ["/events"], ["/events"]),
  help("/health", "Compute operational Health for one ongoing Function.", ['/health "<function-name-or-id>"'], ['/health "Curriculum Development"'], ["Health reflects Arturo's operational indicators, not external business truth."]),
  help("/governance", "Inspect Governance or manage deterministic policies.", ["/governance", "/governance policy list", '/governance policy add "<description>" --effect <allow|deny|require-approval> --capability "<id>" [--risk <low|medium|high>] [--role <admin|operator|auditor|worker>] [--boundary <trusted|restricted|external|untrusted>] [--scope <enterprise|global>] [--enterprise "<enterprise-name-or-id>"]', '/governance policy inspect "<policy-id-or-description>"', '/governance policy remove "<policy-id-or-description>"'], ['/governance policy add "Toy safety work requires human review" --effect require-approval --capability "safety" --enterprise "Koru Kids"', "/governance policy list"]),
  help("/approvals", "List pending and recorded approval decisions.", ["/approvals"], ["/approvals"]),
  help("/setup", "Set up a business in four steps, starting with its name and mission.", ['/setup', '/setup "<business name>" --owner "<your name>" --about "<what the business does>"'], ['/setup', '/setup "Harbour Legal" --owner "Amy Chen" --about "Sole law practice: commercial leases and property"']),
  help("/assistant", "See who takes down new clients, have Arturo propose an AI worker for them, or hand new clients to a person.", ["/assistant", '/assistant create --as "<your name>"', '/assistant assign "<person>" --as "<your name>"'], ["/assistant", '/assistant create --as "Amy Chen"', '/assistant assign "Sarah Jones" --as "Amy Chen"']),
  help("/talk", "Tell your assistant about a new client in your own words.", ['/talk "<what you want to tell it>" --as "<your name>"'], ['/talk "Just had Jane Smith on the phone, 021 555 0101, about her lease" --as "Amy Chen"', '/talk "yes" --as "Amy Chen"']),
  help("/client", "Add a client directly, after checking for one already recorded who may be the same.", ['/client add "<name>" [--email "<email>"] [--phone "<phone>"] [--address "<address>"] [--notes "<notes>"] [--detail "<label>: <value>"]... [--as "<your name>"] [--confirm-new]'], ['/client add "Jane Smith" --phone "021 555 0101" --detail "Matter: Lease review" --as "Amy Chen"'], ["Usually you tell your assistant instead, with /talk; it saves through this same step."]),
  help("/clients", "List a business's clients.", ["/clients [--enterprise \"<business>\"]"], ["/clients"]),
  help("/work", "Open named work (a matter, a book or a deal), list or inspect it, turn \"no AI\" on for it, or cancel it.", ['/work create "<name>" --kind matter|book|deal|work [--client <client-id>] [--number <matter-number>] [--type <work-type>] [--parent <work-id>] [--no-ai] [--replaces <work-id>] [--separate] [--leave-ai-off] [--as "<your name>"]', "/work list", "/work types", "/work inspect <work-id>", '/work no-ai <work-id> on [--confirm] --as "<your name>"', '/work cancel <work-id> --as "<your name>" --reason "<why>" [--confirm]', '/work type <work-id> <work-type> --as "<your name>" [--reason "<why>"]', '/work type-reason <work-id> --as "<your name>" --reason "<why>"'], ['/work create "Smith lease" --kind matter --client client-1 --number HL-2026-014 --type property --as "Amy Chen"', "/work no-ai work-1 on --confirm --as \"Amy Chen\"", '/work cancel work-1 --as "Amy Chen" --reason "Client withdrew instructions." --confirm'], ["Only someone who can sign off work can cancel it, with a reason. Cancelling a book cancels its deals. Nothing is deleted, and cancelled work can't be reopened.", "Reusing a cancelled matter's number, or replacing a cancelled book or deal, needs --replaces naming the cancelled work; \"no AI\" and a locked type carry over from it. --separate says a book or deal with a cancelled one's title is new work; --no-ai or --leave-ai-off answers whether to turn \"no AI\" on.", "A locked work type never changes to an unlocked one. Locked to locked needs someone who can sign off, with a reason; unlocked to locked (tightening) is anyone's, and the reason never holds up the lock; a reason added later goes in its own signed entry with /work type-reason. Every type change makes sign-offs fall away and sets aside running results.",
    "Turning \"no AI\" off, changing between unlocked work types, reopening a cancelled locked matter's number as an unlocked type, paid escalation, the law-practice setting and work types are owner-only, with a typed reason, and are refused at the terminal.", "On a law-practice account, only a matter with --number and --type can be opened."]),
  // --as was missing from both usage strings while the product accepted it, the
  // refusal in functionApprovers.ts printed it as the corrected command, and bot
  // mode depends on it. Naming who decided is the whole point of the flag.
  help("/approve", "Approve a governed Task using the configured signing controls.", ['/approve <task-id> [--as "<human-worker>"]'], ["/approve e78c5502-193b-4039-9f9d-6e419b83d6aa"], ["Approval authorizes execution; it does not verify the eventual model output.", "Arturo attributes the decision automatically when exactly one person may approve; --as names the approver when more than one could."]),
  help("/reject", "Reject a governed Task and record the reason.", ['/reject <task-id> "<reason>" [--as "<human-worker>"]'], ['/reject e78c5502-193b-4039-9f9d-6e419b83d6aa "Required evidence is missing."']),
  help("/approval-status", "Inspect the approval chain for one Task.", ["/approval-status <task-id>"], ["/approval-status e78c5502-193b-4039-9f9d-6e419b83d6aa"]),
  help("/human-tasks", "List Human Tasks and their current states.", ["/human-tasks"], ["/human-tasks"], ["Use /human-task <id> to inspect instructions and /complete-human-task <id> to record completion."]),
  help("/human-task", "Inspect one Human Task, its instructions, notes, and available actions.", ["/human-task <task-id>"], ["/human-task human-task-1"]),
  help("/create-human-task", "Create and optionally assign a Human Task, handing over a finished Task's result and exact input Artefacts.", ['/create-human-task "<title>" "<instructions>" [--assign-to "<human-worker>"] [--artefact <id@version[,id@version]>] [--purpose "<purpose>"] [--follows <task-id>]'], ['/create-human-task "Pick and pack order 4472" "Follow the packing instructions, and record anything that did not match." --assign-to "Warehouse Lead" --follows task-2']),
  help("/complete-human-task", "Complete a Human Task, preserve attribution, and attach exact output Artefacts.", ['/complete-human-task <task-id> "<notes>" [--as "<human-worker>"] [--artefact <id@version[,id@version]>]'], ['/complete-human-task human-task-1 "Created two SVG design files and recorded material specifications." --as "Design File Creator" --artefact artefact-2@1,artefact-3@1']),
  help("/block-task", "Mark a Human Task blocked and record why.", ['/block-task <task-id> "<reason>"'], ['/block-task human-task-1 "Waiting for an independent accessibility review."']),
  help("/revise-task", "Return a Human Task for revision with explicit instructions.", ['/revise-task <task-id> "<revision-instructions>"'], ['/revise-task human-task-1 "Attach component dimensions and material specifications."']),
  help("/delegation", "Delegate one bounded Task between ongoing Functions in the same Enterprise.", ['/delegation request "<bounded-work>" --from "<job>" --to "<job>" [--enterprise "<enterprise-name-or-id>"]', "/delegation list", "/delegation inspect <delegation-id>"], ['/delegation request "Prepare three accessible component options with material constraints" --from "Curriculum Development" --to "Resource Development" --enterprise "Koru Kids"'], ["Use --enterprise when Function names could be ambiguous.", "The requesting Function retains accountability.", "Cross-Enterprise delegation is not currently supported."]),
  help("/timeline", "Show recent audit Timeline records in reverse chronological order.", ["/timeline"], ["/timeline"], ["Use /events for the broader organizational Event view."]),
  help("/models", "Same as /model: choose which AI model Arturo uses.", ["/models"], ["/models"], ["Kept as an alias so both spellings work."]),
  help("/model-routing", "Inspect the effective local-first policy, approved aliases, and external-call session cap.", ["/model-routing"], ["/model-routing"], ["External escalation is disabled unless every required environment setting is present.", "Configuration readiness does not prove live provider quota or availability.", "Automatic escalation is limited to repeated structured-output validation failure; /next and /staff can also use an approved alias after an explicit user command."]),
  help("/web-search", "Inspect governed Web Search configuration, domain policy, and process-local call usage.", ["/web-search"], ["/web-search", "/capabilities web-research"], ["This view makes no search or model call.", "Use /task create with the web-research capability to perform a search.", "Result snippets are captured as evidence but remain unverified until important source pages are checked."]),
  help("/clear", "Clear the terminal display without deleting Arturo records.", ["/clear"], ["/clear"]),
  help("/reset", "Delete application state and return Arturo to first-use state.", ["/reset"], ["/reset"], ["This is destructive. It clears Enterprises, ongoing Functions, Workers, bounded Tasks, Events, Schedules, Memory, chat history, approvals, Human Tasks, and Delegations."]),
  help("/help", "Show the command overview or detailed help for one command.", ["/help", "/help <command>"], ["/help", "/help delegation"]),
  help("/exit", "Stop the native terminal interface.", ["/exit"], ["/exit"]),
];

export const UI_HELP_GROUPS: readonly UiCommandHelpGroup[] = [
  { title: "Start and design", commands: ["/overview", "/setup", "/enterprise", "/functions", "/function", "/staff", "/suggest"] },
  // /start, /workflow and /run are not here. The multi-Worker Workflow
  // subsystem has no scenario running it end to end, so the primary guide
  // stopped advertising three commands nothing proves. They still work, still
  // have help of their own, and still appear under /help all with the other
  // developer surface. /ask stays: it is the plain-English way in, and a
  // scenario now runs it.
  { title: "Clients", commands: ["/talk", "/assistant", "/clients", "/client", "/work"] },
  { title: "Workers and work", commands: ["/workers", "/archetypes", "/capabilities", "/add-ai-worker", "/add-human-worker", "/refine-worker", "/tasks", "/task", "/chat", "/ask"] },
  { title: "Knowledge and operations", commands: ["/artefacts", "/artefact", "/memory", "/event", "/schedule", "/events", "/health", "/delegation", "/timeline", "/web-search", "/model", "/model-routing"] },
  { title: "Governance and people", commands: ["/governance", "/approvals", "/approve", "/reject", "/approval-status", "/human-tasks", "/human-task", "/create-human-task", "/complete-human-task", "/block-task", "/revise-task"] },
  { title: "Terminal", commands: ["/clear", "/reset", "/help", "/exit"] },
];

/**
 * Current primary commands the grouped /help screen does not list.
 * They still work, still have /help <command> detail, and guides may teach them.
 */
export const UI_HIDDEN_PRIMARY_COMMANDS: readonly string[] = ["/next"];

export const UI_PRIMARY_COMMANDS = [
  ...UI_HELP_GROUPS.flatMap((group) => group.commands),
  ...UI_HIDDEN_PRIMARY_COMMANDS,
];

/**
 * Older names Arturo still accepts, each with a current replacement.
 *
 * Explicit, because the alternative — "everything the catalog defines that the
 * primary groups omit" — silently reclassified /start, /workflow and /run as
 * older names the moment they moved to the developer surface. They are current
 * commands with nothing to use instead, and a guide that files them under "Use
 * instead" teaches the wrong thing about all three.
 */
export const UI_ALIAS_COMMANDS: readonly string[] = [
  "/jobs",
  "/job",
  "/start-functions",
  "/task-cap",
  "/models",
];

/**
 * Current, documented commands the primary guide does not advertise.
 *
 * The guide lists what a scenario runs. These work and `/help <command>`
 * explains each, but nothing exercises them end to end — so documentation may
 * mention them, and a walkthrough should not hand one to a newcomer.
 */
export const UI_BEYOND_PRIMARY_COMMANDS: readonly string[] = UI_COMMAND_HELP
  .map((entry) => entry.command)
  .filter(
    (command) =>
      !UI_PRIMARY_COMMANDS.includes(command) &&
      !UI_ALIAS_COMMANDS.includes(command)
  );

export function normalizeHelpCommand(value: string): string {
  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

export function findUiCommandHelp(value: string): UiCommandHelp | undefined {
  const command = normalizeHelpCommand(value);
  return UI_COMMAND_HELP.find((entry) => entry.command === command);
}

const PREREQUISITES: Readonly<Record<string, readonly string[]>> = {
  "/next": ["An Enterprise with a meaningful mission."],
  "/function": ["An Enterprise for create and Enterprise-scoped list operations."],
  "/staff": ["An Enterprise with at least one ongoing Function.", "A working configured model provider."],
  "/start-functions": ["Ongoing Functions with the required Worker and approval coverage."],
  "/ask": ["A working configured model provider and suitable Workers."],
  "/workflow": ["For model-generated Workflows: a working model provider.", "For explicit Workflows: every named Worker must already be registered with an archetype."],
  "/run": ["A saved Workflow name printed by /workflow.", "The Workers required by every step must be registered."],
  "/workers": ["A registered Worker is required for inspect or remove. Removal also requires that no unfinished work references the Worker."],
  "/archetypes": ["None."],
  "/capabilities": ["None."],
  "/model": ["None."],
  "/models": ["None."],
  "/web-search": ["For execution: configure Brave Search or SearXNG and a positive process-local call allowance.", "Register an AI Worker with the explicit web-research capability.", "Use an Enterprise-scoped Task so evidence ownership is unambiguous."],
  "/refine-worker": ["A registered Worker and non-empty refinement instructions."],
  "/job": ["An Enterprise for create operations; an existing Function for inspect, update, or start."],
  "/tasks": ["None."],
  // Capabilities stopped being requested by hand; they come from the Worker
  // staffed on the owning Function, so the prerequisite is the staffing, not a
  // capability the operator names.
  "/task": ["For create: an ongoing Function with a staffed Worker (use /staff). For inspect: a Task ID from /tasks."],
  "/task-cap": ["The same as /task: an ongoing Function with a staffed Worker."],
  "/chat": ["A registered AI Worker. Model-backed requests need an available provider; the guided invoice flow does not."],
  "/artefacts": ["None."],
  "/artefact": ["For add and version: a registered creator and exactly one local file or HTTPS URI.", "For review: a configured APPROVAL_SIGNING_SECRET and the assigned registered Human reviewer."],
  "/memory": ["For add: an existing Enterprise, ongoing Function, or the explicit global scope.", "For remove: a Memory ID from /memory."],
  "/event": ["An Enterprise and source Function.", "For a Task-completion rule, the source Function must be running and the triggering Task must belong to it.", "A web-research rule also requires an intact governed Web Search evidence Artefact with at least one captured result."],
  "/schedule": ["A clear bounded Task outcome and an Enterprise or Function Arturo can resolve.", "A Task schedule is created dormant and needs no Worker assignment until it is due.", "At least one qualified staffed AI Worker should be available when the Task becomes due; Arturo reselects at each occurrence.", "For web research: a fixed --search-query, a Worker with web-research capability, and /web-search Ready: yes."],
  "/health": ["An ongoing Function name or ID."],
  "/governance": ["For Enterprise-scoped policy creation: an active Enterprise context."],
  "/approve": ["A pending governed Task.", "A valid APPROVAL_SIGNING_SECRET of at least 32 non-placeholder characters."],
  "/reject": ["A pending governed Task and a clear rejection reason.", "A valid APPROVAL_SIGNING_SECRET of at least 32 non-placeholder characters."],
  "/approval-status": ["A governed Task ID."],
  "/human-task": ["A Human Task ID from /human-tasks or /create-human-task."],
  "/complete-human-task": ["An open Human Task.", "Use --as with a registered Human Worker when attribution matters."],
  "/block-task": ["An open Human Task and a reason."],
  "/revise-task": ["A Human Task that can be returned for revision."],
  "/delegation": ["Two ongoing Functions in the same Enterprise.", "The receiving Function must be running and have a suitable AI Worker for executable delegated work."],
};

const EFFECTS: Readonly<Record<string, string>> = {
  "/overview": "Read-only. Builds a current executive view without changing state.",
  "/next": "Conditional. Generates recommendations; ongoing Functions are created only after confirmation.",
  "/enterprise": "Create and update change persistent state; inspect and list are read-only.",
  "/function": "Create and update change persistent state; inspect and list are read-only.",
  "/staff": "Conditional. Generates a proposal; Worker assignments are applied only after confirmation.",
  "/start-functions": "Legacy alias. Changes eligible Functions to running state.",
  "/ask": "Creates and may execute workflow work, Tasks, Events, and associated records.",
  "/workflow": "Creates and persists a reusable Workflow definition; it does not start execution.",
  "/run": "Creates a Workflow Run and its first Task; later steps may create Tasks, approval chains, and Human Tasks.",
  "/workers": "List, filter, and inspect are read-only. Remove deletes the Worker registration and its current staffing assignments after safety checks while preserving historical records.",
  "/worker": "Read-only.",
  "/archetypes": "Read-only. It displays built-in routing and prompt metadata.",
  "/capabilities": "Read-only. It displays canonical routing metadata and does not grant tools or permissions.",
  "/add-ai-worker": "Registers and persists an AI Worker; compatible queued Tasks may be assigned.",
  "/add-human-worker": "Registers and persists a Human Worker.",
  "/refine-worker": "Changes the selected Worker's stored specialization.",
  "/jobs": "Read-only. Lists ongoing Functions.",
  "/job": "Create, update, and start change persistent state; inspect and list are read-only.",
  "/tasks": "Read-only. Lists bounded Tasks.",
  "/task": "Create may create and execute a Task subject to Governance; inspect is read-only.",
  "/task-cap": "Creates a Task and may immediately route or execute it, subject to Governance.",
  "/chat": "Stores conversation messages. Read-only; does not create Tasks, change records, or sign off work or give go-aheads.",
  "/artefacts": "Read-only.",
  "/artefact": "Add and version create persistent records; submit creates a Human review task; review records a signed exact-version decision; inspect and verify are read-only.",
  "/memory": "List is read-only; add and remove change persistent Operational Memory.",
  "/event": "Manual publish creates a persistent Event immediately. Rule add and remove change deterministic configuration; a matching owned Task may later publish an Event and cause running Functions to create Tasks. List and inspect are read-only.",
  "/schedule": "Add creates a dormant Task and its persistent timing configuration; remove stops future occurrences. A due Schedule queues its Task, then the Worker runtime starts it only after normal routing and governance checks. An unfinished Task causes a recorded skip. List and inspect are read-only.",
  "/events": "Read-only.",
  "/health": "Computes and records a Health observation Event; it does not repair the Function.",
  "/governance": "Summary, list, and inspect are read-only apart from audit Events; add and remove change policy state.",
  "/approvals": "Read-only.",
  "/approve": "Records a signed approval and may release a Task for execution.",
  "/reject": "Records a signed rejection and prevents the pending Task from proceeding.",
  "/approval-status": "Read-only.",
  "/setup": "Creates a business, a Human Worker for the person who runs it, and ownership of that Worker.",
  "/assistant": "Without create, asks a model for the business's questions and creates nothing. Create makes an area of work, an AI Worker, its staffing and the person's approver role.",
  "/talk": "Stores the conversation; on a confirmed read-back, stores a client record and a finished Task.",
  "/client": "Add stores a client record.",
  "/clients": "Read-only.",
  "/work": "Create stores a signed work record and a change-log entry. No-ai on re-signs the record, logs the change and cancels every not-started Task on that work and its deals. List, types and inspect are read-only.",
  "/human-tasks": "Read-only.",
  "/human-task": "Read-only.",
  "/create-human-task": "Creates and persists an open Human Task, which carries the result of the Task named by --follows.",
  "/complete-human-task": "Completes a Human Task and stores notes and attribution.",
  "/block-task": "Changes a Human Task to blocked and records the reason.",
  "/revise-task": "Changes the Human Task workflow and records revision instructions.",
  "/delegation": "Request creates a Delegation and Task; list and inspect are read-only.",
  "/timeline": "Read-only.",
  "/model": "Changes only which model Arturo uses. Downloads and paid choices always ask first; nothing else is touched.", "/models": "Alias of /model.",
  "/model-routing": "Read-only. It never changes environment configuration or spends tokens.",
  "/web-search": "Read-only. The status command spends no search or model calls; Tasks requiring web-research perform the governed search.",
  "/clear": "Changes only the terminal display; Arturo records remain intact.",
  "/reset": "Destructive. Deletes application runtime state and cannot be undone by Arturo.",
  "/help": "Read-only.",
  "/exit": "Stops the current terminal process without deleting persistent state.",
};

const RELATED: Readonly<Record<string, readonly string[]>> = {
  "/overview": ["/next", "/functions", "/health", "/timeline"],
  "/next": ["/enterprise", "/function", "/staff", "/model", "/model-routing"],
  "/enterprise": ["/next", "/functions", "/overview"],
  "/function": ["/functions", "/staff", "/suggest", "/health"],
  "/staff": ["/workers", "/suggest", "/model", "/model-routing"],
  "/start-functions": ["/function", "/event"],
  // Not /start. The guide must not send an operator to a command it does not
  // list, and /start moved to /help all with the rest of the Workflow surface.
  // /ask's own help still explains that it stops at a plan and names /start.
  "/ask": ["/tasks", "/approvals", "/timeline"],
  "/workflow": ["/run", "/workers", "/tasks", "/human-tasks", "/artefacts"],
  "/run": ["/tasks", "/human-tasks", "/approvals", "/artefacts", "/timeline"],
  "/workers": ["/archetypes", "/capabilities", "/add-ai-worker", "/add-human-worker"],
  "/worker": ["/workers", "/archetypes", "/refine-worker", "/chat"],
  "/archetypes": ["/add-ai-worker", "/add-human-worker", "/workers", "/capabilities"],
  "/capabilities": ["/archetypes", "/workers", "/task", "/governance"],
  "/add-ai-worker": ["/archetypes", "/capabilities", "/model", "/workers", "/task", "/staff"],
  "/add-human-worker": ["/workers", "/approvals", "/human-tasks"],
  "/refine-worker": ["/workers", "/archetypes"],
  "/jobs": ["/job", "/staff", "/health"],
  "/job": ["/jobs", "/tasks", "/event"],
  "/tasks": ["/task", "/approvals", "/timeline"],
  "/task": ["/tasks", "/approval-status", "/chat"],
  "/task-cap": ["/task", "/tasks"],
  "/start": ["/ask", "/tasks", "/timeline"],
  "/suggest": ["/staff", "/task", "/tasks", "/schedule"],
  "/chat": ["/workers", "/task", "/tasks"],
  "/artefacts": ["/artefact", "/human-tasks", "/tasks"],
  "/artefact": ["/artefacts", "/human-task", "/approve", "/task"],
  "/memory": ["/event", "/task", "/timeline"],
  "/event": ["/events", "/tasks", "/function"],
  "/schedule": ["/tasks", "/task", "/function", "/web-search"],
  "/events": ["/event", "/timeline"],
  "/health": ["/function", "/functions", "/events"],
  "/governance": ["/task", "/approvals", "/timeline"],
  "/approvals": ["/approve", "/reject", "/approval-status"],
  "/approve": ["/approvals", "/approval-status", "/tasks"],
  "/reject": ["/approvals", "/approval-status"],
  "/approval-status": ["/approvals", "/task", "/timeline"],
  "/human-tasks": ["/human-task", "/create-human-task"],
  "/human-task": ["/complete-human-task", "/block-task", "/revise-task"],
  "/create-human-task": ["/human-tasks", "/human-task"],
  "/complete-human-task": ["/human-task", "/timeline"],
  "/block-task": ["/human-task", "/revise-task"],
  "/revise-task": ["/human-task", "/complete-human-task"],
  "/delegation": ["/functions", "/function", "/tasks", "/timeline"],
  "/timeline": ["/events", "/task", "/approval-status"],
  "/model": ["/next", "/staff", "/suggest", "/model-routing"],
  "/model-routing": ["/model", "/add-ai-worker", "/staff"],
  "/web-search": ["/capabilities", "/add-ai-worker", "/task", "/artefacts"],
  "/clear": ["/help"],
  "/reset": ["/overview", "/enterprise"],
  "/help": ["/overview"],
  "/exit": ["/help"],
};

export function getUiCommandGuidance(command: string): UiCommandGuidance {
  return {
    prerequisites: PREREQUISITES[command] ?? ["None."],
    effect: EFFECTS[command] ?? "See the command output for state changes.",
    related: RELATED[command] ?? [],
  };
}

/** Formats the primary command overview from the same catalog as the palette. */
export function formatPrimaryHelpText(): string {
  return [
    "Arturo command guide",
    "",
    "Use /help <command> for syntax, examples, prerequisites, and safety notes.",
    "Example: /help delegation",
    "",
    ...UI_HELP_GROUPS.flatMap((group) => [
      group.title,
      ...group.commands.map((command) => {
        const detail = findUiCommandHelp(command);
        return `  ${command.padEnd(20)} ${detail?.summary ?? ""}`;
      }),
      "",
    ]),
    "Names and sentences containing spaces must be quoted.",
    "Values such as <task-id> are placeholders; replace them with IDs from Arturo output.",
    "Legacy and low-level kernel commands are intentionally omitted from the primary terminal guide.",
  ].join("\n").trim();
}
