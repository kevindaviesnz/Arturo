import {
  publishOrganisationalEventToRuntimes,
} from "../events/organisationalEventBus";

import {
  formatRuntimeSignalEvaluations,
} from "../runtime/businessFunctionRuntimeEvaluator";

import {
  listRuntimeEventStore,
} from "../runtime/runtimeEventStore";

import {
  addEventRuleFromArgs,
  formatEventRule,
  formatEventRules,
  formatEvents,
  getEventFlagValue,
} from "../repl/eventCommands";

import {
  getJobCompletionEventRule,
  removeJobCompletionEventRule,
} from "../events/jobCompletionEventRuleStore";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";

import {
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";

import type {
  WorkStreamEntry,
} from "./uiState";

/**
 * Purpose: Reads runtime Events for terminal UI display.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entry containing Events.
 *
 * SIDE EFFECT:
 * - Reads runtime event store.
 */
export function readEventEntries(): WorkStreamEntry {
  return {
    actor: "Arturo",
    label: "Events",
    body: formatEvents(
      listRuntimeEventStore()
    ),
  };
}

/**
 * Purpose: Handles /event publish from the terminal UI.
 *
 * Params:
 * - args: Command arguments after "publish".
 *
 * Returns:
 * - Work stream entry for published organisational Events.
 *
 * SIDE EFFECT:
 * - Publishes organisational Events.
 */
export async function handleUiEventPublishCommand(
  args: readonly string[]
): Promise<WorkStreamEntry> {
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
    return {
      actor: "Arturo",
      label: "Usage",
      body: 'Use /event publish "<event-name>" --source "<job>" --enterprise "<enterprise-name>"',
    };
  }

  const enterpriseRecord =
    getEnterpriseByIdOrName(
      enterprise
    );
  if (!enterpriseRecord) {
    return {
      actor: "Arturo",
      label: "Enterprise not found",
      body: `enterprise not found: ${enterprise}`,
    };
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
    return {
      actor: "Arturo",
      label: "Source Function not found",
      body: [
        `source Function not found in ${enterpriseRecord.name}: ${source}`,
        `Use /functions --enterprise "${enterpriseRecord.name}" to choose a Function that belongs to this Enterprise.`,
      ].join("\n"),
    };
  }

  const publication =
    await publishOrganisationalEventToRuntimes({
      label,
      sourceBusinessFunction:
        sourceDefinition.label,
      enterpriseName:
        enterpriseRecord.name,
    });

  return {
    actor: "Arturo",
    label: "Event published",
    body: [
      formatEvents(
        publication.records
      ),
      "",
      formatRuntimeSignalEvaluations(
        publication.evaluations
      ),
    ].join("\n"),
  };
}

/** Handles the terminal UI forms of /event rule. */
export function handleUiEventRuleCommand(
  args:
    readonly string[]
): WorkStreamEntry {
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
      broadcastEvent(
        "event.rule.added",
        "success",
        `Event rule added: ${rule.id}`
      );
      return {
        actor:
          "Arturo",
        label:
          "Event rule added",
        body: [
          "Event rule added.",
          "",
          formatEventRule(
            rule
          ),
        ].join(
          "\n"
        ),
      };
    }

    if (
      action ===
      "list"
    ) {
      return {
        actor:
          "Arturo",
        label:
          "Event rules",
        body:
          formatEventRules(),
      };
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
      return {
        actor:
          "Arturo",
        label:
          "Event rule",
        body:
          formatEventRule(
            rule
          ),
      };
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
      broadcastEvent(
        "event.rule.removed",
        "success",
        `Event rule removed: ${rule.id}`
      );
      return {
        actor:
          "Arturo",
        label:
          "Event rule removed",
        body:
          `Event rule removed: ${rule.id}`,
      };
    }

    return {
      actor:
        "Arturo",
      label:
        "Usage",
      body: [
        'Use /event rule add --when task.completed --job "<job>" [--capability <id>] --publish "<event-name>" [--enterprise "<enterprise>"]',
        "Use /event rule list",
        "Use /event rule inspect <event-rule-id>",
        "Use /event rule remove <event-rule-id>",
      ].join(
        "\n"
      ),
    };
  } catch (error) {
    return {
      actor:
        "Arturo",
      label:
        "Event rule not changed",
      body:
        error instanceof Error
          ? error.message
          : String(
              error
            ),
    };
  }
}

/**
 * Purpose: Handles /event from the terminal UI.
 *
 * Params:
 * - args: Event command arguments.
 *
 * Returns:
 * - Work stream entry.
 *
 * SIDE EFFECT:
 * - May publish organisational Events.
 */
export async function handleUiEventCommand(
  args: readonly string[]
): Promise<WorkStreamEntry> {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  if (subcommand === "publish") {
    return await handleUiEventPublishCommand(
      subcommandArgs
    );
  }

  if (
    subcommand ===
    "rule"
  ) {
    return handleUiEventRuleCommand(
      subcommandArgs
    );
  }

  return {
    actor: "Arturo",
    label: "Usage",
    body: [
      'Use /event publish "<event-name>" --source "<job>" --enterprise "<enterprise-name>"',
      'Use /event rule add --when task.completed --job "<job>" [--capability <id>] --publish "<event-name>" [--enterprise "<enterprise>"]',
      "Use /event rule list",
    ].join(
      "\n"
    ),
  };
}
