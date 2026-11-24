import {
  getBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  getEnterprise,
} from "../enterprise/enterpriseStore";

import {
  inferBusinessFunctionCapabilities,
  selectStaffedRuntimeWorker,
} from "../runtime/businessFunctionRuntimeRouting";

import {
  getJob,
  queueScheduledTaskOccurrence,
  replaceJob,
} from "../runtime/jobQueue";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  refuseTaskWithoutWork,
  refuseWorkUnderLocks,
} from "../work/workLocks";

import {
  computeNextEventScheduleRun,
  type EventSchedule,
} from "./eventSchedule";

import {
  listEventSchedules,
  recordEventScheduleOccurrence,
  replaceEventSchedule,
} from "./eventScheduleStore";

export type EventScheduleDispatch = {
  readonly schedule:
    EventSchedule;
  readonly status:
    | "queued"
    | "skipped";
  readonly taskId?:
    string;
  readonly reason?:
    string;
  readonly error?:
    string;
};

let interval:
  NodeJS.Timeout |
  undefined;
let tickRunning =
  false;

function advanceEventSchedule(
  schedule: EventSchedule,
  now: number
): EventSchedule {
  return replaceEventSchedule({
    ...schedule,
    lastRunAt:
      now,
    nextRunAt:
      computeNextEventScheduleRun(
        {
          frequency:
            schedule.frequency,
          dayOfWeek:
            schedule.dayOfWeek,
          hour:
            schedule.hour,
          minute:
            schedule.minute,
          timezone:
            schedule.timezone,
          after:
            now,
        }
      ),
  });
}

function recordSkippedOccurrence(
  schedule: EventSchedule,
  scheduledFor: number,
  reason: string,
  now: number
): void {
  recordEventScheduleOccurrence({
    scheduleId:
      schedule.id,
    taskId:
      schedule.taskId,
    scheduledFor,
    status:
      "skipped",
    reason,
    now,
  });
}

/**
 * Queues each due Task occurrence once, then advances its schedule.
 * The Worker runtime owns the queued-to-running transition and execution.
 */
export async function runDueEventSchedules(
  now: number =
    Date.now()
): Promise<
  readonly EventScheduleDispatch[]
