import {
  refineWorker,
} from "../control/workers";

/**
 * Purpose: Formats /refine-worker usage text.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Usage text.
 *
 * PURE: No side effects.
 */
export function formatRefineWorkerUsage(): string {
  return '/refine-worker <worker-name> "<refinement instructions>"';
}

/**
 * Purpose: Handles the /refine-worker command.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Updates and persists worker refinement.
 * - Writes CLI output.
 */
export function handleRefineWorkerCommand(
  args: readonly string[]
): void {
  const [
    name,
    ...refinementParts
  ] = args;

  const refinement =
    refinementParts
      .join(" ")
      .trim();

  if (
    !name ||
    refinement.length === 0
  ) {
    console.log(
      `Usage: ${formatRefineWorkerUsage()}`
    );

    return;
  }

  const worker =
    refineWorker(
      name,
      refinement
    );

  if (!worker) {
    console.log(
      `worker not found: ${name}`
    );

    return;
  }

  console.log(
    `worker refined: ${worker.name}`
  );
}