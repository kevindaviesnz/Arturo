export type DisplayedJobTaskParts = {
  readonly task: string;
  readonly previousStepOutput: string | undefined;
};

const PREVIOUS_STEP_OUTPUT_MARKER =
  "Previous step output:";

const RUN_CONTEXT_MARKER =
  "Run context:";

/**
 * Purpose: Removes duplicated task labels from job task display text.
 *
 * Params:
 * - task: Raw job task text.
 *
 * Returns:
 * - Task text without a leading "Task:" label.
 *
 * PURE: No side effects.
 */
export function normalizeDisplayedJobTask(
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
 * Purpose: Removes runtime context from the user-facing task summary.
 *
 * Params:
 * - task: Task text that may contain runtime context.
 *
 * Returns:
 * - Task instruction without runtime context.
 *
 * PURE: No side effects.
 */
export function removeRunContextFromTask(
  task: string
): string {
  const index =
    task.indexOf(
      RUN_CONTEXT_MARKER
    );

  return index === -1
    ? task.trim()
    : task
        .slice(
          0,
          index
        )
        .trim();
}

/**
 * Purpose: Splits a workflow job task into current task text and previous-step output.
 *
 * Params:
 * - task: Raw job task text.
 *
 * Returns:
 * - Current task text and optional previous-step output.
 *
 * PURE: No side effects.
 */
export function splitDisplayedJobTask(
  task: string
): DisplayedJobTaskParts {
  const normalizedTask =
    normalizeDisplayedJobTask(
      task
    );

  const markerIndex =
    normalizedTask.indexOf(
      PREVIOUS_STEP_OUTPUT_MARKER
    );

  const taskText =
    markerIndex === -1
      ? normalizedTask
      : normalizedTask
          .slice(
            0,
            markerIndex
          )
          .trim();

  const previousStepOutput =
    markerIndex === -1
      ? undefined
      : normalizedTask
          .slice(
            markerIndex + PREVIOUS_STEP_OUTPUT_MARKER.length
          )
          .trim();

  return {
    task:
      removeRunContextFromTask(
        taskText
      ),
    previousStepOutput,
  };
}

/**
 * Purpose: Wraps text in Blessed gray tags.
 *
 * Params:
 * - text: Text to colour.
 *
 * Returns:
 * - Gray Blessed-tagged text.
 *
 * PURE: No side effects.
 */
export function formatGrayText(
  text: string
): string {
  return `{gray-fg}${text}{/gray-fg}`;
}

/**
 * Purpose: Formats previous workflow step output for detailed terminal display.
 *
 * Params:
 * - previousStepOutput: Previous step output text.
 *
 * Returns:
 * - Gray formatted previous-step output text.
 *
 * PURE: No side effects.
 */
export function formatPreviousStepOutputSection(
  previousStepOutput: string | undefined
): string | undefined {
  if (
    !previousStepOutput ||
    previousStepOutput.trim().length === 0
  ) {
    return undefined;
  }

  return formatGrayText(
    previousStepOutput
  );
}

/**
 * Purpose: Adds terminal colour tags around previous workflow step output.
 *
 * Params:
 * - text: Job task or output text.
 *
 * Returns:
 * - Text with previous-step output wrapped in Blessed gray tags when present.
 *
 * PURE: No side effects.
 */
export function colourPreviousStepOutput(
  text: string
): string {
  const parts =
    splitDisplayedJobTask(
      text
    );

  const previousSection =
    formatPreviousStepOutputSection(
      parts.previousStepOutput
    );

  return previousSection
    ? [
        parts.task,
        "",
        "{gray-fg}Previous step output:",
        `${parts.previousStepOutput}{/gray-fg}`,
      ].join("\n")
    : parts.task;
}

/**
 * Purpose: Formats a job task for detailed terminal display.
 *
 * Params:
 * - task: Raw job task text.
 *
 * Returns:
 * - Current task text only, without previous-step output or runtime context.
 *
 * PURE: No side effects.
 */
export function formatDisplayedJobTask(
  task: string
): string {
  return splitDisplayedJobTask(
    task
  ).task;
}

/**
 * Purpose: Formats a job task for short list previews.
 *
 * Params:
 * - task: Raw job task text.
 *
 * Returns:
 * - Normalized current task preview text without colour tags.
 *
 * PURE: No side effects.
 */
export function formatJobTaskPreviewText(
  task: string
): string {
  return formatDisplayedJobTask(
    task
  );
}