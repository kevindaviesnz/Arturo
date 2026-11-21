import {
  listBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";

import {
  WorkStreamEntry,
} from "./uiState";

/**
 * Purpose: Converts a runtime business function into a UI entry.
 *
 * Params:
 * - businessFunction: Runtime business function.
 *
 * Returns:
 * - Work stream entry for the business function.
 *
 * PURE: No side effects.
 */
export function createBusinessFunctionEntry(
  businessFunction: ReturnType<typeof listBusinessFunctions>[number]
): WorkStreamEntry {
  return {
    actor: businessFunction.label,
    label: businessFunction.state,
    body: [
      `id: ${businessFunction.id}`,
      `owner: ${businessFunction.ownerWorker}`,
      `tasks: ${businessFunction.jobIds.length}`,
      `refinements: ${businessFunction.refinements.length}`,
    ].join("\n"),
  };
}

/**
 * Purpose: Converts runtime business functions into UI entries.
 *
 * Params:
 * - businessFunctions: Runtime business functions.
 *
 * Returns:
 * - Work stream entries.
 *
 * PURE: No side effects.
 */
export function createBusinessFunctionEntries(
  businessFunctions: ReturnType<typeof listBusinessFunctions>
): readonly WorkStreamEntry[] {
  if (businessFunctions.length === 0) {
    return [
      {
        actor: "Arturo",
        label: "Running Functions",
        body: "No running Functions found.",
      },
    ];
  }

  return businessFunctions.map(
    createBusinessFunctionEntry
  );
}

/**
 * Purpose: Reads runtime business functions for the UI.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Work stream entries.
 *
 * SIDE EFFECT:
 * - Reads runtime business function store.
 */
export function readBusinessFunctionEntries(): readonly WorkStreamEntry[] {
  return createBusinessFunctionEntries(
    listBusinessFunctions()
  );
}
