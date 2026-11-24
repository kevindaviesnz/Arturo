/**
 * The per-business staff check inside createTask (setup-and-staff final v3).
 * One refuse-before-write check, before anything is written and before any
 * model is called. Businesses made with the old /setup are not exempt.
 *
 * A locked or people-only Function is staffed with a person who can sign off
 * and no AI worker. Every other Function, including an unmarked one, needs an
 * AI worker plus someone who can sign off. Marks grant no abilities.
 *
 * SIDE EFFECT: Reads Functions, staffing, marks and sign-off rights.
 */

import { listStaffingAssignments } from "../staffing/staffingStore";
import { listPeople } from "../identity/companySignIn";
import {
  effectiveFunctionMark,
  isBlockingFunctionMark,
} from "./functionMark";
import { listBusinessFunctionDefinitionsByEnterprise } from "./businessFunctionDefinitionStore";
import { refuseWorkUnderLocks } from "../work/workLocks";

const NOTHING = "Nothing was created and no AI was asked.";

/** Whether anyone at this business may sign off work now. SIDE EFFECT: Reads people and grants. */
export function businessHasSigner(enterpriseId: string): boolean {
  return listPeople(enterpriseId).some((person) => person.canSignOff && person.status !== "suspended");
}

/**
 * Why staff are not yet in place at this business, or undefined. Names the
 * missing step. SIDE EFFECT: Reads Functions, staffing, marks and sign-off rights.
 */
export function refuseStaffNotReady(enterpriseId: string | undefined): string | undefined {
  if (!enterpriseId) return undefined;
  const functions = listBusinessFunctionDefinitionsByEnterprise(enterpriseId);
  if (functions.length === 0) return undefined;
  const hasSigner = businessHasSigner(enterpriseId);
  const missing: string[] = [];
  for (const definition of functions) {
    const mark = effectiveFunctionMark(definition.id);
    const assignments = listStaffingAssignments(definition.id);
    const hasAi = assignments.some((row) => row.role === "ai");
    if (isBlockingFunctionMark(mark)) {
      if (hasAi && !hasSigner) {
        missing.push(`${definition.label} is ${mark === "locked" ? "locked" : "people only"}, so it needs someone who can sign off and no AI worker.`);
      } else if (hasAi) {
        missing.push(`${definition.label} is ${mark === "locked" ? "locked" : "people only"}, so it cannot have an AI worker.`);
      } else if (!hasSigner) {
        missing.push(`${definition.label} is ${mark === "locked" ? "locked" : "people only"}, so it needs someone who can sign off.`);
      }
    } else if (!hasAi && !hasSigner) {
      missing.push(`${definition.label} needs an AI worker and someone who can sign off.`);
    } else if (!hasAi) {
      missing.push(`${definition.label} needs an AI worker.`);
    } else if (!hasSigner) {
      missing.push(`${definition.label} needs someone who can sign off.`);
    }
  }
  if (missing.length === 0) return undefined;
  return `${missing.join(" ")} ${NOTHING}`;
}

/**
 * Staff and lock gates every named start path must run before any write.
 * SIDE EFFECT: Reads Functions, staffing, marks, sign-off rights and work locks.
 */
export function refuseStartIfNotReady(input: {
  readonly enterpriseId?: string;
  readonly functionId?: string;
}): string | undefined {
  const staff = refuseStaffNotReady(input.enterpriseId);
  if (staff) return staff;
  return refuseWorkUnderLocks({
    enterpriseId: input.enterpriseId,
    functionId: input.functionId,
    when: "create",
  });
}
