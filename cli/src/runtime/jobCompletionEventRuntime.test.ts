import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  attachBusinessFunctionJob,
  clearBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";

import {
  addWorker,
  clearWorkers,
} from "../control/workers";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  addJobCompletionEventRule,
  clearJobCompletionEventRules,
} from "../events/jobCompletionEventRuleStore";

import {
  startRuntimeForBusinessFunction,
} from "../repl/runtimeCommands";

import {
  clearPolicyRules,
} from "../storage/policyRepository";

import {
  clearApprovalChains,
} from "./approvalChainStore";

import {
  clearJobs,
  enqueueJob,
} from "./jobQueue";

import {
  clearNotifications,
} from "./notificationStore";

import {
  clearRuntimeEventStore,
  listRuntimeEventStore,
} from "./runtimeEventStore";

import {
  processNextQueuedJob,
} from "./workerRuntime";

vi.mock("../llm/ollamaClient", () => ({
  generateWithOllama:
    vi.fn(
      async () => ({
        response:
          "A bounded analysis result.",
      })
    ),
}));

beforeEach(() => {
  vi.clearAllMocks();
  clearJobCompletionEventRules();
  clearRuntimeEventStore();
  clearNotifications();
  clearApprovalChains();
  clearPolicyRules();
  clearJobs();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
  clearWorkers();
});

describe("automatic post-Job Event publication", () => {
  it("applies a configured Event rule when its Runtime-owned Job completes", async () => {
    const enterprise =
      createAndSaveEnterprise({
        name:
          "Evidence Company",
        mission:
          "Turn evidence into decisions.",
      });
    const definition =
      createAndSaveBusinessFunctionDefinition({
        id:
          `${enterprise.id}:function-1`,
        enterpriseId:
          enterprise.id,
        label:
          "Evidence Analysis",
        objective:
          "Analyse supplied evidence.",
      });
    const runtime =
      startRuntimeForBusinessFunction(
        definition
      );
    addWorker({
      name:
        "Evidence Analyst",
      kind:
        "ai",
      archetype:
        "analyst",
      model:
        "llama3.2:latest",
      capabilities: [
        "analysis",
      ],
      run: function* (
        input:
          unknown
      ) {
        return input;
      },
    });
    const queued =
      enqueueJob(
        "Analyse the supplied evidence.",
        "Evidence Analyst",
        {
          enterpriseId:
            enterprise.id,
          requiredCapabilities: [
            "analysis",
          ],
        }
      );
    attachBusinessFunctionJob(
      runtime.id,
      queued.id
    );
    const rule =
      addJobCompletionEventRule({
        enterpriseId:
          enterprise.id,
        sourceBusinessFunctionId:
          definition.id,
        requiredCapability:
          "analysis",
        publishedEventLabel:
          "Evidence analysis ready",
      });
    const broadcastTypes:
      string[] =
      [];

    const completed =
      await processNextQueuedJob(
        (
          type
        ) => {
          broadcastTypes.push(
            type
          );
        }
      );

    expect(
      completed?.status
    ).toBe(
      "completed"
    );
    const businessEvent =
      listRuntimeEventStore()
        .find(
          (event) =>
            event.type ===
            "business.evidence.analysis.ready"
        );
    expect(
      businessEvent
        ?.payload
    ).toMatchObject({
      triggerEventRuleId:
        rule.id,
      sourceJobId:
        queued.id,
    });
    expect(
      broadcastTypes
    ).toContain(
      "event.rule.published"
    );
  });
});
