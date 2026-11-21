import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  addWorker,
  clearWorkers,
  getWorker,
} from "../control/workers";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  clearJobs,
  completeJob,
  enqueueScheduledJob,
  getJob,
} from "../runtime/jobQueue";

import {
  clearRuntimeEventStore,
} from "../runtime/runtimeEventStore";

import {
  clearStaffingAssignments,
  saveStaffingAssignment,
} from "../staffing/staffingStore";

import {
  addEventSchedule,
  clearEventSchedules,
  getEventSchedule,
  listEventScheduleOccurrences,
} from "./eventScheduleStore";

import {
  runDueEventSchedules,
} from "./eventScheduleRuntime";

function clearState():
  void {
  clearEventSchedules();
  clearJobs();
  clearRuntimeEventStore();
  clearStaffingAssignments();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
  clearWorkers();
}

function createScheduledBackupTask(): {
  readonly scheduleId: string;
  readonly taskId: string;
} {
  const enterprise =
    createAndSaveEnterprise({
      name:
        "Code Keeper",
      mission:
        "Protect source code with regular verified backups.",
    });
  const definition =
    createAndSaveBusinessFunctionDefinition({
      id:
        `${enterprise.id}:backups`,
      enterpriseId:
        enterprise.id,
      label:
        "Backup Operations",
      objective:
        "Create and verify recoverable backups.",
    });
  const alice = {
    name:
      "Alice-Bot",
    kind:
      "ai" as const,
    archetype:
      "operator" as const,
    availability:
      "available" as "available" | "busy",
    run:
      function* () {
        return undefined;
      },
  };
  addWorker(alice);
  addWorker({
    name:
      "Sam-Bot",
    kind:
      "ai",
    archetype:
      "operator",
    availability:
      "available",
    run:
      function* () {
        return undefined;
      },
  });
  saveStaffingAssignment({
    businessFunctionId:
      definition.id,
    workerName:
      "Alice-Bot",
    role:
      "ai",
    rationale:
      "Primary backup coverage.",
  });
  saveStaffingAssignment({
    businessFunctionId:
      definition.id,
    workerName:
      "Sam-Bot",
    role:
      "ai",
    rationale:
      "Backup coverage.",
  });
  const task =
    enqueueScheduledJob(
      "Verify the weekly source-code backup.",
      {
        owningJobId:
          definition.id,
        enterpriseId:
          enterprise.id,
        requiredCapabilities: [
          "backup",
        ],
      }
    );
  const schedule =
    addEventSchedule({
      id:
        "schedule-weekly-backup",
      enterpriseId:
        enterprise.id,
      owningJobId:
        definition.id,
      taskId:
        task.id,
      taskLabel:
        task.task,
      every:
        "friday",
      at:
        "18:00",
      timezone:
        "Pacific/Auckland",
      now:
        Date.parse(
          "2026-07-18T00:00:00.000Z"
        ),
    });

  return {
    scheduleId:
      schedule.id,
    taskId:
      task.id,
  };
}

beforeEach(
  clearState
);

afterEach(
  clearState
);

describe(
  "Task schedule runtime",
  () => {
    it(
      "queues a due dormant Task without starting it",
      async () => {
        const {
          scheduleId,
          taskId,
        } =
          createScheduledBackupTask();
        const dueAt =
          getEventSchedule(
            scheduleId
          )?.nextRunAt as number;

        const result =
          await runDueEventSchedules(
            dueAt
          );

        expect(result).toMatchObject([
          {
            status:
              "queued",
            taskId,
          },
        ]);
        expect(
          getJob(taskId)
        ).toMatchObject({
          status:
            "queued",
          worker:
            "Alice-Bot",
          scheduledOccurrenceAt:
            dueAt,
          startedAt:
            undefined,
        });
        expect(
          listEventScheduleOccurrences(
            scheduleId
          )
        ).toMatchObject([
          {
            taskId,
            status:
              "queued",
            worker:
              "Alice-Bot",
          },
        ]);
      }
    );

    it(
      "reuses a completed Task and reselects a staffed available Worker",
      async () => {
        const {
          scheduleId,
          taskId,
        } =
          createScheduledBackupTask();
        const firstDueAt =
          getEventSchedule(
            scheduleId
          )?.nextRunAt as number;

        await runDueEventSchedules(
          firstDueAt
        );
        completeJob(
          taskId,
          "Backup verified"
        );
        const alice =
          getWorker(
            "Alice-Bot"
          );
        if (!alice) {
          throw new Error(
            "Alice-Bot was not registered."
          );
        }
        alice.availability =
          "busy";
        const secondDueAt =
          getEventSchedule(
            scheduleId
          )?.nextRunAt as number;

        await runDueEventSchedules(
          secondDueAt
        );

        expect(
          getJob(taskId)
        ).toMatchObject({
          worker:
            "Sam-Bot",
          status:
            "queued",
          output:
            undefined,
          startedAt:
            undefined,
        });
        expect(
          listEventScheduleOccurrences(
            scheduleId
          ).map(
            (occurrence) =>
              occurrence.worker
          )
        ).toEqual([
          "Alice-Bot",
          "Sam-Bot",
        ]);
      }
    );

    it(
      "skips and records an occurrence when the scheduled Task is unfinished",
      async () => {
        const {
          scheduleId,
          taskId,
        } =
          createScheduledBackupTask();
        const firstDueAt =
          getEventSchedule(
            scheduleId
          )?.nextRunAt as number;

        await runDueEventSchedules(
          firstDueAt
        );
        const secondDueAt =
          getEventSchedule(
            scheduleId
          )?.nextRunAt as number;
        const skipped =
          await runDueEventSchedules(
            secondDueAt
          );

        expect(skipped).toMatchObject([
          {
            status:
              "skipped",
            taskId,
            reason:
              expect.stringContaining(
                "is queued"
              ),
          },
        ]);
        expect(
          listEventScheduleOccurrences(
            scheduleId
          )
        ).toMatchObject([
          {
            status:
              "queued",
          },
          {
            status:
              "skipped",
            reason:
              expect.stringContaining(
                "is queued"
              ),
          },
        ]);
      }
    );
  }
);
