import {
  createWorkflowPlan,
} from "../agents/createWorkflowPlan";

import type {
  WorkflowPlan,
} from "../agents/workflowPlan";

import {
  createPlannedWorkflow,
} from "../control/workflows";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  getWorker,
} from "../control/workers";

export type GeneratedWorkflowResult = {
  readonly name: string;
  readonly request: string;
  readonly plannerRequest: string;
  readonly plan: WorkflowPlan;
  readonly generationMode?:
    | "model-generated"
    | "deterministic";
};

export type DeterministicWorkflowStep = {
  readonly workerName: string;
  readonly instruction: string;
};

/** Returns the first value supplied for one workflow flag. */
export function getWorkflowFlagValue(
  args: readonly string[],
  flag: string
): string | undefined {
  const index =
    args.indexOf(
      flag
    );
  if (index >= 0) {
    return args[
      index + 1
    ];
  }
  const prefix =
    `${flag}=`;
  return args
    .find(
      (arg) =>
        arg.startsWith(
          prefix
        )
    )
    ?.slice(
      prefix.length
    );
}

/**
 * Parses repeated `--step "<worker>" "<instruction>"` pairs.
 *
 * Explicit Worker names make a demonstration reproducible and prevent an AI
 * planner from silently changing a Human handoff into model work.
 */
export function parseDeterministicWorkflowSteps(
  args: readonly string[]
): DeterministicWorkflowStep[] {
  const steps:
    DeterministicWorkflowStep[] =
    [];

  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    if (
      args[
        index
      ] !==
      "--step"
    ) {
      continue;
    }

    const workerName =
      args[
        index + 1
      ];
    const instruction =
      args[
        index + 2
      ];

    if (
      !workerName ||
      !instruction ||
      instruction.startsWith(
        "--"
      )
    ) {
      throw new Error(
        'Each --step requires "<worker>" "<instruction>".'
      );
    }

    steps.push({
      workerName,
      instruction,
    });
    index += 2;
  }

  if (!steps.length) {
    throw new Error(
      'At least one --step "<worker>" "<instruction>" is required.'
    );
  }

  return steps;
}

/** Creates a reusable planned workflow without a model call. */
export function createDeterministicWorkflow(
  args: readonly string[]
): GeneratedWorkflowResult {
  const name =
    args[1];

  if (!name) {
    throw new Error(
      'Usage: /workflow create "<name>" [--objective "<objective>"] --step "<worker>" "<instruction>" [--step ...]'
    );
  }

  const steps =
    parseDeterministicWorkflowSteps(
      args.slice(
        2
      )
    );
  const planSteps =
    steps.map(
      (step) => {
        const worker =
          getWorker(
            step.workerName
          );
        if (!worker) {
          throw new Error(
            `Worker not found: ${step.workerName}`
          );
        }
        if (!worker.archetype) {
          throw new Error(
            `Worker has no archetype: ${step.workerName}`
          );
        }
        return {
          archetype:
            worker.archetype,
          instruction:
            [
              `Assigned Worker: ${worker.displayName ?? worker.name}`,
              step.instruction,
            ].join(
              "\n"
            ),
        };
      }
    );
  const objective =
    getWorkflowFlagValue(
      args,
      "--objective"
    ) ??
    name;
  const plan: WorkflowPlan = {
    objective,
    explanation:
      "Operator-defined deterministic workflow. Arturo made no model call to choose or reorder these steps.",
    steps:
      planSteps,
  };
  const workflowName =
    createWorkflowSlug(
      name
    );

  createPlannedWorkflow(
    workflowName,
    plan
  );
  broadcastEvent(
    "workflow.registered",
    "success",
    `Deterministic workflow registered: ${workflowName}`
  );

  return {
    name:
      workflowName,
    request:
      name,
    plannerRequest:
      "No planner request: steps were supplied explicitly.",
    plan,
    generationMode:
      "deterministic",
  };
}

/**
 * Purpose: Converts text into a workflow-safe slug.
 *
 * Params:
 * - value: Raw text.
 *
 * Returns:
 * - Lowercase workflow slug.
 *
 * PURE: No side effects.
 */
export function createWorkflowSlug(
  value: string
): string {
  const cleaned =
    value
      .toLowerCase()
      .replace(
        /\b(create|generate|build|make|full|workflow|for|a|an|the)\b/g,
        " "
      )
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );

  return cleaned || "generated-workflow";
}