> {
  const due =
    listEventSchedules()
      .filter(
        (schedule) =>
          schedule.enabled &&
          schedule.nextRunAt <=
            now
      )
      .sort(
        (left, right) =>
          left.nextRunAt -
            right.nextRunAt ||
          left.id.localeCompare(
            right.id
          )
      );
  const results:
    EventScheduleDispatch[] =
    [];

  for (
    const schedule of
    due
  ) {
    try {
      const enterprise =
        getEnterprise(
          schedule.enterpriseId
        );
      const task =
        getJob(
          schedule.taskId
        );
      const source =
        getBusinessFunctionDefinition(
          schedule.owningJobId
        );
      if (
        !enterprise ||
        !source ||
        !task ||
        source.enterpriseId !==
          enterprise.id ||
        task.enterpriseId !==
          enterprise.id ||
        task.owningJobId !==
          source.id
      ) {
        throw new Error(
          "The scheduled Task, its owning Function, or its Enterprise no longer exists."
        );
      }

      const scheduledFor =
        schedule.nextRunAt;
      if (
        task.status !== "scheduled" &&
        task.status !== "completed"
      ) {
        const reason =
          `Task ${task.id} is ${task.status}, so this scheduled occurrence was skipped.`;
        advanceEventSchedule(
          schedule,
          now
        );
        recordSkippedOccurrence(
          schedule,
          scheduledFor,
          reason,
          now
        );
        broadcastEvent(
          "schedule.skipped",
          "warn",
          `Task schedule ${schedule.id} skipped an occurrence: ${reason}`
        );
        results.push({
          schedule,
          status:
            "skipped",
          taskId:
            task.id,
          reason,
        });
        continue;
      }

      const requiredCapabilities =
        (task.requiredCapabilities ??
          inferBusinessFunctionCapabilities(
            source
          ))
          .filter(
            (capability) =>
              capability !== "human-review"
          );
      // Checked again as it fires: since it was scheduled, the business may
      // have become a law practice, or a client it names may now have work
      // with "no AI" on (work/workLocks.ts). Skipped, and said, not run.
      const needsWork =
        refuseTaskWithoutWork({
          enterpriseId:
            task.enterpriseId ?? schedule.enterpriseId ?? "",
          workId:
            task.workId,
          hasDocuments:
            (task.inputArtefactRefs ?? []).length > 0,
          instruction:
            task.task,
        }) ??
        refuseWorkUnderLocks({
          workId:
            task.workId,
          enterpriseId:
            task.enterpriseId,
          functionId:
            task.businessFunctionId,
          when:
            "start",
        });
      if (needsWork) {
        const reason =
          `${needsWork} This scheduled occurrence was skipped.`;
        advanceEventSchedule(
          schedule,
          now
        );
        recordSkippedOccurrence(
          schedule,
          scheduledFor,
          reason,
          now
        );
        broadcastEvent(
          "schedule.skipped",
          "warn",
          `Task schedule ${schedule.id} skipped an occurrence: ${reason}`
        );
        results.push({
          schedule,
          status:
            "skipped",
          taskId:
            task.id,
          reason,
        });
        continue;
      }

      const worker =
        selectStaffedRuntimeWorker(
          source,
          requiredCapabilities
        );
      if (!worker) {
        const reason =
          `No available staffed Worker can perform Task ${task.id}; this scheduled occurrence was skipped.`;
        advanceEventSchedule(
          schedule,
          now
        );
        recordSkippedOccurrence(
          schedule,
          scheduledFor,
          reason,
          now
        );
        broadcastEvent(
          "schedule.skipped",
          "warn",
          `Task schedule ${schedule.id} skipped an occurrence: ${reason}`
        );
        results.push({
          schedule,
          status:
            "skipped",
          taskId:
            task.id,
          reason,
        });
        continue;
      }

      const queued =
        replaceJob(
          queueScheduledTaskOccurrence(
            task,
            worker.name,
            `Task schedule ${schedule.id} assigned ${worker.name} for its due occurrence.`,
            scheduledFor,
            now
          )
        );
      advanceEventSchedule(
        schedule,
        now
      );
      recordEventScheduleOccurrence({
        scheduleId:
          schedule.id,
        taskId:
          queued.id,
        scheduledFor,
        status:
          "queued",
        worker:
          worker.name,
        now,
      });
      broadcastEvent(
        "schedule.triggered",
        "success",
        `Task schedule ${schedule.id} queued Task ${queued.id} for ${worker.name}`
      );
      results.push({
        schedule,
        status:
          "queued",
        taskId:
          queued.id,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(
              error
            );
      replaceEventSchedule({
        ...schedule,
        nextRunAt:
          computeNextEventScheduleRun(
            {
              frequency:
                schedule.frequency,
              dayOfWeek:
                schedule.dayOfWeek,
              hour:
                schedule.hour,
              minute:
                schedule.minute,
              timezone:
                schedule.timezone,
              after:
                now,
            }
          ),
      });
      broadcastEvent(
        "schedule.dispatch_failed",
        "error",
        `Task schedule ${schedule.id} could not queue its occurrence: ${message}`
      );
      results.push({
        schedule,
        status:
          "skipped",
        error:
          message,
      });
    }
  }

  return results;
}

/** Starts the process-local dispatcher for persistent Task schedules. */
export function startEventScheduleRuntime(
  intervalMs: number =
    15_000
): void {
  if (interval) {
    return;
  }

  const tick =
    async (): Promise<void> => {
      if (tickRunning) {
        return;
      }
      tickRunning =
        true;
      try {
        await runDueEventSchedules();
      } finally {
        tickRunning =
          false;
      }
    };

  void tick();
  interval =
    setInterval(
      () => {
        void tick();
      },
      intervalMs
    );
  interval.unref();
}

/** Stops only the process-local dispatcher; stored schedules remain intact. */
export function stopEventScheduleRuntime():
  void {
  if (!interval) {
    return;
  }
  clearInterval(
    interval
  );
  interval =
    undefined;
}
