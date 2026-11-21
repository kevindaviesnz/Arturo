import fs from "node:fs";
import { saveStaffingAssignment } from "../staffing/staffingStore";
import os from "node:os";
import path from "node:path";

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  clearArtefacts,
} from "../artefacts/artefactStore";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  attachBusinessFunctionJob,
  clearBusinessFunctions,
  getBusinessFunction,
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
  captureWebSearchEvidence,
} from "../integrations/webSearch";

import {
  startRuntimeForBusinessFunction,
} from "../repl/runtimeCommands";

import {
  clearJobs,
  completeJob,
  enqueueJob,
  listJobs,
  replaceJob,
  startJob,
} from "../runtime/jobQueue";

import {
  clearRuntimeEventStore,
  listRuntimeEventStore,
} from "../runtime/runtimeEventStore";

import {
  clearJobCompletionEventRules,
  addJobCompletionEventRule,
} from "./jobCompletionEventRuleStore";

import {
  publishConfiguredEventsForCompletedJob,
  resolveVerifiedWebSearchEvidence,
} from "./jobCompletionEventPublisher";

let temporaryDirectory:
  string;

beforeEach(() => {
  temporaryDirectory =
    fs.mkdtempSync(
      path.join(
        os.tmpdir(),
        "arturo-event-rule-"
      )
    );
  clearJobCompletionEventRules();
  clearRuntimeEventStore();
  clearArtefacts();
  clearJobs();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
  clearWorkers();
});

afterEach(() => {
  clearJobCompletionEventRules();
  clearRuntimeEventStore();
  clearArtefacts();
  clearJobs();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearEnterprises();
  clearWorkers();
  fs.rmSync(
    temporaryDirectory,
    {
      recursive:
        true,
      force:
        true,
    }
  );
});

function createScienceCompletionFixture() {
  const enterprise =
    createAndSaveEnterprise({
      name:
        "Science Tracker",
      mission:
        "Find and summarise current science news.",
    });
  const discovery =
    createAndSaveBusinessFunctionDefinition({
      id:
        `${enterprise.id}:function-1`,
      enterpriseId:
        enterprise.id,
      label:
        "Science Discovery",
      objective:
        "Retrieve current public science evidence.",
    });
  const summary =
    createAndSaveBusinessFunctionDefinition({
      id:
        `${enterprise.id}:function-2`,
      enterpriseId:
        enterprise.id,
      label:
        "Science Summarisation",
      objective:
        "Summarise supplied science evidence.",
    });
  const discoveryRuntime =
    startRuntimeForBusinessFunction(
      discovery
    );
  const summaryRuntime =
    startRuntimeForBusinessFunction(
      summary
    );
  const researcher = {
    name:
      "Science News Researcher",
    displayName:
      "Science News Researcher",
    kind:
      "ai" as const,
    archetype:
      "researcher" as const,
    model:
      "llama3.2:latest",
    capabilities: [
      "web-research" as const,
      "research" as const,
    ],
    run: function* (
      input:
        unknown
    ) {
      return input;
    },
  };
  addWorker(
    researcher
  );
  addWorker({
    name:
      "Science Summary Worker",
    kind:
      "ai",
    archetype:
      "assistant",
    capabilities: [
      "summarisation",
    ],
    run: function* (
      input:
        unknown
    ) {
      return input;
    },
  });
  // The downstream Task is created through createTask (C1), which needs the
  // Function to be staffed, as it does for a person's Task.
  saveStaffingAssignment({ businessFunctionId: summary.id, workerName: "Science Summary Worker", role: "ai", rationale: "test" });
  const queued =
    enqueueJob(
      "Retrieve the latest public science news.",
      researcher.name,
      {
        requiredCapabilities: [
          "web-research",
        ],
        enterpriseId:
          enterprise.id,
        webSearchQuery:
          "latest public science news",
      }
    );
  attachBusinessFunctionJob(
    discoveryRuntime.id,
    queued.id
  );
  const captured =
    captureWebSearchEvidence(
      {
        provider:
          "brave",
        query:
          "latest public science news",
        retrievedAt:
          "2026-07-18T09:00:00.000Z",
        results: [
          {
            title:
              "A new telescope result",
            url:
              "https://example.com/science",
            sourceDomain:
              "example.com",
            snippet:
              "A bounded search-result snippet.",
          },
        ],
      },
      enterprise,
      queued,
      researcher,
      temporaryDirectory
    );
  replaceJob({
    ...queued,
    inputArtefactRefs: [
      captured
        .artefactReference,
    ],
  });
  startJob(
    queued.id
  );
  const completed =
    completeJob(
      queued.id,
      "A model-generated summary."
    );

  return {
    enterprise,
    discovery,
    discoveryRuntime,
    summaryRuntime,
    completed,
    captured,
  };
}

