// src/repl/askCommand.ts

import {
  formatAskRequest,
  planAskWorkflow,
} from "./askWorkflow";

/**
 * Handles the /ask command.
 *
 * @param args Command arguments.
 * @returns Promise resolving when the planned workflow has been queued.
 *
 * SIDE EFFECT:
 * - Calls the workflow planner.
 * - Queues workflow execution.
 * - Wakes the worker runtime.
 * - Broadcasts runtime event.
 * - Writes CLI output.
 */
export async function handleAskCommand(
  args: readonly string[]
): Promise<void> {
  const request =
    formatAskRequest(
      args.filter(
        (arg) => arg !== "--auto-workers"
      )
    );

  if (!request) {
    console.log(
      'Usage: /ask "<request>"'
    );

    return;
  }

  console.log(
    "Planning workflow..."
  );

  const result =
    await planAskWorkflow(
      args
    );

  console.log(
    `Planner objective: ${result.enforcedPlan.objective}`
  );

  console.log(
    "Planner steps:"
  );

  for (const step of result.enforcedPlan.steps) {
    console.log(
      `- ${step.archetype}: ${step.instruction}`
    );
  }

  if (result.autoWorkers) {
    console.log(
      "Auto-workers:"
    );

    if (result.autoCreatedWorkers.length === 0) {
      console.log(
        "- no missing workers created"
      );
    } else {
      for (const worker of result.autoCreatedWorkers) {
        console.log(
          `- ${worker.kind}: ${worker.name} (${worker.archetype})`
        );
      }
    }
  }

  console.log(
    `Explanation: ${result.enforcedPlan.explanation}`
  );

  console.log(
    `workflow created: ${result.workflowRunId}`
  );

  console.log(
    `steps planned: ${result.stepCount}`
  );

  console.log(
    `first worker: ${result.firstWorkerName}`
  );

  console.log("");

console.log(
  "Plan is ready for review."
);

console.log("");

console.log(
  "Tasks have been drafted but execution has not started yet."
);

console.log(
  "Use /tasks to review the plan."
);

console.log(
  "Use /task-detail <id> to inspect one task."
);

console.log(
  'Use /refine-task <id> "<notes>" to customise a task.'
);

console.log(
  `Use /start ${result.workflowRunId} when ready to create Tasks and begin execution.`
);
}
