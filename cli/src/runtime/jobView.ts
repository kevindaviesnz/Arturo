import type {
  Job,
} from "./jobQueue";

/**
 * Extracts the previous step output from a workflow task.
 *
 * @param task Job task text.
 * @returns Previous step output or undefined.
 *
 * PURE: No side effects.
 */
export function extractPreviousStepOutput(
  task: string
): string | undefined {
  const marker =
    "Previous step output:";

  const index =
    task.indexOf(marker);

  if (index === -1) {
    return undefined;
  }

  return task
    .slice(
      index + marker.length
    )
    .trim();
}

/**
 * Extracts the visible task instruction before previous output.
 *
 * @param task Job task text.
 * @returns Task instruction.
 *
 * PURE: No side effects.
 */
export function extractTaskInstruction(
  task: string
): string {
  const marker =
    "Previous step output:";

  const index =
    task.indexOf(marker);

  if (index === -1) {
    return task.trim();
  }

  return task
    .slice(
      0,
      index
    )
    .trim();
}

/**
 * Removes a leading Task label from formatted task text.
 *
 * @param task Task text.
 * @returns Task text without leading Task label.
 *
 * PURE: No side effects.
 */
export function stripLeadingTaskLabel(
  task: string
): string {
  return task
    .replace(
      /^Task:\s*/i,
      ""
    )
    .trim();
}

/**
 * Formats optional line content.
 *
 * @param label Line label.
 * @param value Optional value.
 * @returns Formatted line or undefined.
 *
 * PURE: No side effects.
 */
export function formatOptionalLine(
  label: string,
  value: string | undefined
): string | undefined {
  if (!value) {
    return undefined;
  }

  return `${label}: ${value}`;
}

/**
 * Truncates long terminal content.
 *
 * @param value Text to truncate.
 * @param maxLength Maximum number of characters to keep.
 * @returns Truncated text.
 *
 * PURE: No side effects.
 */
export function truncateText(
  value: string,
  maxLength: number
): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(
    0,
    maxLength
  )}...`;
}

/**
 * Extracts the final output block from noisy worker output.
 *
 * Some local models echo the prompt before returning the actual answer. This
 * keeps only the final content after the last "Output:" marker.
 *
 * @param output Raw or cleaned worker output.
 * @returns Final output block.
 *
 * PURE: No side effects.
 */
export function extractFinalOutputBlock(
  output: string
): string {
  const marker =
    "Output:";

  const index =
    output.lastIndexOf(
      marker
    );

  if (index < 0) {
    return output.trim();
  }

  return output
    .slice(
      index + marker.length
    )
    .trim();
}

/**
 * Returns the best available cleaned job output.
 *
 * @param job Job record.
 * @returns Cleaned output text or undefined.
 *
 * PURE: No side effects.
 */
export function getJobDisplayOutput(
  job: Job
): string | undefined {
  const output =
    job.output ??
    job.rawOutput;

  return output
    ? extractFinalOutputBlock(
        output
      )
    : undefined;
}

/**
 * Formats review-loop attempt information.
 *
 * @param job Job record.
 * @returns Review-loop line or undefined.
 *
 * PURE: No side effects.
 */
export function formatReviewLoopLine(
  job: Job
): string | undefined {
  if (!job.reviewLoop) {
    return undefined;
  }

  return `Review loop: attempt ${job.reviewLoop.attempt}/${job.reviewLoop.maxAttempts}`;
}

/**
 * Formats a concise job summary for normal terminal display.
 *
 * @param job Job record.
 * @returns Human-readable concise job display.
 *
 * PURE: No side effects.
 */
export function formatJobView(
  job: Job
): string {
  const instruction =
    stripLeadingTaskLabel(
      extractTaskInstruction(
        job.task
      )
    );

  const output =
    getJobDisplayOutput(
      job
    );

  const lines = [
    `Task: ${job.id}`,
    `Status: ${job.status}`,
    `Worker: ${job.worker ?? "-"}`,
    formatOptionalLine(
      "Workflow",
      job.workflowName
    ),
    formatOptionalLine(
      "Step",
      job.workflowStepIndex === undefined ||
        job.workflowStepCount === undefined
        ? undefined
        : `${job.workflowStepIndex + 1}/${job.workflowStepCount}`
    ),
    formatReviewLoopLine(
      job
    ),
    "",
    "Instruction:",
    truncateText(
      instruction,
      700
    ),
  ];

  if (output) {
    lines.push(
      "",
      "Output:",
      output
      );
  }

  if (job.error) {
    lines.push(
      "",
      "Error:",
      job.error
    );
  }

  lines.push(
    "",
    "More detail:",
    `  /job-output ${job.id}`,
    `  /job-raw ${job.id}`
  );

  return lines
    .filter(
      (line) =>
        line !== undefined
    )
    .join("\n");
}

/**
 * Formats a full raw job view for debugging.
 *
 * @param job Job record.
 * @returns Full human-readable debug job display.
 *
 * PURE: No side effects.
 */
export function formatJobRawView(
  job: Job
): string {
  const instruction =
    stripLeadingTaskLabel(
      extractTaskInstruction(
        job.task
      )
    );

  const previousOutput =
    extractPreviousStepOutput(
      job.task
    );

  const plannerExplanation =
    job.workflowPlan
      ?.explanation;

  const lines = [
    `Task: ${job.id}`,
    `Status: ${job.status}`,
    `Worker: ${job.worker ?? "-"}`,
    formatOptionalLine(
      "Workflow",
      job.workflowName
    ),
    formatOptionalLine(
      "Step",
      job.workflowStepIndex === undefined ||
        job.workflowStepCount === undefined
        ? undefined
        : `${job.workflowStepIndex + 1}/${job.workflowStepCount}`
    ),
    formatReviewLoopLine(
      job
    ),
  ];

  if (plannerExplanation) {
    lines.push(
      "",
      "Planner Explanation:",
      plannerExplanation
    );
  }

  lines.push(
    "",
    "Instruction:",
    instruction
  );

  if (previousOutput) {
    lines.push(
      "",
      "Previous Step Output:",
      previousOutput
    );
  }

  if (job.rawOutput) {
    lines.push(
      "",
      "Raw Output:",
      job.rawOutput
    );
  }

  if (job.output) {
    lines.push(
      "",
      "Output:",
      job.output
    );
  }

  if (job.error) {
    lines.push(
      "",
      "Error:",
      job.error
    );
  }

  return lines
    .filter(
      (line) =>
        line !== undefined
    )
    .join("\n");
}
