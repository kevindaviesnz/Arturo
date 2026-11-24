/**
 * Where a business is in the four-step /setup route. Resume is worked out
 * from what is already stored: an empty mission goes to step 1, no Functions
 * to step 2, staff not done to step 3. Nothing already saved is asked again.
 *
 * SIDE EFFECT: Reads Enterprises, Functions, staffing and sign-off rights.
 */

import { refuseStaffNotReady } from "../business/staffCheck";
import { listBusinessFunctionDefinitionsByEnterprise } from "../business/businessFunctionDefinitionStore";
import type { Enterprise } from "../enterprise/enterprise";
import { getEnterprise, listEnterprises } from "../enterprise/enterpriseStore";

export type SetupStep = 1 | 2 | 3 | 4;

const tidy = (text: string | undefined) => (text ?? "").replace(/\s+/g, " ").trim();

/** Whether this Enterprise still needs its mission. PURE: No side effects. */
export function missionIsMissing(enterprise: Pick<Enterprise, "mission">): boolean {
  return tidy(enterprise.mission).length === 0;
}

/**
 * The first incomplete setup step for this business, or undefined when staff
 * are already in place (step 4, the first Task, is started with /task).
 *
 * SIDE EFFECT: Reads Functions, staffing and sign-off rights.
 */
export function firstMissingSetupStep(enterpriseId: string): SetupStep | undefined {
  const enterprise = getEnterprise(enterpriseId);
  if (!enterprise || missionIsMissing(enterprise)) return 1;
  if (listBusinessFunctionDefinitionsByEnterprise(enterpriseId).length === 0) return 2;
  if (refuseStaffNotReady(enterpriseId)) return 3;
  return undefined;
}

/**
 * The first stored business that still has a missing setup step, if any.
 * SIDE EFFECT: Reads Enterprises, Functions, staffing and sign-off rights.
 */
export function firstIncompleteEnterprise(): { readonly enterprise: Enterprise; readonly step: SetupStep } | undefined {
  for (const enterprise of listEnterprises()) {
    const step = firstMissingSetupStep(enterprise.id);
    if (step !== undefined) return { enterprise, step };
  }
  return undefined;
}
