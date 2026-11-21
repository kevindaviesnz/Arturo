import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createWorkflowPlan,
} from "../agents/createWorkflowPlan";

import {
  createPlannedWorkflow,
} from "../control/workflows";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  buildReusableWorkflowPlannerRequest,
  createGeneratedWorkflow,
  createWorkflowSlug,
  formatWorkflowRequest,
  handleGeneratedWorkflowCommand,
} from "./generatedWorkflowCommand";

vi.mock(
  "../agents/createWorkflowPlan",
  () => ({
    createWorkflowPlan:
      vi.fn(),
  })
);

vi.mock(
  "../control/workflows",
  () => ({
    createPlannedWorkflow:
      vi.fn(),
  })
);

vi.mock(
  "../runtime/runtimeEventPublisher",
  () => ({
    broadcastEvent:
      vi.fn(),
  })
);

const mockPlan = {
  objective:
    "Create a reusable fast fashion startup workflow.",
  explanation:
    "A reusable workflow for validating, planning, creating, reviewing, and launching fast fashion startup work.",
  steps: [
    {
      archetype:
        "researcher" as const,
      instruction:
        "Research fast fashion market trends, customer segments, competitors, and supply-chain considerations.",
    },
    {
      archetype:
        "analyst" as const,
      instruction:
        "Analyse the research findings and identify practical opportunities, risks, and constraints.",
    },
    {
      archetype:
        "planner" as const,
      instruction:
        "Turn the findings into a staged startup execution plan.",
    },
    {
      archetype:
        "creator" as const,
      instruction:
        "Create launch assets, messaging, workflow templates, and operating materials.",
    },
    {
      archetype:
        "reviewer" as const,
      instruction:
        "Review outputs for clarity, completeness, usefulness, and execution readiness.",
    },
  ],
};

