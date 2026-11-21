import { formatPrimaryHelpText } from "../ui/uiCommandHelp";

export type HelpCommandGroup = {
  readonly title: string;
  readonly commands: readonly string[];
};

/**
 * Purpose: Formats command groups for help output.
 *
 * Params:
 * - groups: Help command groups.
 *
 * Returns:
 * - Formatted help text.
 *
 * PURE: No side effects.
 */
export function formatHelpGroups(
  groups: readonly HelpCommandGroup[]
): string {
  return groups
    .map((group) =>
      [
        group.title,
        "",
        ...group.commands,
      ].join("\n")
    )
    .join("\n\n");
}

/**
 * Purpose: Creates default MVP help text.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Default MVP help text.
 *
 * PURE: No side effects.
 */
export function createDefaultHelpText(): string {
  return [
    formatPrimaryHelpText(),
    "",
    "Use /help all to show low-level developer commands.",
  ].join("\n");
}

/**
 * Purpose: Creates full help text.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Full grouped help text.
 *
 * PURE: No side effects.
 */
export function createFullHelpText(): string {
  return formatHelpGroups([
    {
      title: "Core",
      commands: [
        '/setup-user "<name>" [email]',
        '/add-ai-worker "<name>" --archetype <archetype> [--refine "<specialization>"]',
        '/add-human-worker "<name>" [--archetype <archetype>] [--email "<email>"] [--availability <available|busy|offline>] [--refine "<specialization>"]',
        '/ask "<request>"',
        "/memory",
        "/models",
        "/model-routing",
        "/web-search",
        "/workers",
        '/workers inspect "<worker-name>"',
        '/workers --capability "<capability>"',
        '/workers remove "<worker-name>"',
        "/capabilities [<capability>]",
        "/reset",
        "/exit",
      ],
    },
    {
      title: "Enterprises",
      commands: [
        '/enterprise create "<name>" [--mission "<mission>"]',
        '/enterprise inspect "<name-or-id>"',
        '/enterprise update "<name-or-id>" --description "<description>"',
        "/enterprise list",
      ],
    },
    {
      title: "Ongoing Functions",
      commands: [
        '/job create "<name>" --enterprise "<enterprise-name-or-id>" [--objective "<objective>"] [--description "<description>"]',
        '/job update "<name-or-id>" [--objective "<objective>"] [--description "<description>"] [--enterprise "<enterprise-name-or-id>"]',
        '/job inspect "<name-or-id>" [--enterprise "<enterprise-name-or-id>"]',
        '/job list [--enterprise "<enterprise-name-or-id>"]',
        '/job start "<name-or-id>" [--enterprise "<enterprise-name-or-id>"]',
      ],
    },
    {
      title: "Legacy low-level Function controls",
      commands: [
        "/start-function <function-id>",
        "/pause-function <function-id>",
        "/resume-function <function-id>",
        "/stop-function <function-id>",
        "/fail-function <function-id>",
      ],
    },
    {
      title: "Tasks and workflow inspection",
      commands: [
        "/tasks [--all]",
        '/task inspect "<task-id>"',
        '/task create "<one-clear-outcome>" [--job "<job>"] [--enterprise "<enterprise>"] [--search-query "<query>"] [--input-artefact <id@version[,id@version]>] [--after-artefact-approval <id@version[,id@version]>]',
        "/job-raw <id>",
        "/job-output <id>",
        "/timeline <run-id>",
        "/task-detail <id>",
        "/planner-plan <run-id>",
        "/workflow-runs",
        "/workflow-run <run-id>",
      ],
    },
    {
      title: "Human review",
      commands: [
        "/approve <task-id>",
        '/reject <task-id> "<reason>"',
        "/approval-status <task-id>",
      ],
    },
    {
      title: "Human tasks",
      commands: [
        "/human-tasks",
        "/human-task <id>",
        '/create-human-task "<title>" "<instructions>" [--assign-to "<human-worker>"] [--artefact <id@version[,id@version]>] [--purpose "<purpose>"]',
        '/complete-human-task <id> "<notes>" [--as "<human-worker>"] [--artefact <id@version[,id@version]>]',
        '/block-task <id> "<reason>"',
        '/revise-task <id> "<revision instructions>"',
      ],
    },
    {
      title: "Artefacts",
      commands: [
        "/artefacts [--enterprise <enterprise-name-or-id>]",
        '/artefact add "<name>" --enterprise "<enterprise>" --kind <design|evidence|specification|price-list|costing|other> (--file "<path>"|--uri "<https-url>") --created-by "<worker>"',
        '/artefact version <artefact-id> (--file "<path>"|--uri "<https-url>") --created-by "<worker>"',
        "/artefact inspect <artefact-id> [--version <number>]",
        "/artefact verify <artefact-id>@<version>",
        '/artefact submit <artefact-id>@<version>[,...] --reviewer "<human-worker>"',
        '/artefact review <artefact-id>@<version>[,...] --decision <approve|reject|revise> --as "<human-worker>" --notes "<reason>"',
      ],
    },
    {
      title: "Events",
      commands: [
        '/event publish "<event-name>" --source "<job>" --enterprise "<enterprise-name>"',
        '/event rule add --when task.completed --job "<job>" [--capability <id>] --publish "<event-name>" [--enterprise "<enterprise>"]',
        "/event rule list",
        "/event rule inspect <event-rule-id>",
        "/event rule remove <event-rule-id>",
        '/schedule add "<one-clear-outcome>" [--job "<job>"] [--enterprise "<enterprise>"] [--every <daily|weekday>] --at "HH:MM" --timezone "<IANA-timezone>" [--search-query "<query>"]',
        '/schedule list [--enterprise "<enterprise>"]',
        "/schedule inspect <schedule-id>",
        "/schedule remove <schedule-id>",
        "/events",
      ],
    },
    {
      title: "Notifications",
      commands: [
        "/notifications",
        "/notification <id>",
      ],
    },
    {
      title: "Archetypes",
      commands: [
        "/archetypes",
        "/archetype <name>",
      ],
    },
    {
      title: "Manual workflows",
      commands: [
        '/workflow "<workflow request>"',
        '/workflow create "<name>" [--objective "<objective>"] --step "<worker>" "<instruction>" [--step ...]',
        "/workflow <name> <a> <b> <c>",
        "/workflow-cap <name> <capability...>",
        '/run [--auto-workers] <workflow> ["<run-context>"] [--enterprise "<enterprise>"] [--input-artefact <id@version[,id@version]>]',
        '/run-cap <workflow> "<task>"',
        "/workflow-definitions",
        "/workflow-definition <id>",
      ],
    },
    {
      title: "Kernel and process tools",
      commands: [
        "/add-worker <name>",
        "/spawn <name>",
        "/spawn-sender",
        "/spawn-receiver",
        "/tick",
        "/ps",
        "/kernel-blog <topic>",
        '/run-workflow-definition <workflow-id> "<context>"',
        '/kernel-resolve <call-id> "<result>"',
        "/kernel-pending-calls",
        "/kernel-dispatchable-calls",
        "/kernel-dispatch <call-id>",
        "/process-result <pid>",
      ],
    },
    {
      title: "Replay and persistence",
      commands: [
        "/kernel-save",
        "/kernel-load",
        "/kernel-clear-snapshot",
        "/kernel-snapshot-status",
        "/replay-events",
        "/replay-state",
        "/replay-checkpoint",
        "/replay-history",
        "/replay-verify-checkpoint",
      ],
    },
    {
      title: "Legacy aliases",
      commands: [
        '/add-function <enterprise-id> "<function name>" "<objective>"',
        "/functions",
      ],
    },
    {
  title: "Governance",
  commands: [
    "/governance",
    "/approve <task-id>",
    '/reject <task-id> "<reason>"',
    "/approval-status <task-id>",
  ],
},
    {
      title: "Debug / experimental",
      commands: [
        "/demo",
        "/runs",
        "/run-log <id>",
      ],
    },
  ]);
}

