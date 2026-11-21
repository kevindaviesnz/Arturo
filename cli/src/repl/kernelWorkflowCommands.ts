import {
  Kernel,
} from "../kernel/kernel";

import {
  blogWorkflow,
  builtInWorkflowRegistry,
} from "../kernel/kernelWorkflowPrototype";

import {
  runWorkflowDefinition,
} from "../kernel/runWorkflowDefinition";

/**
 * Handles the /kernel-blog command.
 *
 * @param kernel Runtime kernel instance.
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Spawns a kernel workflow process.
 * - Writes CLI output.
 */
export function handleKernelBlogCommand(
  kernel: Kernel,
  args: readonly string[]
): void {
  const topic =
    args.join(" ");

  if (!topic) {
    console.log(
      'Usage: /kernel-blog "<topic>"'
    );

    return;
  }

  kernel.syscall({
    type: "spawn",
    name: "kernel-blog",
    context: topic,
    run: function* (
      ctx: string
    ) {
      return yield* blogWorkflow(
        ctx
      );
    },
  });

  console.log(
    `kernel workflow spawned: ${topic}`
  );
}

/**
 * Handles the /run-workflow-definition command.
 *
 * @param kernel Runtime kernel instance.
 * @param args Command arguments.
 * @returns void
 *
 * SIDE EFFECT:
 * - Looks up a built-in kernel workflow definition.
 * - Spawns a kernel workflow process.
 * - Writes CLI output.
 */
export function handleRunWorkflowDefinitionCommand(
  kernel: Kernel,
  args: readonly string[]
): void {
  const [
    workflowId,
    ...contextParts
  ] = args;

  const context =
    contextParts.join(" ");

  if (!workflowId) {
    console.log(
      'Usage: /run-workflow-definition <workflow-id> "<context>"'
    );

    return;
  }

  const workflow =
    builtInWorkflowRegistry[
      workflowId
    ];

  if (!workflow) {
    console.log(
      `workflow definition not found: ${workflowId}`
    );

    return;
  }

  kernel.syscall({
    type: "spawn",
    name: workflow.id,
    context,
    run: function* (
      ctx: string
    ) {
      return yield* runWorkflowDefinition(
        workflow,
        ctx
      );
    },
  });

  console.log(
    `workflow definition spawned: ${workflow.id}`
  );
}