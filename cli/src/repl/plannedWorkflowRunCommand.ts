import type {
  WorkflowPlan,
} from "../agents/workflowPlan";

import {
  queueWorkflowExecution,
} from "../agents/queueWorkflowExecution";

import {
  resolveWorkflowWorkers,
} from "../agents/resolveWorkflowWorkers";

import type {
  PlannedWorkflow,
} from "../control/workflows";

import {
  getWorkflow,
} from "../control/workflows";

import {
  listWorkers,
} from "../control/workers";

import {
  wakeWorkerRuntime,
} from "../runtime/workerRuntime";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

import {
  ensureWorkflowWorkersAvailable,
  type AutoCreatedWorker,
} from "./askWorkflow";

import {
  formatArtefactReference,
  parseArtefactReference,
  parseArtefactReferences,
} from "../artefacts/artefact";

import {
  formatArtefactContextForWorker,
} from "../artefacts/artefactStore";

import {
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";

export type PlannedWorkflowRunOptions = {
  readonly autoWorkers: boolean;
  readonly workflowName: string | undefined;
  readonly task: string;
  readonly inputArtefactRefs: readonly string[];
  readonly enterpriseId?: string;
};

export type PlannedWorkflowRunResult = {
  readonly workflowName: string;
  readonly workflowRunId: string;
  readonly stepCount: number;
  readonly firstWorkerName: string | undefined;
  readonly autoWorkers: boolean;
  readonly autoCreatedWorkers: readonly AutoCreatedWorker[];
};

/**
 * Purpose: Parses /run arguments for planned workflow execution.
 *
 * Params:
 * - args: Raw /run command arguments.
 *
 * Returns:
 * - Parsed planned workflow run options.
 *
 * PURE: No side effects.
 */
export function parsePlannedWorkflowRunOptions(
  args: readonly string[]
): PlannedWorkflowRunOptions {
  const autoWorkers =
    args.includes(
      "--auto-workers"
    );

  let inputArtefactValue:
    string |
    undefined;
  let enterpriseValue:
    string |
    undefined;
  const remaining:
    string[] =
    [];

  for (
    let index = 0;
    index < args.length;
    index += 1
  ) {
    const arg =
      args[index];
    if (
      arg ===
      "--auto-workers"
    ) {
      continue;
    }
    if (
      arg ===
      "--input-artefact"
    ) {
      inputArtefactValue =
        args[
          index + 1
        ];
      if (
        !inputArtefactValue ||
        inputArtefactValue.startsWith(
          "--"
        )
      ) {
        throw new Error(
          "--input-artefact requires <artefact-id>@<version>[,...]."
        );
      }
      index += 1;
      continue;
    }
    if (
      arg ===
      "--enterprise"
    ) {
      enterpriseValue =
        args[
          index + 1
        ];
      if (
        !enterpriseValue ||
        enterpriseValue.startsWith(
          "--"
        )
      ) {
        throw new Error(
          "--enterprise requires an Enterprise name or ID."
        );
      }
      index += 1;
      continue;
    }
    if (
      arg.startsWith(
        "--enterprise="
      )
    ) {
      enterpriseValue =
        arg.slice(
          "--enterprise="
            .length
        );
      continue;
    }
    if (
      arg.startsWith(
        "--input-artefact="
      )
    ) {
      inputArtefactValue =
        arg.slice(
          "--input-artefact="
            .length
        );
      continue;
    }
    remaining.push(
      arg
    );
  }

  const [
    workflowName,
    ...taskParts
  ] = remaining;

  return {
    autoWorkers,
    workflowName,
    task:
      taskParts
        .join(" ")
        .trim(),
    inputArtefactRefs:
      inputArtefactValue
        ? parseArtefactReferences(
            inputArtefactValue
          ).map(
            formatArtefactReference
          )
        : [],
    enterpriseId:
      enterpriseValue
        ? (
            getEnterpriseByIdOrName(
              enterpriseValue
            ) ??
            (() => {
              throw new Error(
                `Enterprise not found: ${enterpriseValue}`
              );
            })()
          ).id
        : undefined,
  };
}

/** Adds exact initial Artefact metadata and bounded text to the first step. */
export function addInitialArtefactContext(
  plan: WorkflowPlan,
  references: readonly string[]
): WorkflowPlan {
  if (!references.length) {
    return plan;
  }

  const firstStep =
    plan.steps[0];
  if (!firstStep) {
    return plan;
  }

  const context =
    formatArtefactContextForWorker(
      references.map(
        parseArtefactReference
      )
    );

  return {
    ...plan,
    steps: [
      {
        ...firstStep,
        instruction: [
          firstStep.instruction,
          "",
          context,
        ].join(
          "\n"
        ),
      },
      ...plan.steps.slice(
        1
      ),
    ],
  };
}

/**
 * Purpose: Builds the objective used when running a saved planned workflow.
 *
 * Params:
 * - workflow: Saved planned workflow.
 * - task: Optional run-specific task.
 *
 * Returns:
 * - Runtime objective for this workflow run.
 *
 * PURE: No side effects.
 */
export function createPlannedWorkflowRunObjective(
  workflow: PlannedWorkflow,
  task: string
): string {
  if (!task) {
    return workflow.objective;
  }

  return [
    workflow.objective,
    "",
    `Run task: ${task}`,
  ].join("\n");
}

/**
 * Purpose: Adds run-specific context to a planned workflow step instruction.
 *
 * Params:
 * - instruction: Saved workflow step instruction.
 * - objective: Runtime objective for this workflow run.
 *
 * Returns:
 * - Instruction enriched with runtime context.
 *
 * PURE: No side effects.
 */
export function createRunnableStepInstruction(
  instruction: string,
  objective: string
): string {
  return [
    instruction,
    "",
    "Run context:",
    objective,
  ].join("\n");
}

/**
 * Purpose: Converts a saved planned workflow into a runnable workflow plan.
 *
 * Params:
 * - workflow: Saved planned workflow.
 * - task: Optional run-specific task.
 *
 * Returns:
 * - Workflow plan ready for worker resolution and queueing.
 *
 * PURE: No side effects.
 */
export function createRunnablePlannedWorkflowPlan(
  workflow: PlannedWorkflow,
  task: string
): WorkflowPlan {
  const objective =
    createPlannedWorkflowRunObjective(
      workflow,
      task
    );

  return {
    objective,
    explanation:
      workflow.explanation,
    steps:
      workflow.steps.map(
        (step) => ({
          ...step,
          instruction:
            createRunnableStepInstruction(
              step.instruction,
              objective
            ),
        })
      ),
  };
}

/**
 * Purpose: Runs a saved planned workflow by queueing its first executable step.
 *
 * Params:
 * - args: /run command arguments.
 *
 * Returns:
 * - Planned workflow run result.
 *
 * SIDE EFFECT:
 * - Reads workflow registry.
 * - Reads registered workers.
 * - Optionally registers missing workers.
 * - Queues workflow execution.
 * - Wakes worker runtime.
 * - Broadcasts runtime event.
 */
export function runPlannedWorkflowFromArgs(
  args: readonly string[]
): PlannedWorkflowRunResult {
  const options =
    parsePlannedWorkflowRunOptions(
      args
    );

  if (!options.workflowName) {
    throw new Error(
      'Usage: /run [--auto-workers] <workflow> ["<task>"] [--enterprise "<enterprise>"] [--input-artefact <artefact-id>@<version>[,...]]'
    );
  }

  const workflow =
    getWorkflow(
      options.workflowName
    );

  if (!workflow) {
    throw new Error(
      `workflow not found: ${options.workflowName}`
    );
  }

  if (workflow.mode !== "planned") {
    throw new Error(
      `${options.workflowName} is not a planned workflow`
    );
  }

  const runnablePlan =
    addInitialArtefactContext(
      createRunnablePlannedWorkflowPlan(
        workflow,
        options.task
      ),
      options.inputArtefactRefs
    );

  const autoCreatedWorkers =
    ensureWorkflowWorkersAvailable(
      runnablePlan,
      options.autoWorkers
    );

  const resolvedPlan =
    resolveWorkflowWorkers(
      runnablePlan,
      listWorkers()
    );

  const result =
    queueWorkflowExecution(
      resolvedPlan,
      options.inputArtefactRefs,
      options.enterpriseId
    );

  wakeWorkerRuntime();

  broadcastEvent(
    "workflow.run",
    "success",
    `Planned workflow run queued: ${workflow.name} ${result.workflowRunId}`
  );

  return {
    workflowName:
      workflow.name,
    workflowRunId:
      result.workflowRunId,
    stepCount:
      resolvedPlan.steps.length,
    firstWorkerName:
      resolvedPlan.steps[0]?.workerName,
    autoWorkers:
      options.autoWorkers,
    autoCreatedWorkers,
  };
}

/**
 * Purpose: Handles planned workflow execution from /run.
 *
 * Params:
 * - args: /run command arguments.
 *
 * Returns:
 * - True when a planned workflow was handled; false when caller should use legacy /run handling.
 *
 * SIDE EFFECT:
 * - May queue a planned workflow run.
 * - Writes CLI output.
 */
export function handlePlannedWorkflowRunCommand(
  args: readonly string[]
): boolean {
  const options =
    parsePlannedWorkflowRunOptions(
      args
    );

  if (!options.workflowName) {
    return false;
  }

  const workflow =
    getWorkflow(
      options.workflowName
    );

  if (!workflow) {
    return false;
  }

  if (workflow.mode !== "planned") {
    return false;
  }

  try {
    const result =
      runPlannedWorkflowFromArgs(
        args
      );

    console.log(
      `planned workflow run queued: ${result.workflowName}`
    );

    console.log(
      `workflow run: ${result.workflowRunId}`
    );

    console.log(
      `steps: ${result.stepCount}`
    );

    console.log(
      `first worker: ${result.firstWorkerName ?? "none"}`
    );

    if (result.autoWorkers) {
      console.log(
        result.autoCreatedWorkers.length > 0
          ? `auto-workers created: ${result.autoCreatedWorkers
              .map(
                (worker) =>
                  `${worker.name}(${worker.archetype})`
              )
              .join(", ")}`
          : "auto-workers created: none"
      );
    }

    return true;
  } catch (error) {
    console.log(
      `planned workflow run error: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );

    return true;
  }
}
