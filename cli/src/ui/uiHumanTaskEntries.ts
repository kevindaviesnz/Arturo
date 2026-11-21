import {
  listHumanTasks,
} from "../runtime/humanTaskStore";

import {
  WorkStreamEntry,
} from "./uiState";

type UiHumanTask =
  ReturnType<typeof listHumanTasks>[number];

/**
 * Purpose: Formats optional human task text for terminal display.
 *
 * Params:
 * - value: Optional text value.
 * - fallback: Text to use when value is missing.
 *
 * Returns:
 * - Display-safe text.
 *
 * PURE: No side effects.
 */
export function formatOptionalTaskText(
  value: string | undefined,
  fallback: string
): string {
  return value && value.trim().length > 0
    ? value
    : fallback;
}

/**
 * Purpose: Converts a human task into a UI work stream entry.
 *
 * Params:
 * - task: Human task record.
 *
 * Returns:
 * - Work stream entry representing the human task.
 *
 * PURE: No side effects.
 */
export function createHumanTaskWorkStreamEntry(
  task: UiHumanTask
): WorkStreamEntry {
  return {
    actor: task.owner ?? "Human task",
    label: `${task.id} · ${task.status}`,
    // Only rows that carry something. Purpose is no longer asked for in the
    // guided flow, and a Human Task the operator wrote has no source Task and
    // nobody who completed it — so all three read "none" on an open task, three
    // lines of nothing under the two that matter.
    body: [
      // The guided flow names a Human Task from what it asks for, so on most
      // records the title is the instructions truncated. Printing both then
      // says the same thing twice, the second time cut short.
      ...(task.instructions.startsWith(task.title.replace(/\.\.\.$/, ""))
        ? []
        : [`title: ${task.title}`]),
      ...(task.purpose?.trim()
        ? [`purpose: ${task.purpose.trim()}`]
        : []),
      `instructions: ${task.instructions}`,
      ...(task.sourceJobId
        ? [`source Task: ${task.sourceJobId}`]
        : []),
      ...(task.handoverJobId
        ? [`work to act on: ${task.handoverJobId}`]
        : []),
      ...(task.completedBy
        ? [`completed by: ${task.completedBy}`]
        : []),
    ].join("\n"),
  };
}

/**
 * Purpose: Converts human tasks into UI work stream entries.
 *
 * Params:
 * - tasks: Human task records.
 *
 * Returns:
 * - Work stream entries for human tasks, or an empty-state message.
 *
 * PURE: No side effects.
 */
export function createHumanTaskEntries(
  tasks: readonly UiHumanTask[]
): readonly WorkStreamEntry[] {
  if (tasks.length === 0) {
    return [
      {
        actor: "Arturo",
        label: "Human tasks",
        body: "No human tasks found.",
      },
    ];
  }

  return tasks
    .slice()
    .reverse()
    .map(
      createHumanTaskWorkStreamEntry
    );
}

/**
 * Purpose: Reads current human tasks for the terminal UI.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entries for current human tasks.
 *
 * SIDE EFFECT:
 * - Reads human task store.
 */
export function readHumanTaskEntries(): readonly WorkStreamEntry[] {
  return createHumanTaskEntries(
    listHumanTasks()
  );
}
