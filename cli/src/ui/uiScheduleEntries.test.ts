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
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  clearJobs,
  listJobs,
} from "../runtime/jobQueue";

import {
  clearRuntimeEventStore,
} from "../runtime/runtimeEventStore";

import {
  clearEventSchedules,
  listEventSchedules,
} from "../scheduling/eventScheduleStore";

import {
  handleUiScheduleCommand,
} from "./uiScheduleEntries";

import { vi } from "vitest";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { runtimeDb } from "../storage/runtimeDatabase";
import { clearWebSearchSwitches, turnWebSearchOn } from "../runtime/webSearchSwitch";

describe(
  "uiScheduleEntries",
  () => {
    const clearState =
      (): void => {
        clearEventSchedules();
        clearJobs();
        clearRuntimeEventStore();
        clearBusinessFunctionDefinitions();
        clearEnterprises();
        clearWebSearchSwitches();
        clearWorkers();
        runtimeDb.prepare("DELETE FROM enterprise_worker_memberships").run();
        vi.unstubAllEnvs();
      };

    beforeEach(
      clearState
    );
    afterEach(
      clearState
    );

    it(
      "creates, lists, inspects, and removes a weekly Task schedule",
      () => {
        const enterprise =
          createAndSaveEnterprise({
            name:
              "Science Tracker",
            mission:
              "Find and summarise current science news.",
          });
        const job =
          createAndSaveBusinessFunctionDefinition({
            id:
              `${enterprise.id}:function-1`,
            enterpriseId:
              enterprise.id,
            label:
              "Science Discovery",
            objective:
              "Retrieve current public science evidence from the internet.",
          });

        const addSchedule = () =>
          handleUiScheduleCommand([
            "add",
            "Retrieve and summarise current public science news.",
            "--every",
            "friday",
            "--at",
            "18:00",
            "--timezone",
            "Pacific/Auckland",
            "--job",
            "Science Discovery",
            "--enterprise",
            "Science Tracker",
            "--search-query",
            "latest public science news",
          ]);
        // Search words are refused, before anything is written, until the business turns web search on (W3).
        vi.stubEnv("ARTURO_WEB_SEARCH_PROVIDER", "brave");
        vi.stubEnv("ARTURO_WEB_SEARCH_MAX_CALLS_PER_SESSION", "2");
        vi.stubEnv("BRAVE_SEARCH_API_KEY", "test-key");
        const refused = addSchedule();
        expect(refused).toMatchObject({ label: "Task schedule not changed", body: expect.stringContaining("Web search is off for Science Tracker") });
        expect(listEventSchedules()).toEqual([]);
        expect(listJobs()).toEqual([]);
        addWorker(createHumanWorker("Amy Wise", "guardian"));
        runtimeDb.prepare("INSERT INTO enterprise_worker_memberships VALUES(?,?,NULL)").run("Amy Wise", enterprise.id);
        turnWebSearchOn({ enterpriseId: enterprise.id, reason: "Weekly science news.", actor: { userId: "user-amy", workerName: "Amy Wise", displayName: "Amy Wise", roles: new Map([[enterprise.id, "owner"]]) } });
        const added = addSchedule();
        expect(
          added.label
        ).toBe(
          "Task schedule added"
        );
        expect(
          added.body
        ).toContain(
          "Pacific/Auckland"
        );
        expect(
          added.body
        ).toContain(
          "latest public science news"
        );
        expect(
          added.body
        ).toContain(
          "weekly · Friday"
        );
        expect(
          added.body
        ).toContain(
          "Function:         Science Discovery"
        );

        const [
          schedule,
        ] =
          listEventSchedules();
        expect(schedule).toMatchObject({
          owningJobId:
            job.id,
          taskLabel:
            "Retrieve and summarise current public science news.",
        });
        expect(
          listJobs()
        ).toMatchObject([
          {
            id:
              schedule.taskId,
            status:
              "scheduled",
            worker:
              undefined,
            owningJobId:
              job.id,
          },
        ]);
        expect(
          handleUiScheduleCommand([
            "list",
            "--enterprise",
            "Science Tracker",
          ]).body
        ).toContain(
          schedule.id
        );
        expect(
          handleUiScheduleCommand([
            "inspect",
            schedule.id,
          ]).body
        ).toContain(
          "Retrieve and summarise current public science news."
        );
        expect(
          handleUiScheduleCommand([
            "remove",
            schedule.id,
          ]).label
        ).toBe(
          "Task schedule removed"
        );
        expect(
          listEventSchedules()
        ).toEqual([]);
      }
    );

    it(
      "rejects the former Function and Event schedule switches",
      () => {
        const result =
          handleUiScheduleCommand([
            "add",
            "Check the backup schedule.",
            "--publish",
            "Backup due",
          ]);

        expect(
          result.label
        ).toBe(
          "Task schedule not changed"
        );
        expect(
          result.body
        ).toContain(
          "Schedules belong to Tasks"
        );
        expect(
          listJobs()
        ).toEqual([]);
      }
    );
  }
);
