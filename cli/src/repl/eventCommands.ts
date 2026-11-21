import {
  publishOrganisationalEventToRuntimes,
} from "../events/organisationalEventBus";

import {
  formatRuntimeSignalEvaluations,
} from "../runtime/businessFunctionRuntimeEvaluator";

import {
  listRuntimeEventStore,
} from "../runtime/runtimeEventStore";

import type {
  RuntimeEventRecord,
} from "../runtime/runtimeEventLog";

import {
  getEnterpriseByIdOrName,
  listEnterprises,
} from "../enterprise/enterpriseStore";

import {
  getBusinessFunctionDefinition,
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";

import {
  parseWorkerCapability,
} from "../control/workers";

import {
  addJobCompletionEventRule,
  getJobCompletionEventRule,
  listJobCompletionEventRules,
  removeJobCompletionEventRule,
} from "../events/jobCompletionEventRuleStore";

import type {
  JobCompletionEventRule,
} from "../events/jobCompletionEventRule";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

/**
 * Purpose: Formats an event timestamp as an unambiguous UTC date and time.
 *
 * Params:
 * - timestamp: Event timestamp in milliseconds.
 *
 * Returns:
 * - HH:MM timestamp.
 *
 * PURE: No side effects.
 */
export function formatEventTime(
  timestamp: number
): string {
  return `${new Date(timestamp).toISOString().slice(0, 16).replace("T", " ")}Z`;
}

/**
 * Purpose: Formats generic business Event type labels.
 *
 * Params:
 * - type: Runtime Event type.
 *
 * Returns:
 * - Human-readable business Event label.
 *
 * PURE: No side effects.
 */
export function formatBusinessEventType(
  type: string
): string {
  return type
    .replace(/^business\./, "")
    .split(".")
    .filter(
      (part) =>
        part.length > 0
    )
    .map(
      (part) =>
        part.slice(0, 1).toUpperCase() +
        part.slice(1)
    )
    .join(" ");
}

/**
 * Purpose: Formats a runtime event type for Chapter 9 and Chapter 17 display.
 *
 * Params:
 * - type: Runtime event type.
 *
 * Returns:
 * - Human-readable event type.
 *
 * PURE: No side effects.
 */
export function formatEventType(
  type: string
): string {
  const knownTypes: Record<string, string> = {
    "runtime.started": "Function Started",
    "runtime.reset": "Function Operating State Reset",
    "runtime.signal.evaluated": "Signal Evaluated",
    "runtime.signal.evaluation_failed": "Signal Evaluation Failed",
    "runtime.outcome.measured": "Outcome Measured",
    "runtime.outcome.measurement_failed": "Outcome Measurement Failed",
    "runtime.outcome.measurement_skipped": "Outcome Measurement Skipped",
    "job.created": "Task Created",
    "job.started": "Task Started",
    "job.completed": "Task Completed",
    "job.failed": "Task Failed",
    "job.approved": "Approval Granted",
    "job.rejected": "Approval Rejected",
    "worker.registered": "Worker Registered",
    "worker.assigned": "Worker Assigned",
    "memory.entry.added": "Memory Entry Added",
    "memory.entry.removed": "Memory Entry Removed",
    "health.updated": "Health Updated",
    "health.checked": "Health Checked",
    "governance.inspected": "Governance Inspected",
    "governance.policy.inspected": "Governance Policy Inspected",
    "policy.evaluated": "Governance Check",
    "risk.assessed": "Risk Assessed",
    "delegation.requested": "Delegation Requested",
    "delegation.completed": "Delegation Completed",
    "delegation.failed": "Delegation Failed",
    "schedule.added": "Schedule Added",
    "schedule.triggered": "Schedule Triggered",
    "schedule.dispatch_failed": "Schedule Dispatch Failed",
    "schedule.removed": "Schedule Removed",
    // Everything below was reaching the fallback, which title-cases the stored
    // type as-is. That printed the heading "Job Queued" directly above the
    // message "Task queued for …" — the heading contradicting the line under
    // it, in the one view meant to be a plain record of what happened. The
    // underscored types read worse still ("Job Approval_refused").
    "job.queued": "Task Queued",
    "job.approval_refused": "Approval Refused",
    "job.rejection_refused": "Rejection Refused",
    "job.operating_state_reset": "Function Stopped And Reset",
    "job.artefact_gate.released": "Artefact Gate Released",
    "runtime.snapshot": "State Saved",
    "runtime.heartbeat": "Function Still Running",
    "runtime.error": "Function Error",
    "scheduled-job.queued": "Scheduled Task Queued",
    "scheduled-job.dispatched": "Scheduled Task Dispatched",
    "scheduled-job.ignored": "Scheduled Task Ignored",
  };

  if (type.startsWith("business.")) {
    return formatBusinessEventType(
      type
    );
  }

  const known = knownTypes[type];
  if (known) return known;

  // The fallback has to hold the line for event types added later, so it splits
  // on underscores and hyphens too, and then runs the same Job/Runtime
  // substitution already applied to message bodies. Without that last step a
  // new "job.*" type reintroduces exactly the contradiction above.
  return formatEventMessage(
    type
      .split(/[._-]/)
      .filter(
        (part) =>
          part.length > 0
      )
      .map(
        (part) =>
          part.slice(0, 1).toUpperCase() +
          part.slice(1)
      )
      .join(" ")
  );
}

/**
 * Translates legacy stored lifecycle wording into Arturo's current
 * user-facing Job and Task vocabulary without rewriting durable history.
 */
export function formatEventMessage(
  message: string
): string {
  return message
    .replace(/\bBusiness Functions\b/g, "__ARTURO_ONGOING_JOBS__")
    .replace(/\bBusiness Function\b/g, "__ARTURO_ONGOING_JOB__")
    .replace(/\bRuntimes\b/g, "__ARTURO_ONGOING_JOBS__")
    .replace(/\bRuntime\b/g, "__ARTURO_ONGOING_JOB__")
    .replace(/\bJobs\b/g, "Tasks")
    .replace(/\bJob\b/g, "Task")
    .replace(/\bjobs\b/g, "tasks")
    .replace(/\bjob\b/g, "task")
    .replace(/__ARTURO_ONGOING_JOBS__/g, "Functions")
    .replace(/__ARTURO_ONGOING_JOB__/g, "Function");
}

/**
 * Purpose: Formats a runtime event record for Chapter 9 display.
 *
 * Params:
 * - event: Runtime event record.
 *
 * Returns:
 * - Human-readable event line.
 *
 * PURE: No side effects.
 */
export function formatEventLine(
  event: RuntimeEventRecord
): string {
  return [
    `${formatEventTime(event.timestamp)}  ${formatEventType(event.type)}  · ${event.level}`,
    `  ${formatEventMessage(event.message)}`,
    `  Event ID: ${event.id}`,
  ].join("\n");
}

/**
 * Purpose: Formats runtime events for Chapter 9 and Chapter 17 output.
 *
 * Params:
 * - events: Runtime event records.
 *
 * Returns:
 * - Human-readable Events output.
 *
 * PURE: No side effects.
 */
export function formatEvents(
  events: readonly RuntimeEventRecord[]
): string {
  if (events.length === 0) {
    return [
      "Events",
      "",
      "No events recorded.",
    ].join("\n");
  }

  return [
    "Events",
    "",
    ...events.flatMap((event, index) => [
      formatEventLine(event),
      ...(index < events.length - 1 ? [""] : []),
    ]),
  ].join("\n");
}

/**
 * Purpose: Reads a flag value from Event command args.
 *
 * Params:
 * - args: Command arguments.
 * - flag: Flag name.
 *
 * Returns:
 * - Flag value or undefined.
 *
 * PURE: No side effects.
 */
export function getEventFlagValue(
  args: readonly string[],
  flag: string
): string | undefined {
  const equalsPrefix =
    `${flag}=`;

  const equalsValue =
    args.find(
      (arg) =>
        arg.startsWith(
          equalsPrefix
        )
    );

  if (equalsValue) {
    return equalsValue.slice(
      equalsPrefix.length
    );
  }

  const flagIndex =
    args.indexOf(
      flag
    );

  if (flagIndex === -1) {
    return undefined;
  }

  return args[flagIndex + 1];
}

/** Resolves an Event rule's Enterprise, with a single-Enterprise fallback. */
export function resolveEventRuleEnterprise(
  reference:
    string |
    undefined
) {
  if (
    reference?.trim()
  ) {
    const enterprise =
      getEnterpriseByIdOrName(
        reference.trim()
      );
    if (!enterprise) {
      throw new Error(
        `enterprise not found: ${reference.trim()}`
      );
    }
    return enterprise;
  }

  const enterprises =
    listEnterprises();
  if (
    enterprises.length ===
    1
  ) {
    return enterprises[0];
  }

  throw new Error(
    enterprises.length ===
      0
      ? "Create an Enterprise before adding an Event rule."
      : "More than one Enterprise exists. Use --enterprise to select one."
  );
}

/** Creates one validated post-Job Event rule from terminal arguments. */
export function addEventRuleFromArgs(
  args:
    readonly string[]
): JobCompletionEventRule {
  const when =
    getEventFlagValue(
      args,
      "--when"
    )?.trim();
  const functionReference =
    getEventFlagValue(
      args,
      "--job"
    )?.trim() ??
    getEventFlagValue(
      args,
      "--function"
    )?.trim();
  const capability =
    getEventFlagValue(
      args,
      "--capability"
    )?.trim();
  const publishedEventLabel =
    getEventFlagValue(
      args,
      "--publish"
    )?.trim();
  const enterprise =
    resolveEventRuleEnterprise(
      getEventFlagValue(
        args,
        "--enterprise"
      )
    );

  if (
    when !== "task.completed" &&
    when !== "job.completed"
  ) {
    throw new Error(
      "Use --when task.completed. Other Event rule triggers are not supported yet."
    );
  }
  if (!functionReference) {
    throw new Error(
      "Use --job with the ongoing Function that owns the completed Task."
    );
  }
  if (!publishedEventLabel) {
    throw new Error(
      "Use --publish with the Business Event label Arturo should emit."
    );
  }
  const requiredCapability =
    capability
      ? parseWorkerCapability(
          capability
        )
      : undefined;

  const sourceDefinition =
    listBusinessFunctionDefinitionsByEnterprise(
      enterprise.id
    ).find(
      (definition) =>
        definition.id ===
          functionReference ||
        definition.label
          .trim()
          .toLowerCase() ===
          functionReference
            .toLowerCase()
    );
  if (!sourceDefinition) {
    throw new Error(
      `Function not found in ${enterprise.name}: ${functionReference}`
    );
  }

  return addJobCompletionEventRule({
    enterpriseId:
      enterprise.id,
    sourceBusinessFunctionId:
      sourceDefinition.id,
    triggerType:
      "job.completed",
    requiredCapability:
      requiredCapability,
    publishedEventLabel,
  });
}

/** Formats one Event rule with resolved Enterprise and Function names. */
export function formatEventRule(
  rule:
    JobCompletionEventRule
): string {
  const enterprise =
    getEnterpriseByIdOrName(
      rule.enterpriseId
    );
  const sourceDefinition =
    getBusinessFunctionDefinition(
      rule
        .sourceBusinessFunctionId
    );
  const evidenceGate =
    rule.requiredCapability ===
      "web-research"
      ? "Verified governed Web Search evidence Artefact with at least one result"
      : "Completed Task";

  return [
    `ID:                  ${rule.id}`,
    "When:                task.completed",
    `Enterprise:          ${enterprise?.name ?? rule.enterpriseId}`,
    `Source Function:          ${sourceDefinition?.label ?? rule.sourceBusinessFunctionId}`,
    `Required capability: ${rule.requiredCapability ?? "any"}`,
    `Evidence gate:       ${evidenceGate}`,
    `Publishes:           ${rule.publishedEventLabel}`,
    `Status:              ${rule.enabled ? "enabled" : "disabled"}`,
  ].join(
    "\n"
  );
}

/** Formats every configured post-Job Event rule. */
export function formatEventRules(): string {
  const rules =
    listJobCompletionEventRules();
  if (
    rules.length ===
    0
  ) {
    return [
      "Event rules",
      "",
      "No Event rules configured.",
    ].join(
      "\n"
    );
  }

  return [
    "Event rules",
    "",
    rules
      .map(
        (
          rule,
          index
        ) =>
          [
            `${index + 1}.`,
            formatEventRule(
              rule
            )
              .split(
                "\n"
              )
              .map(
                (line) =>
                  `   ${line}`
              )
              .join(
                "\n"
              ),
          ].join(
            "\n"
          )
      )
      .join(
        "\n\n"
      ),
  ].join(
    "\n"
  );
}

/** Handles /event rule add, list, inspect, and remove. */
export function handleEventRuleCommand(
  args:
    readonly string[]
): void {
  const [
    action,
    reference,
  ] = args;

  try {
    if (
      action ===
      "add"
    ) {
      const rule =
        addEventRuleFromArgs(
          args.slice(
            1
          )
        );
      console.log(
        [
          "Event rule added.",
          "",
          formatEventRule(
            rule
          ),
        ].join(
          "\n"
        )
      );
      broadcastEvent(
        "event.rule.added",
        "success",
        `Event rule added: ${rule.id}`
      );
      return;
    }

    if (
      action ===
      "list"
    ) {
      console.log(
        formatEventRules()
      );
      return;
    }

    if (
      action ===
      "inspect"
    ) {
      const rule =
        reference
          ? getJobCompletionEventRule(
              reference
            )
          : undefined;
      if (!rule) {
        throw new Error(
          reference
            ? `Event rule not found: ${reference}`
            : "Use /event rule inspect <event-rule-id>."
        );
      }
      console.log(
        formatEventRule(
          rule
        )
      );
      return;
    }

    if (
      action ===
      "remove"
    ) {
      const rule =
        reference
          ? removeJobCompletionEventRule(
              reference
            )
          : undefined;
      if (!rule) {
        throw new Error(
          reference
            ? `Event rule not found: ${reference}`
            : "Use /event rule remove <event-rule-id>."
        );
      }
      console.log(
        `Event rule removed: ${rule.id}`
      );
      broadcastEvent(
        "event.rule.removed",
        "success",
        `Event rule removed: ${rule.id}`
      );
      return;
    }

    console.log(
      [
        "Usage:",
        '  /event rule add --when task.completed --job "<job>" [--capability <id>] --publish "<event-name>" [--enterprise "<enterprise>"]',
        "  /event rule list",
        "  /event rule inspect <event-rule-id>",
        "  /event rule remove <event-rule-id>",
      ].join(
        "\n"
      )
    );
  } catch (error) {
    console.log(
      error instanceof Error
        ? error.message
        : String(
            error
          )
    );
  }
}

/**
 * Purpose: Handles /event publish.
 *
 * Params:
 * - args: Command arguments after "publish".
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Publishes organisational Events.
 * - Writes terminal output.
 */
export async function handleEventPublishCommand(
  args: readonly string[]
): Promise<void> {
  const [
    label,
  ] = args;

  const source =
    getEventFlagValue(
      args,
      "--source"
    )?.trim();

  const enterprise =
    getEventFlagValue(
      args,
      "--enterprise"
    )?.trim();

  if (!label || !source || !enterprise) {
    console.log(
      'Usage: /event publish "<event-name>" --source "<business-function>" --enterprise "<enterprise-name>"'
    );

    return;
  }

  const enterpriseRecord =
    getEnterpriseByIdOrName(
      enterprise
    );
  if (!enterpriseRecord) {
    console.log(
      `enterprise not found: ${enterprise}`
    );
    return;
  }
  const sourceDefinition =
    listBusinessFunctionDefinitionsByEnterprise(
      enterpriseRecord.id
    ).find(
      (definition) =>
        definition.id === source ||
        definition.label.trim().toLowerCase() ===
          source.toLowerCase()
    );
  if (!sourceDefinition) {
    console.log(
      `source Function not found in ${enterpriseRecord.name}: ${source}`
    );
    return;
  }

  const publication =
    await publishOrganisationalEventToRuntimes({
      label,
      sourceBusinessFunction:
        sourceDefinition.label,
      enterpriseName:
        enterpriseRecord.name,
    });

  console.log(
    [
      formatEvents(
        publication.records
      ),
      "",
      formatRuntimeSignalEvaluations(
        publication.evaluations
      ),
    ].join("\n")
  );
}

/**
 * Purpose: Handles /event.
 *
 * Params:
 * - args: Event command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - May publish organisational Events.
 * - Writes terminal output.
 */
export async function handleEventCommand(
  args: readonly string[]
): Promise<void> {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (subcommand === "publish") {
    await handleEventPublishCommand(
      subcommandArgs
    );

    return;
  }

  if (
    subcommand ===
    "rule"
  ) {
    handleEventRuleCommand(
      subcommandArgs
    );
    return;
  }

  console.log(
    [
      "Usage:",
      '  /event publish "<event-name>" --source "<business-function>" --enterprise "<enterprise-name>"',
      '  /event rule add --when task.completed --job "<job>" [--capability <id>] --publish "<event-name>" [--enterprise "<enterprise>"]',
      "  /event rule list",
      "  /event rule inspect <event-rule-id>",
      "  /event rule remove <event-rule-id>",
    ].join("\n")
  );
}

/**
 * Purpose: Handles the /events command.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads runtime event store.
 * - Writes CLI output.
 */
export function handleEventsCommand(): void {
  console.log(
    formatEvents(
      listRuntimeEventStore()
    )
  );
}