/**
 * Purpose: Converts command arguments into a workflow-generation request.
 *
 * Params:
 * - args: Raw command arguments.
 *
 * Returns:
 * - Trimmed workflow-generation request.
 *
 * PURE: No side effects.
 */
export function formatWorkflowRequest(
  args: readonly string[]
): string {
  return args
    .join(" ")
    .trim();
}

/**
 * Purpose: Converts a user workflow request into a planner-safe workflow design request.
 *
 * Params:
 * - request: User's natural-language workflow request.
 *
 * Returns:
 * - Expanded request that asks for a reusable multi-step workflow definition.
 *
 * PURE: No side effects.
 */
/**
 * Purpose: Converts a user workflow request into a planner-safe operational workflow design request.
 *
 * Params:
 * - request: User's natural-language workflow request.
 *
 * Returns:
 * - Expanded request that asks for a real reusable operational workflow, not meta-work about workflow design.
 *
 * PURE: No side effects.
 */
export function buildReusableWorkflowPlannerRequest(
  request: string
): string {
  return [
    "Create the actual operational workflow steps for the user's goal.",
    "",
    `User goal: ${request}`,
    "",
    "This is not a simple content-generation task.",
    "This is not a request to design, define, test, or review a workflow definition.",
    "Do not create steps about designing, defining, implementing, testing, or reviewing a workflow.",
    "Do not mention Arturo, workflow definitions, reusable workflow design, workflow construction, or workflow implementation in the step instructions.",
    "Create the workflow itself: each step must describe real-world work needed to achieve the user's stated goal.",
    "Create a practical reusable operational workflow that a startup founder or small team could actually run.",
    "Include appropriate real work for research, analysis, planning, creation, review, risk checking, and human/operator involvement where useful.",
    "Each step must use one of the available Arturo archetypes.",
    "Return a workflow plan with a clear objective, explanation, and ordered steps.",
  ].join("\n");
}

/**
 * Purpose: Creates and saves an AI-generated planned workflow.
 *
 * Params:
 * - args: Natural-language workflow request arguments.
 *
 * Returns:
 * - Generated workflow result.
 *
 * SIDE EFFECT:
 * - Calls the workflow planner.
 * - Saves generated workflow definition.
 * - Broadcasts workflow registration event.
 */
export async function createGeneratedWorkflow(
  args: readonly string[]
): Promise<GeneratedWorkflowResult> {
  if (
    args[0] ===
    "create"
  ) {
    return createDeterministicWorkflow(
      args
    );
  }

  const request =
    formatWorkflowRequest(
      args
    );

  if (!request) {
    throw new Error(
      'Usage: /workflow "<workflow request>"'
    );
  }

  const plannerRequest =
    buildReusableWorkflowPlannerRequest(
      request
    );

  const plan =
    await createWorkflowPlan(
      plannerRequest
    );

  const name =
    createWorkflowSlug(
      request
    );

  createPlannedWorkflow(
    name,
    plan
  );

  broadcastEvent(
    "workflow.registered",
    "success",
    `Planned workflow registered: ${name}`
  );

  return {
    name,
    request,
    plannerRequest,
    plan,
    generationMode:
      "model-generated",
  };
}

/**
 * Purpose: Handles the /workflow command as an AI workflow generator.
 *
 * Params:
 * - args: Natural-language workflow request arguments.
 *
 * Returns:
 * - Promise resolving after workflow creation completes.
 *
 * SIDE EFFECT:
 * - Calls workflow planner.
 * - Saves generated workflow.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
export async function handleGeneratedWorkflowCommand(
  args: readonly string[]
): Promise<void> {
  const result =
    await createGeneratedWorkflow(
      args
    );

  console.log(
    `workflow created: ${result.name}`
  );

  console.log(
    "mode: planned"
  );
  console.log(
    `source: ${result.generationMode ?? "model-generated"}`
  );

  console.log(
    `objective: ${result.plan.objective}`
  );

  if (result.plan.explanation) {
    console.log(
      `explanation: ${result.plan.explanation}`
    );
  }

  console.log(
    "steps:"
  );

  result.plan.steps.forEach(
    (step, index) => {
      console.log(
        `${index + 1}. ${step.archetype} — ${step.instruction}`
      );
    }
  );

  console.log("");

  console.log(
    `Use /run ${result.name} to start this workflow.`
  );
}
