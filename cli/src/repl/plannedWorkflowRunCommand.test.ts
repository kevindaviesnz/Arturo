import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  PlannedWorkflow,
} from "../control/workflows";

import {
  createPlannedWorkflowRunObjective,
  createRunnablePlannedWorkflowPlan,
  createRunnableStepInstruction,
  parsePlannedWorkflowRunOptions,
} from "./plannedWorkflowRunCommand";

const workflow: PlannedWorkflow = {
  name:
    "fast-fashion-start-up",
  mode:
    "planned",
  objective:
    "Create a full operational workflow for a fast fashion startup",
  explanation:
    "Operational workflow for startup validation and launch.",
  steps: [
    {
      archetype:
        "researcher",
      instruction:
        "Research market trends and target customers.",
    },
    {
      archetype:
        "analyst",
      instruction:
        "Analyse pricing and supply-chain risks.",
    },
  ],
};

describe(
  "plannedWorkflowRunCommand helpers",
  () => {
    it(
      "parses planned workflow run options without auto-workers",
      () => {
        expect(
          parsePlannedWorkflowRunOptions([
            "fast-fashion-start-up",
            "Validate",
            "a",
            "product",
          ])
        ).toEqual({
          autoWorkers:
            false,
          workflowName:
            "fast-fashion-start-up",
          task:
            "Validate a product",
          inputArtefactRefs:
            [],
        });
      }
    );

    it(
      "parses planned workflow run options with auto-workers",
      () => {
        expect(
          parsePlannedWorkflowRunOptions([
            "--auto-workers",
            "fast-fashion-start-up",
            "Validate",
            "a",
            "product",
          ])
        ).toEqual({
          autoWorkers:
            true,
          workflowName:
            "fast-fashion-start-up",
          task:
            "Validate a product",
          inputArtefactRefs:
            [],
        });
      }
    );

    it(
      "parses exact initial Artefact inputs without adding the flag to task text",
      () => {
        expect(
          parsePlannedWorkflowRunOptions([
            "fast-fashion-start-up",
            "Use supplied evidence",
            "--input-artefact",
            "artefact-1@1,artefact-2@3",
          ])
        ).toEqual({
          autoWorkers:
            false,
          workflowName:
            "fast-fashion-start-up",
          task:
            "Use supplied evidence",
          inputArtefactRefs: [
            "artefact-1@1",
            "artefact-2@3",
          ],
        });
      }
    );

    it(
      "uses saved objective when no task is supplied",
      () => {
        expect(
          createPlannedWorkflowRunObjective(
            workflow,
            ""
          )
        ).toBe(
          workflow.objective
        );
      }
    );

    it(
      "adds run task to objective when supplied",
      () => {
        expect(
          createPlannedWorkflowRunObjective(
            workflow,
            "Validate a sustainable Gen Z product idea"
          )
        ).toBe(
          [
            workflow.objective,
            "",
            "Run task: Validate a sustainable Gen Z product idea",
          ].join("\n")
        );
      }
    );

    it(
      "adds runtime context to step instruction",
      () => {
        expect(
          createRunnableStepInstruction(
            "Research target customers.",
            "Validate product idea."
          )
        ).toBe(
          [
            "Research target customers.",
            "",
            "Run context:",
            "Validate product idea.",
          ].join("\n")
        );
      }
    );

    it(
      "converts saved planned workflow into runnable plan",
      () => {
        expect(
          createRunnablePlannedWorkflowPlan(
            workflow,
            "Validate a sustainable Gen Z product idea"
          )
        ).toEqual({
          objective: [
            workflow.objective,
            "",
            "Run task: Validate a sustainable Gen Z product idea",
          ].join("\n"),
          explanation:
            workflow.explanation,
          steps: [
            {
              archetype:
                "researcher",
              instruction: [
                "Research market trends and target customers.",
                "",
                "Run context:",
                workflow.objective,
                "",
                "Run task: Validate a sustainable Gen Z product idea",
              ].join("\n"),
            },
            {
              archetype:
                "analyst",
              instruction: [
                "Analyse pricing and supply-chain risks.",
                "",
                "Run context:",
                workflow.objective,
                "",
                "Run task: Validate a sustainable Gen Z product idea",
              ].join("\n"),
            },
          ],
        });
      }
    );
  }
);