describe("post-Job Event publication", () => {
  it("publishes once after verified Web Search evidence and passes it downstream", async () => {
    const fixture =
      createScienceCompletionFixture();
    addJobCompletionEventRule({
      enterpriseId:
        fixture.enterprise.id,
      sourceBusinessFunctionId:
        fixture.discovery.id,
      requiredCapability:
        "web-research",
      publishedEventLabel:
        "Science evidence ready",
    });
    const observedFunctions:
      string[] =
      [];
    const reasoner =
      async (
        definition:
          {
            readonly label:
              string;
          }
      ) => {
        observedFunctions.push(
          definition.label
        );
        return {
          shouldCreateJob:
            true,
          task:
            "Summarise the supplied science evidence.",
          reason:
            "Verified captured evidence is ready.",
          requiredCapabilities: [
            "summarisation" as const,
          ],
        };
      };

    const first =
      await publishConfiguredEventsForCompletedJob(
        fixture.completed,
        reasoner
      );
    const second =
      await publishConfiguredEventsForCompletedJob(
        fixture.completed,
        reasoner
      );

    expect(
      first[0].status
    ).toBe(
      "published"
    );
    expect(
      second[0].status
    ).toBe(
      "already_published"
    );
    expect(
      observedFunctions
    ).toEqual([
      "Science Summarisation",
    ]);
    const businessEvent =
      listRuntimeEventStore()
        .find(
          (event) =>
            event.type ===
            "business.science.evidence.ready"
        );
    expect(
      businessEvent?.payload
    ).toMatchObject({
      sourceJobId:
        fixture.completed.id,
      sourceBusinessFunctionId:
        fixture.discovery.id,
      requiredCapability:
        "web-research",
      evidenceArtefacts:
        fixture.captured
          .artefactReference,
      searchQuery:
        "latest public science news",
      searchResultCount:
        1,
    });
    const downstreamJobId =
      getBusinessFunction(
        fixture.summaryRuntime.id
      )?.jobIds[0];
    const downstreamJob =
      listJobs().find(
        (job) =>
          job.id ===
          downstreamJobId
      );
    expect(
      downstreamJob
        ?.inputArtefactRefs
    ).toEqual([
      fixture.captured
        .artefactReference,
    ]);
    expect(
      downstreamJob
        ?.enterpriseId
    ).toBe(
      fixture.enterprise.id
    );
  });

  it("does not publish a web-research Event without verified evidence", async () => {
    const fixture =
      createScienceCompletionFixture();
    fs.writeFileSync(
      fixture.captured
        .evidencePath,
      "{}"
    );
    addJobCompletionEventRule({
      enterpriseId:
        fixture.enterprise.id,
      sourceBusinessFunctionId:
        fixture.discovery.id,
      requiredCapability:
        "web-research",
      publishedEventLabel:
        "Science evidence ready",
    });

    expect(
      resolveVerifiedWebSearchEvidence(
        fixture.completed,
        fixture.enterprise.id
      )
    ).toBeUndefined();
    const evaluations =
      await publishConfiguredEventsForCompletedJob(
        fixture.completed
      );

    expect(
      evaluations[0]
        .status
    ).toBe(
      "skipped"
    );
    expect(
      listRuntimeEventStore()
        .some(
          (event) =>
            event.type ===
            "business.science.evidence.ready"
        )
    ).toBe(false);
  });
});
