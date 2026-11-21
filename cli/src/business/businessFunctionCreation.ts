/**
 * Creating a Business Function (an "area of work" on the page) in a company.
 *
 * This is the step behind /function create. The terminal and the company
 * page both call createEnterpriseFunction, so a Function made from the page
 * has the same id, the same duplicate rule and the same company attachment
 * as one made at the terminal.
 *
 * The duplicate rule covers the same name in other words too ("Reviewing
 * leases" when there is "Lease reviews", functionNames.ts): Arturo now offers
 * a new Function whenever a task fits none, and two for the same work would
 * each carry their own instructions.
 */

import type { Enterprise } from "../enterprise/enterprise";
import { attachEnterpriseBusinessFunction } from "../enterprise/enterpriseStore";
import { createEnterpriseBusinessFunctionId } from "../repl/businessFunctionCommands";
import type { BusinessFunctionDefinition } from "./businessFunctionDefinition";
import { sameFunctionWords } from "./functionNames";
import {
  createAndSaveBusinessFunctionDefinition,
  listBusinessFunctionDefinitions,
} from "./businessFunctionDefinitionStore";

export type FunctionCreateOutcome =
  | { readonly created: true; readonly definition: BusinessFunctionDefinition }
  | { readonly created: false; readonly duplicate?: BusinessFunctionDefinition; readonly message: string };

/**
 * The Function of this company that already has this name, if any. Commands
 * refer to a Function by name, so a second one with the same name could never
 * be addressed.
 *
 * SIDE EFFECT: Reads the Function store.
 */
export function findFunctionNamed(enterpriseId: string, label: string): BusinessFunctionDefinition | undefined {
  return listBusinessFunctionDefinitions().find(
    (definition) =>
      definition.enterpriseId === enterpriseId &&
      definition.label.trim().toLowerCase() === label.trim().toLowerCase()
  );
}

/**
 * The Function of this company with this name or the same name in other
 * words ("Lease reviews" for "Reviewing leases"), if any.
 *
 * SIDE EFFECT: Reads the Function store.
 */
export function findDuplicateFunction(enterpriseId: string, label: string): BusinessFunctionDefinition | undefined {
  return findFunctionNamed(enterpriseId, label) ?? listBusinessFunctionDefinitions().find(
    (definition) => definition.enterpriseId === enterpriseId && sameFunctionWords(definition.label, label)
  );
}

/** Why a duplicate was refused, in a sentence. PURE: No side effects. */
export function describeDuplicateFunction(companyName: string, duplicate: BusinessFunctionDefinition, label: string): string {
  return duplicate.label.trim().toLowerCase() === label.trim().toLowerCase()
    ? `${companyName} already has a Function named "${duplicate.label}" (${duplicate.id}).`
    : `${companyName} already has a Function named "${duplicate.label}" (${duplicate.id}), which is the same name in other words.`;
}

/**
 * Creates a Function in a company, refusing a name the company already uses,
 * in these or other words.
 *
 * SIDE EFFECT: Writes a Function definition and attaches it to the company.
 */
export function createEnterpriseFunction(input: {
  readonly enterprise: Pick<Enterprise, "id" | "name">;
  readonly label: string;
  readonly objective: string;
  readonly description?: string;
}): FunctionCreateOutcome {
  const duplicate = findDuplicateFunction(input.enterprise.id, input.label);
  if (duplicate) {
    return { created: false, duplicate, message: describeDuplicateFunction(input.enterprise.name, duplicate, input.label) };
  }
  const definition = createAndSaveBusinessFunctionDefinition({
    id: createEnterpriseBusinessFunctionId(
      input.enterprise.name,
      input.label,
      listBusinessFunctionDefinitions().map((existing) => existing.id)
    ),
    enterpriseId: input.enterprise.id,
    label: input.label,
    objective: input.objective,
    description: input.description || undefined,
  });
  attachEnterpriseBusinessFunction(input.enterprise.id, definition.id);
  return { created: true, definition };
}
