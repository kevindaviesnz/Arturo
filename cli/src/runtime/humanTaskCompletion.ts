/**
 * Completing a Human Task, however it is done.
 *
 * The rules lived inside the terminal command: who may complete it, that it
 * must be theirs, and how the documents they produced are recorded. A person
 * completing their work from a page has to be held to exactly the same rules
 * and leave exactly the same record, so the rules are here and both surfaces
 * call them. Every refusal happens before anything is written.
 */

import { isWorkerAvailableForNewTask, listWorkers } from "../control/workers";
import { formatHumanTaskArtefactContext } from "../repl/humanTaskCommands";
import { getHumanTask, type HumanTask } from "./humanTaskStore";
import { completeHumanTaskWorkflow } from "./humanTaskWorkflowActions";

export type HumanTaskCompletionRequest = {
  readonly id: string;
  readonly notes: string;
  /** The person completing it; may be omitted only when one person could. */
  readonly as?: string;
  /** Exact Artefact versions they produced, as "artefact-7@1,artefact-8@1". */
  readonly artefacts?: string;
};

export type HumanTaskCompletionOutcome =
  | { readonly completed: true; readonly task: HumanTask; readonly completedBy: string }
  | { readonly completed: false; readonly message: string };

/**
 * Who would complete this Human Task, or why they may not. Writes nothing.
 *
 * SIDE EFFECT: Reads Human Task and Worker state.
 */
export function resolveHumanTaskCompleter(
  id: string,
  as: string | undefined
): { readonly task: HumanTask; readonly completedBy: string } | { readonly refused: string } {
  const task = getHumanTask(id);
  if (!task) return { refused: `human task not found: ${id}` };
  if (task.status === "completed") {
    return { refused: `${id} is already done${task.completedBy ? `, completed by ${task.completedBy}` : ""}. Nothing was recorded.` };
  }
  const availableHumans = listWorkers().filter(
    (worker) => worker.kind === "human" && isWorkerAvailableForNewTask(worker)
  );
  const human = as
    ? availableHumans.find(
        (worker) =>
          worker.name.toLowerCase() === as.toLowerCase() ||
          worker.displayName?.toLowerCase() === as.toLowerCase()
      )
    : availableHumans.length === 1
      ? availableHumans[0]
      : undefined;
  if (!human) {
    return {
      refused: as
        ? `Available human worker not found: ${as}`
        : 'Multiple or no available human workers. Use --as "<human-worker>".',
    };
  }
  const completedBy = human.displayName ?? human.name;
  if (task.owner && task.owner.toLowerCase() !== completedBy.toLowerCase()) {
    return { refused: `Human task is assigned to ${task.owner}, not ${completedBy}.` };
  }
  return { task, completedBy };
}

/**
 * Completes a Human Task as a named person, recording the documents they
 * produced. The terminal's /complete-human-task and the work page both call
 * this and nothing else.
 *
 * SIDE EFFECT: May complete the Human Task and continue its Workflow.
 */
export function completeHumanTaskAs(
  request: HumanTaskCompletionRequest
): HumanTaskCompletionOutcome {
  const notes = request.notes.trim();
  if (!notes) return { completed: false, message: "Say what was done, in a few words, before marking it done." };

  const resolved = resolveHumanTaskCompleter(request.id, request.as);
  if ("refused" in resolved) return { completed: false, message: resolved.refused };

  let outputArtefacts: ReturnType<typeof formatHumanTaskArtefactContext> | undefined;
  try {
    outputArtefacts = request.artefacts ? formatHumanTaskArtefactContext(request.artefacts) : undefined;
  } catch (error: unknown) {
    return { completed: false, message: error instanceof Error ? error.message : String(error) };
  }

  const completionNotes = outputArtefacts
    ? [notes, "", "Produced Artefacts:", outputArtefacts.context].join("\n")
    : notes;
  const task = completeHumanTaskWorkflow(
    request.id,
    completionNotes,
    resolved.completedBy,
    outputArtefacts?.refs
  );
  return { completed: true, task, completedBy: resolved.completedBy };
}