/**
 * Purpose: Lists command names that are available in the REPL.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Known command names.
 *
 * PURE: No side effects.
 */
export function listKnownCommands(): readonly string[] {
  return [
    "/help",
    "/setup-user",
    "/add-ai-worker",
    "/add-human-worker",
    "/workers",
    "/worker",
    "/ask",
    "/tasks",
    "/task",
    "/functions",
    "/function",
    "/delegation",
    "/memory",
    "/models",
    "/model-routing",
    "/web-search",
    "/capabilities",
    "/next",
    "/events",
    "/event",
    "/schedule",
    "/health",
    "/enterprise",
    "/add-function",
    "/task-detail",
    "/start-function",
    "/pause-function",
    "/resume-function",
    "/stop-function",
    "/fail-function",
    "/task-cap",
    "/jobs",
    "/job",
    "/job-output",
    "/job-raw",
    "/timeline",
    "/human-tasks",
    "/human-task",
    "/revise-task",
    "/complete-human-task",
    "/block-task",
    "/create-human-task",
    "/archetypes",
    "/archetype",
    "/planner-plan",
    "/approve",
    "/reject",
    "/notifications",
    "/notification",
    "/add-worker",
    "/spawn",
    "/spawn-sender",
    "/spawn-receiver",
    "/tick",
    "/ps",
    "/workers",
    "/reset",
    "/workflow",
    "/workflow-cap",
    "/run",
    "/run-cap",
    "/workflow-runs",
    "/workflow-run",
    "/demo",
    "/runs",
    "/run-log",
    "/kernel-blog",
    "/run-workflow-definition",
    "/kernel-resolve",
    "/kernel-pending-calls",
    "/kernel-dispatchable-calls",
    "/kernel-dispatch",
    "/process-result",
    "/workflow-definition",
    "/kernel-save",
    "/kernel-load",
    "/kernel-clear-snapshot",
    "/kernel-snapshot-status",
    "/approval-status",
    "/replay-events",
    "/replay-state",
    "/replay-checkpoint",
    "/replay-verify-checkpoint",
    "/replay-history",
    "/exit",
  ];
}

/**
 * Purpose: Finds the likely slash-prefixed command for user input.
 *
 * Params:
 * - command: Raw command token.
 * - knownCommands: Known slash-prefixed commands.
 *
 * Returns:
 * - Suggested slash-prefixed command or undefined.
 *
 * PURE: No side effects.
 */
export function findMissingSlashSuggestion(
  command: string,
  knownCommands: readonly string[]
): string | undefined {
  if (command.startsWith("/")) {
    return undefined;
  }

  const slashCommand =
    `/${command}`;

  return knownCommands.includes(
    slashCommand
  )
    ? slashCommand
    : undefined;
}

/**
 * Purpose: Formats an unknown command message.
 *
 * Params:
 * - command: Unknown command token.
 * - knownCommands: Known slash-prefixed commands.
 *
 * Returns:
 * - User-facing unknown command message.
 *
 * PURE: No side effects.
 */
export function formatUnknownCommandMessage(
  command: string,
  knownCommands: readonly string[]
): string {
  const suggestion =
    findMissingSlashSuggestion(
      command,
      knownCommands
    );

  if (suggestion) {
    return [
      `unknown command: ${command}`,
      `Did you mean ${suggestion}?`,
    ].join("\n");
  }

  return [
    `unknown command: ${command}`,
    "Use /help to show available commands.",
  ].join("\n");
}
