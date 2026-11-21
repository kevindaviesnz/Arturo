import {
  getBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import { refuseWebStepRequest } from "../runtime/webSearchSwitch";
import {
  getEnterprise,
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";

import {
  inferBusinessFunctionCapabilities,
} from "../runtime/businessFunctionRuntimeRouting";

import {
  enqueueScheduledJob,
  getJob,
} from "../runtime/jobQueue";

import {
  refuseTaskWithoutWork,
} from "../work/workLocks";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  formatEventScheduleRecurrence,
  formatEventScheduleTime,
  parseDailyTime,
  parseEventScheduleRecurrence,
  validateEventScheduleTimezone,
  type EventSchedule,
} from "../scheduling/eventSchedule";

import {
  addEventSchedule,
  getEventSchedule,
  listEventSchedules,
  removeEventSchedule,
} from "../scheduling/eventScheduleStore";

import {
  inferTaskCapabilities,
  resolveTaskJob,
} from "./taskRoutingCommands";

const TASK_SCHEDULE_USAGE =
  'Use /schedule add "<one-clear-outcome>" [--job "<job>"] [--enterprise "<enterprise>"] [--every <daily|weekday>] --at "HH:MM" --timezone "<IANA-timezone>" [--search-query "<query>"]';

type TaskScheduleOptions = {
  readonly request: string;
  readonly jobReference?: string;
  readonly enterpriseReference?: string;
  readonly every?: string;
  readonly at?: string;
  readonly timezone?: string;
  readonly webSearchQuery?: string;
};

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
  const prefix =
    `${flag}=`;
  return args
    .find(
      (value) =>
        value.startsWith(
          prefix
        )
    )
    ?.slice(
      prefix.length
    );
}

function parseTaskScheduleOptions(
  args: readonly string[]
): TaskScheduleOptions {
  const values: {
    jobReference?: string;
    enterpriseReference?: string;
    every?: string;
    at?: string;
    timezone?: string;
    webSearchQuery?: string;
  } = {};
  const requestParts: string[] = [];
  const supportedFlags = [
    // --function is the current name; --job is the pre-rename spelling.
    "--function",
    "--job",
    "--enterprise",
    "--every",
    "--at",
    "--timezone",
    "--search-query",
  ] as const;

  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    const argument =
      args[index];
    if (
      argument === "--publish" ||
      argument.startsWith("--publish=") ||
      argument === "--source" ||
      argument.startsWith("--source=")
    ) {
      throw new Error(
        "Schedules belong to Tasks. Use the Task outcome directly and optionally --job; --publish and --source are no longer supported."
      );
    }
    const flag =
      supportedFlags.find(
        (candidate) =>
          argument === candidate ||
          argument.startsWith(
            `${candidate}=`
          )
      );
    if (flag) {
      const prefix =
        `${flag}=`;
      const value =
        argument.startsWith(prefix)
          ? argument.slice(
              prefix.length
            )
          : args[++index];
      if (!value || value.startsWith("--")) {
        throw new Error(
          `${flag} requires a value.`
        );
      }

      if (flag === "--function" || flag === "--job") {
        values.jobReference = value;
      } else if (flag === "--enterprise") {
        values.enterpriseReference = value;
      } else if (flag === "--every") {
        values.every = value;
      } else if (flag === "--at") {
        values.at = value;
      } else if (flag === "--timezone") {
        values.timezone = value;
      } else {
        values.webSearchQuery = value;
      }
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(
        `Unknown /schedule add option: ${argument}`
      );
    }
    requestParts.push(argument);
  }

  const request =
    requestParts.join(" ").trim();
  if (!request || !values.at || !values.timezone) {
    throw new Error(
      TASK_SCHEDULE_USAGE
    );
  }

  return {
    request,
    ...values,
  };
}

/** Creates a dormant recurring Task and attaches its schedule atomically in command flow. */
export function addEventScheduleFromArgs(
  args:
    readonly string[]
): EventSchedule {
  const options =
    parseTaskScheduleOptions(
      args
    );
  const jobResolution =
    resolveTaskJob({
      request:
        options.request,
      jobReference:
        options.jobReference,
      enterpriseReference:
        options.enterpriseReference,
      webSearchQuery:
        options.webSearchQuery,
    });
  if (!jobResolution.ok) {
    throw new Error(
      jobResolution.message
    );
  }

  // Every part of the schedule the operator typed is checked before anything is
  // written. Recurrence, time and timezone were validated inside
  // addEventSchedule — after enqueueScheduledJob had already created the Task —
  // so "/schedule add ... --every weekly" printed "Task schedule not changed"
  // and left a scheduled Task behind with no schedule to ever fire it. A
  // refusal must not be a partial success.
  parseEventScheduleRecurrence(
    options.every as string
  );
  parseDailyTime(
    options.at as string
  );
  validateEventScheduleTimezone(
    options.timezone as string
  );

  // A scheduled Task carries no named piece of work, so one that would need
  // a matter on a law practice, or names a client with "no AI" work, is
  // refused here, before anything is written. Each occurrence is checked
  // again as it fires (scheduling/eventScheduleRuntime.ts).
  const needsWork =
    refuseTaskWithoutWork({
      enterpriseId:
        jobResolution.job.enterpriseId ?? "",
      hasDocuments:
        false,
      instruction:
        options.request,
    });
  if (needsWork) {
    throw new Error(
      `${needsWork} A scheduled Task can't belong to a matter, so this can't be scheduled. Nothing was scheduled.`
    );
  }

  // Search words are checked against the business's web search switch now,
  // before anything is written; each run is a web step with its own go-ahead,
  // checked live again before it searches (S4, W3).
  if (options.webSearchQuery !== undefined) {
    const webRefusal = refuseWebStepRequest({ enterpriseId: jobResolution.job.enterpriseId, words: options.webSearchQuery });
    if (webRefusal) {
      throw new Error(`${webRefusal.message} Nothing was scheduled.`);
    }
  }

  const inferredCapabilities =
    inferTaskCapabilities(
      options.request
    );
  if (
    options.webSearchQuery &&
    !inferredCapabilities.includes(
      "web-research"
    )
  ) {
    inferredCapabilities.push(
      "web-research"
    );
  }
  const requiredCapabilities =
    inferredCapabilities.length > 0
      ? inferredCapabilities
      : inferBusinessFunctionCapabilities(
          jobResolution.job
        );
  const scheduledTask =
    enqueueScheduledJob(
      options.request,
      {
        owningJobId:
          jobResolution.job.id,
        requiredCapabilities,
        routingReason:
          jobResolution.inferred
            ? `Inferred Function ${jobResolution.job.label} for this scheduled Task.`
            : `Scheduled Task belongs to ${jobResolution.job.label}.`,
        enterpriseId:
          jobResolution.job.enterpriseId,
        webSearchQuery:
          options.webSearchQuery,
      }
    );
  const schedule =
    addEventSchedule({
      enterpriseId:
        jobResolution.job.enterpriseId,
      owningJobId:
        jobResolution.job.id,
      taskId:
        scheduledTask.id,
      taskLabel:
        options.request,
      every:
        options.every,
      at:
        options.at as string,
      timezone:
        options.timezone as string,
      searchQuery:
        options.webSearchQuery,
    });

  broadcastEvent(
    "schedule.added",
    "success",
    `Task schedule added: ${schedule.id} for Task ${scheduledTask.id}`
  );
  return schedule;
}

