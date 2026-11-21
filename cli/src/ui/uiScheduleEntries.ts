import {
  addEventScheduleFromArgs,
  formatEventSchedule,
  formatEventSchedules,
} from "../repl/scheduleCommands";

import {
  getEventSchedule,
  removeEventSchedule,
} from "../scheduling/eventScheduleStore";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import type {
  WorkStreamEntry,
} from "./uiState";

function getFlagValue(
  args:
    readonly string[],
  flag:
    string
): string |
  undefined {
  const index =
    args.indexOf(
      flag
    );
  if (
    index >=
    0
  ) {
    return args[
      index +
      1
    ];
  }
  return undefined;
}

/** Handles /schedule in the native terminal. */
export function handleUiScheduleCommand(
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
      const schedule =
        addEventScheduleFromArgs(
          args.slice(
            1
          )
        );
      return {
        actor:
          "Arturo",
        label:
          "Task schedule added",
        body: [
          "Task schedule added.",
          "",
          formatEventSchedule(
            schedule
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
          "Task schedules",
        body:
          formatEventSchedules(
            getFlagValue(
              args,
              "--enterprise"
            )
          ),
      };
    }
    if (
      action ===
      "inspect"
    ) {
      const schedule =
        reference
          ? getEventSchedule(
              reference
            )
          : undefined;
      if (!schedule) {
        throw new Error(
          reference
            ? `Task schedule not found: ${reference}`
            : "Use /schedule inspect <schedule-id>."
        );
      }
      return {
        actor:
          "Arturo",
        label:
          "Task schedule",
        body:
          formatEventSchedule(
            schedule
          ),
      };
    }
    if (
      action ===
      "remove"
    ) {
      const schedule =
        reference
          ? removeEventSchedule(
              reference
            )
          : undefined;
      if (!schedule) {
        throw new Error(
          reference
            ? `Task schedule not found: ${reference}`
            : "Use /schedule remove <schedule-id>."
        );
      }
      broadcastEvent(
        "schedule.removed",
        "success",
        `Task schedule removed: ${schedule.id}`
      );
      return {
        actor:
          "Arturo",
        label:
          "Task schedule removed",
        body:
          `Task schedule removed: ${schedule.id}`,
      };
    }

    return {
      actor:
        "Arturo",
      label:
        "Usage",
      body: [
        'Use /schedule add "<one-clear-outcome>" [--job "<job>"] [--enterprise "<enterprise>"] [--every <daily|weekday>] --at "HH:MM" --timezone "<IANA-timezone>" [--search-query "<query>"]',
        'Use /schedule list [--enterprise "<enterprise>"]',
        "Use /schedule inspect <schedule-id>",
        "Use /schedule remove <schedule-id>",
      ].join(
        "\n"
      ),
    };
  } catch (error) {
    return {
      actor:
        "Arturo",
      label:
        "Task schedule not changed",
      body:
        error instanceof Error
          ? error.message
          : String(
              error
            ),
    };
  }
}
