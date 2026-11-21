// src/repl/manualWorkflowCommands.ts

import {
  createCapabilityWorkflow,
  createWorkflow,
  getWorkflow,
} from "../control/workflows";

import {
  handlePlannedWorkflowRunCommand,
} from "./plannedWorkflowRunCommand";

import {
  compileWorkflowDefinition,
} from "../control/workflowCompiler";

import {
  runCompiledWorkflow,
} from "../control/runCompiledWorkflow";

import {
  appendRunStep,
  createWorkflowRun,
} from "../runtime/workflowRunStore";

import {
  enqueueJob,
} from "../runtime/jobQueue";

import {
  parseWorkerCapabilities,
  parseWorkerCapability,
  selectWorkerForCapabilities,
} from "../control/workers";

import {
  broadcastEvent,
} from "../runtime/runtimeEventPublisher";

/**
 * Handles the /workflow command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Creates a workflow definition.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
export function handleWorkflowCommand(
  args: readonly string[]
): void {
  const [
    name,
    ...steps
  ] = args;

  if (
    !name ||
    steps.length === 0
  ) {
    console.log(
      "Usage: /workflow <name> <a> <b> <c>"
    );

    return;
  }

  createWorkflow(
    name,
    steps
  );

  console.log(
    `workflow created: ${name} → ${steps.join(" → ")}`
  );

  broadcastEvent(
    "workflow.registered",
    "info",
    `Workflow registered: ${name}`
  );
}

/**
 * Handles the /workflow-cap command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Creates a capability workflow definition.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
export function handleWorkflowCapCommand(
  args: readonly string[]
): void {
  const [
    name,
    ...capabilities
  ] = args;

  if (
    !name ||
    capabilities.length === 0
  ) {
    console.log(
      "Usage: /workflow-cap <name> <capability...>"
    );

    return;
  }

  createCapabilityWorkflow(
    name,
    capabilities
  );

  console.log(
    `capability workflow created: ${name} → ${capabilities.join(" → ")}`
  );

  broadcastEvent(
    "workflow.registered",
    "info",
    `Capability workflow registered: ${name}`
  );
}

/**
 * Handles the /run-cap command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Creates a workflow run.
 * - Enqueues the first capability job.
 * - Appends workflow run step state.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
export function handleRunCapCommand(
  args: readonly string[]
): void {
  const [
    wfName,
    ...taskParts
  ] = args;

  const task =
    taskParts.join(" ");

  if (
    !wfName ||
    !task
  ) {
    console.log(
      'Usage: /run-cap <workflow> "<task>"'
    );

    return;
  }

  const workflow =
    getWorkflow(
      wfName
    );

  if (!workflow) {
    console.log(
      `workflow not found: ${wfName}`
    );

    return;
  }

  if (workflow.mode === "planned") {
    console.log(
      `${wfName} is a planned workflow. Planned workflow execution is not enabled yet.`
    );

    return;
  }

  if (workflow.mode !== "capability") {
    console.log(
      `${wfName} is not a capability workflow`
    );

    return;
  }

  const [
    firstCapabilityRaw,
  ] = workflow.steps;

  if (!firstCapabilityRaw) {
    console.log(
      `capability workflow is empty: ${wfName}`
    );

    return;
  }

  const run =
    createWorkflowRun(
      workflow.name
    );

  console.log(
    `workflow run created: ${run.id}`
  );

  const capability =
    parseWorkerCapability(
      firstCapabilityRaw
    );

  const worker =
    selectWorkerForCapabilities([
      capability,
    ]);

  if (!worker) {
    console.log(
      `no worker found for capability: ${capability}`
    );

    return;
  }

  const stepTask =
    `[${workflow.name} step 1/${workflow.steps.length}: ${capability}] ${task}`;

  const job =
    enqueueJob(
      stepTask,
      worker.name,
      {
        requiredCapabilities: [
          capability,
        ],
        selectedWorker:
          worker.name,
        routingReason:
          `Workflow ${workflow.name} selected first worker matching: ${capability}`,
        workflowRunId:
          run.id,
        workflowName:
          workflow.name,
        workflowStepIndex:
          0,
        workflowStepCount:
          workflow.steps.length,
        workflowBaseTask:
          task,
        workflowCapabilities:
          parseWorkerCapabilities([
            ...workflow.steps,
          ]),
      }
    );

  appendRunStep(
    run.id,
    {
      index: 0,
      capability,
      task: stepTask,
      jobId: job.id,
      worker: worker.name,
      status: "queued",
    }
  );

  console.log(
    `step queued: ${capability} -> ${worker.displayName ?? worker.name}`
  );

  broadcastEvent(
    "workflow.run",
    "success",
    `Capability workflow run queued: ${workflow.name} ${run.id}`
  );
}

/**
 * Handles the /run command.
 *
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Runs a compiled worker workflow.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
export function handleRunCommand(
  args: readonly string[]
): void {
  const wfName =
    args[0] === "--auto-workers"
      ? args[1]
      : args[0];

  if (!wfName) {
    console.log(
      'Usage: /run [--auto-workers] <workflow> "<task>"'
    );

    return;
  }

  if (
    handlePlannedWorkflowRunCommand(
      args
    )
  ) {
    return;
  }

  try {
    const workflow =
      getWorkflow(
        wfName
      );

    if (!workflow) {
      console.log(
        `workflow not found: ${wfName}`
      );

      return;
    }

    if (workflow.mode === "planned") {
      console.log(
        `${wfName} is a planned workflow. Planned workflow execution is not enabled yet.`
      );

      return;
    }

    if (workflow.mode !== "worker") {
      console.log(
        `${wfName} is not a worker workflow`
      );

      return;
    }

    const compiled =
      compileWorkflowDefinition(
        workflow.name,
        [
          ...workflow.steps,
        ]
      );

    const run =
      runCompiledWorkflow(
        compiled
      );

    console.log(
      `running workflow: ${wfName}`
    );

    console.log(
      `# run created: ${run.id}`
    );

    broadcastEvent(
      "workflow.run",
      "success",
      `Workflow run completed: ${wfName} #${run.id}`
    );
  } catch (err: unknown) {
    console.log(
      `compile error: ${
        err instanceof Error
          ? err.message
          : String(err)
      }`
    );
  }
}