/** Formats one schedule with its Task and owning Job context. */
export function formatEventSchedule(
  schedule:
    EventSchedule
): string {
  const enterprise =
    getEnterprise(
      schedule.enterpriseId
    );
  const source =
    getBusinessFunctionDefinition(
      schedule.owningJobId
    );
  const task =
    getJob(
      schedule.taskId
    );

  return [
    `ID:          ${schedule.id}`,
    `Frequency:   ${formatEventScheduleRecurrence(schedule)}`,
    `At:          ${formatEventScheduleTime(schedule)}`,
    `Timezone:    ${schedule.timezone}`,
    `Task:        ${task?.task ?? schedule.taskLabel}`,
    `Task ID:     ${schedule.taskId}`,
    `Function:         ${source?.label ?? schedule.owningJobId}`,
    `Enterprise:  ${enterprise?.name ?? schedule.enterpriseId}`,
    ...(
      schedule.searchQuery
        ? [
            `Search query: ${schedule.searchQuery}`,
          ]
        : []
    ),
    `Status:      ${schedule.enabled ? "enabled" : "disabled"}`,
    `Next run:    ${formatScheduleMoment(schedule.nextRunAt, schedule.timezone)}`,
    `Last run:    ${schedule.lastRunAt ? formatScheduleMoment(schedule.lastRunAt, schedule.timezone) : "never"}`,
  ].join(
    "\n"
  );
}

/** Formats all Task schedules, optionally scoped to one Enterprise. */
export function formatEventSchedules(
  enterpriseReference?:
    string
): string {
  let schedules =
    listEventSchedules();
  if (
    enterpriseReference
  ) {
    const enterprise =
      getEnterpriseByIdOrName(
        enterpriseReference
      );
    if (!enterprise) {
      throw new Error(
        `Enterprise not found: ${enterpriseReference}`
      );
    }
    schedules =
      schedules.filter(
        (schedule) =>
          schedule.enterpriseId ===
            enterprise.id
      );
  }
  if (schedules.length === 0) {
    return "No Task schedules found.";
  }

  return schedules
    .map(
      (
        schedule,
        index
      ) =>
        [
          `${index + 1}.`,
          formatEventSchedule(
            schedule
          ),
        ].join(
          "\n"
        )
    )
    .join(
      "\n\n"
    );
}

/** Handles /schedule for the classic REPL. */
export function handleScheduleCommand(
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
      console.log(
        [
          "Task schedule added.",
          "",
          formatEventSchedule(
            addEventScheduleFromArgs(
              args.slice(
                1
              )
            )
          ),
        ].join(
          "\n"
        )
      );
      return;
    }
    if (
      action ===
      "list"
    ) {
      console.log(
        formatEventSchedules(
          getFlagValue(
            args,
            "--enterprise"
          )
        )
      );
      return;
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
      console.log(
        formatEventSchedule(
          schedule
        )
      );
      return;
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
      console.log(
        `Task schedule removed: ${schedule.id}`
      );
      return;
    }

    console.log(
      [
        "Usage:",
        TASK_SCHEDULE_USAGE,
        '  /schedule list [--enterprise "<enterprise>"]',
        "  /schedule inspect <schedule-id>",
        "  /schedule remove <schedule-id>",
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
 * Shows a scheduled moment in the timezone the operator chose for it.
 *
 * The stored value is a UTC instant and stays one. Rendering it as an ISO
 * string meant that someone who asked for 06:00 in Pacific/Auckland was told
 * the next run was "2026-08-06T18:00:00.000Z" — the right instant, on what
 * reads as the wrong day, in a format they never typed.
 *
 * PURE: No side effects.
 */
export function formatScheduleMoment(
  at: number,
  timezone: string
): string {
  try {
    const formatted = new Intl.DateTimeFormat("en-NZ", {
      timeZone: timezone,
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(at));
    return `${formatted} (${timezone})`;
  } catch {
    // An unknown timezone must not take the whole listing down with it.
    return new Date(at).toISOString();
  }
}
