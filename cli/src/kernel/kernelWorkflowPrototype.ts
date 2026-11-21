import {
  createWorkflowDefinition,
  createWorkflowRegistry,
  type WorkflowDefinition,
} from "./workflowDefinition";

import {
  runWorkflowDefinition,
} from "./runWorkflowDefinition";

/**
 * Built-in kernel-native blog workflow.
 */
export const blogWorkflowDefinition =
  createWorkflowDefinition(
    "kernel-blog",
    "Kernel Blog Workflow",
    [
      {
        id: "research",
        capability:
          "research",
      },
      {
        id: "writing",
        capability:
          "writing",
      },
      {
        id: "review",
        capability:
          "human-review",
      },
    ]
  );

/**
 * Built-in deterministic workflow definitions.
 */
export const builtInWorkflowDefinitions: WorkflowDefinition[] =
  [
    blogWorkflowDefinition,
  ];

/**
 * Built-in workflow registry indexed by workflow id.
 */
export const builtInWorkflowRegistry =
  createWorkflowRegistry(
    builtInWorkflowDefinitions
  );

/**
 * Runs the built-in blog workflow.
 *
 * @param topic Blog topic.
 * @returns Kernel generator workflow.
 *
 * PURE: No side effects until interpreted by the kernel scheduler.
 */
export function* blogWorkflow(
  topic: string
) {
  return yield* runWorkflowDefinition(
    blogWorkflowDefinition,
    topic
  );
}