describe(
  "generatedWorkflowCommand",
  () => {
    beforeEach(
      () => {
        vi.clearAllMocks();
      }
    );

    describe(
      "formatWorkflowRequest",
      () => {
        it(
          "joins command arguments into a single request",
          () => {
            expect(
              formatWorkflowRequest([
                "Create",
                "a",
                "workflow",
              ])
            ).toBe(
              "Create a workflow"
            );
          }
        );

        it(
          "trims surrounding whitespace",
          () => {
            expect(
              formatWorkflowRequest([
                "  Create",
                "workflow  ",
              ])
            ).toBe(
              "Create workflow"
            );
          }
        );

        it(
          "returns an empty string when no arguments are provided",
          () => {
            expect(
              formatWorkflowRequest([])
            ).toBe(
              ""
            );
          }
        );
      }
    );

    describe(
      "createWorkflowSlug",
      () => {
        it(
          "creates a clean workflow slug from a natural-language request",
          () => {
            expect(
              createWorkflowSlug(
                "Create a full workflow for a fast fashion start up"
              )
            ).toBe(
              "fast-fashion-start-up"
            );
          }
        );

        it(
          "removes punctuation and repeated separators",
          () => {
            expect(
              createWorkflowSlug(
                "Create: a workflow!!! for New Product Launch?"
              )
            ).toBe(
              "new-product-launch"
            );
          }
        );

        it(
          "falls back when the request contains no usable slug text",
          () => {
            expect(
              createWorkflowSlug(
                "Create a full workflow for the"
              )
            ).toBe(
              "generated-workflow"
            );
          }
        );
      }
    );

    describe(
      "buildReusableWorkflowPlannerRequest",
      () => {
        it(
          "builds a planner-safe request for reusable operational workflow generation",
          () => {
            const result =
              buildReusableWorkflowPlannerRequest(
                "Create a full workflow for a fast fashion start up"
              );

            expect(
              result
            ).toContain(
              "Create the actual operational workflow steps for the user's goal."
            );

            expect(
              result
            ).toContain(
              "User goal: Create a full workflow for a fast fashion start up"
            );

            expect(
              result
            ).toContain(
              "This is not a simple content-generation task."
            );

            expect(
              result
            ).toContain(
              "This is not a request to design, define, test, or review a workflow definition."
            );

            expect(
              result
            ).toContain(
              "Do not create steps about designing, defining, implementing, testing, or reviewing a workflow."
            );

            expect(
              result
            ).toContain(
              "Do not mention Arturo, workflow definitions, reusable workflow design, workflow construction, or workflow implementation in the step instructions."
            );

            expect(
              result
            ).toContain(
              "Create the workflow itself: each step must describe real-world work needed to achieve the user's stated goal."
            );

            expect(
              result
            ).toContain(
              "research, analysis, planning, creation, review"
            );

            expect(
              result
            ).toContain(
              "Return a workflow plan with a clear objective, explanation, and ordered steps."
            );
          }
        );
      }
    );

    describe(
      "createGeneratedWorkflow",
      () => {
        it(
          "throws a usage error when no request is provided",
          async () => {
            await expect(
              createGeneratedWorkflow([])
            ).rejects.toThrow(
              'Usage: /workflow "<workflow request>"'
            );

            expect(
              createWorkflowPlan
            ).not.toHaveBeenCalled();

            expect(
              createPlannedWorkflow
            ).not.toHaveBeenCalled();

            expect(
              broadcastEvent
            ).not.toHaveBeenCalled();
          }
        );

        it(
          "creates, saves, and broadcasts a planned workflow",
          async () => {
            vi.mocked(
              createWorkflowPlan
            ).mockResolvedValue(
              mockPlan
            );

            const result =
              await createGeneratedWorkflow([
                "Create",
                "a",
                "full",
                "workflow",
                "for",
                "a",
                "fast",
                "fashion",
                "start",
                "up",
              ]);

            expect(
              createWorkflowPlan
            ).toHaveBeenCalledWith(
              expect.stringContaining(
                "Create the actual operational workflow steps for the user's goal."
              )
            );

            expect(
              createWorkflowPlan
            ).toHaveBeenCalledWith(
              expect.stringContaining(
                "User goal: Create a full workflow for a fast fashion start up"
              )
            );

            expect(
              createWorkflowPlan
            ).toHaveBeenCalledWith(
              expect.stringContaining(
                "Do not create steps about designing, defining, implementing, testing, or reviewing a workflow."
              )
            );

            expect(
              createWorkflowPlan
            ).toHaveBeenCalledWith(
              expect.stringContaining(
                "Create the workflow itself: each step must describe real-world work needed to achieve the user's stated goal."
              )
            );

            expect(
              createPlannedWorkflow
            ).toHaveBeenCalledWith(
              "fast-fashion-start-up",
              mockPlan
            );

            expect(
              broadcastEvent
            ).toHaveBeenCalledWith(
              "workflow.registered",
              "success",
              "Planned workflow registered: fast-fashion-start-up"
            );

            expect(
              result
            ).toEqual({
              name:
                "fast-fashion-start-up",
              request:
                "Create a full workflow for a fast fashion start up",
              plannerRequest:
                expect.stringContaining(
                  "This is not a simple content-generation task."
                ),
              plan:
                mockPlan,
              generationMode:
                "model-generated",
            });
          }
        );
      }
    );

    describe(
      "handleGeneratedWorkflowCommand",
      () => {
        it(
          "prints a generated workflow summary",
          async () => {
            vi.mocked(
              createWorkflowPlan
            ).mockResolvedValue(
              mockPlan
            );

            const logSpy =
              vi
                .spyOn(
                  console,
                  "log"
                )
                .mockImplementation(
                  () => undefined
                );

            await handleGeneratedWorkflowCommand([
              "Create",
              "a",
              "full",
              "workflow",
              "for",
              "a",
              "fast",
              "fashion",
              "start",
              "up",
            ]);

            expect(
              logSpy
            ).toHaveBeenCalledWith(
              "workflow created: fast-fashion-start-up"
            );

            expect(
              logSpy
            ).toHaveBeenCalledWith(
              "mode: planned"
            );

            expect(
              logSpy
            ).toHaveBeenCalledWith(
              `objective: ${mockPlan.objective}`
            );

            expect(
              logSpy
            ).toHaveBeenCalledWith(
              `explanation: ${mockPlan.explanation}`
            );

            expect(
              logSpy
            ).toHaveBeenCalledWith(
              "steps:"
            );

            expect(
              logSpy
            ).toHaveBeenCalledWith(
              `1. researcher — ${mockPlan.steps[0].instruction}`
            );

            expect(
              logSpy
            ).toHaveBeenCalledWith(
              "Use /run fast-fashion-start-up to start this workflow."
            );

            logSpy.mockRestore();
          }
        );
      }
    );
  }
);
