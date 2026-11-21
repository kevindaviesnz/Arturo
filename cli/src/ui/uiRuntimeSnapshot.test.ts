import {
  countWaitingApprovals,
  formatRuntimeContextText,
} from "./uiRuntimeSnapshot";

import {
  describe,
  expect,
  it,
} from "vitest";

describe(
  "uiRuntimeSnapshot",
  () => {
    it(
      "counts pending approval chains",
      () => {
        expect(
          countWaitingApprovals([
            {
              status: "pending",
            },
            {
              status: "approved",
            },
            {
              status: "pending",
            },
          ] as never)
        ).toBe(
          2
        );
      }
    );

    it(
      "formats runtime context text",
      () => {
        expect(
          formatRuntimeContextText({
            workers: 3,
            jobs: 4,
            workflowRuns: 2,
            businessFunctions: 6,
            humanWorkers: 2,
            humanTasks: 1,
            waitingApprovals: 5,
            modelProvider: "Ollama",
            defaultModel: "llama3.2:latest",
            tokensUsed: 1234,
          })
        ).toContain(
          "Approvals waiting   {bold}5{/bold}"
        );

        expect(
          formatRuntimeContextText({
            workers: 3,
            jobs: 4,
            workflowRuns: 2,
            businessFunctions: 6,
            humanWorkers: 2,
            humanTasks: 1,
            waitingApprovals: 5,
            modelProvider: "Ollama",
            defaultModel: "llama3.2:latest",
            tokensUsed: 1234,
          })
        ).toContain(
          "Tokens used         {bold}1234{/bold}"
        );
      }
    );
  }
);
