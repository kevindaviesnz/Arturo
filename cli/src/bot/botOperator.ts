import {
  addWorker,
  createHumanWorker,
  getWorker,
  listWorkers,
} from "../control/workers";

import {
  listBusinessFunctionDefinitions,
} from "../business/businessFunctionDefinitionStore";

import {
  listStaffingAssignments,
  saveStaffingAssignment,
} from "../staffing/staffingStore";

import {
  parseUiInputTokens,
} from "../ui/uiState";

/**
 * The identity every bot-signed decision is recorded under.
 *
 * The name is deliberately unmistakable. Arturo's approval chain exists to
 * prove that an accountable *person* authorised consequential work; a bot
 * satisfying that gate makes the chain prove something weaker. That is an
 * acceptable trade for a demonstration, but only while the record never implies
 * a human signed — so the name says what it is, everywhere it appears.
 */
export const BOT_OPERATOR_NAME = "Arturo Bot (automated, not a person)";

export const BOT_OPERATOR_DISCLOSURE =
  "Automated operator created by `npm run ui bot`. Approvals recorded under " +
  "this name were made by a script or a model, not by a person, and prove " +
  "nothing about human review.";

/**
 * Whether a recorded decision was signed by the bot.
 *
 * PURE: No side effects.
 */
export function isBotOperatorName(
  name: string | undefined
): boolean {
  return name?.trim() === BOT_OPERATOR_NAME;
}

/**
 * Registers the bot operator, and designates it on every Function when asked.
 *
 * `/staff` records designated approvers per Function, and
 * `refuseUndesignatedApprover` correctly blocks anyone else — so without the
 * staffing assignment the bot is registered but cannot actually approve.
 *
 * SIDE EFFECT: Writes the Worker registry and the staffing store.
 */
export function ensureBotOperatorRegistered(input: {
  readonly staffAllFunctions: boolean;
}): { readonly created: boolean; readonly functionsStaffed: number } {
  const existing = getWorker(BOT_OPERATOR_NAME);
  if (!existing) {
    addWorker(
      createHumanWorker(
        BOT_OPERATOR_NAME,
        "guardian",
        undefined,
        "available",
        BOT_OPERATOR_DISCLOSURE
      )
    );
  }

  let functionsStaffed = 0;
  if (input.staffAllFunctions) {
    for (const definition of listBusinessFunctionDefinitions()) {
      const already = listStaffingAssignments(definition.id).some(
        (assignment) =>
          assignment.role === "human-approver" &&
          isBotOperatorName(assignment.workerName)
      );
      if (already) continue;
      saveStaffingAssignment({
        businessFunctionId: definition.id,
        workerName: BOT_OPERATOR_NAME,
        role: "human-approver",
        rationale: BOT_OPERATOR_DISCLOSURE,
      });
      functionsStaffed += 1;
    }
  }

  return { created: !existing, functionsStaffed };
}

/** Whether the bot is registered and could sign. PURE apart from a registry read. */
export function isBotOperatorRegistered(): boolean {
  return listWorkers().some((worker) => isBotOperatorName(worker.name));
}

/**
 * Whether a line asks Arturo to sign a finished result off, or set it aside,
 * in a person's name.
 *
 * PURE: No side effects.
 */
export function isResultSignOffLine(line: string): boolean {
  const tokens = parseUiInputTokens(line.trim());
  return (
    tokens[0]?.toLowerCase() === "/task" &&
    (tokens[1]?.toLowerCase() === "signoff" || tokens[1]?.toLowerCase() === "setaside")
  );
}

/**
 * Names the bot on an approve or reject line that does not already say who.
 *
 * This is the load-bearing part of the whole arrangement.
 * `resolveApprovalCommandIdentity` auto-selects the *sole* eligible human when
 * `--as` is absent, so on an installation whose only approver is a real person,
 * a bare `/approve task-1` from the bot would be recorded — inside the signed
 * decision — under that person's name. A script would have signed as a human
 * and nothing in the record would say otherwise.
 *
 * Applied to every line the bot submits, from a plan or from a model, so the
 * attribution cannot be forgotten in one path and remembered in another. The
 * operator watches it being typed.
 *
 * PURE: No side effects.
 */
export function attributeBotApproval(
  line: string
): string {
  const trimmed = line.trim();
  const tokens = parseUiInputTokens(trimmed);
  const command = tokens[0]?.toLowerCase();
  if (isResultSignOffLine(trimmed)) {
    // Signing a result off names a person exactly as approving does, and the
    // same auto-selection of a sole eligible human would sign it as them.
    return tokens.includes("--as")
      ? line
      : `${trimmed} --as "${BOT_OPERATOR_NAME}"`;
  }
  if (command !== "/approve" && command !== "/reject") {
    return line;
  }
  if (tokens.includes("--as")) {
    return line;
  }
  // A bare /approve names no Task: it opens the guided menu, which resolves the
  // approver itself. Attributing it turns a menu opener into a malformed
  // decision — the command printed its usage, and the bot was registered as a
  // Worker for a decision it never made.
  const namesATarget = tokens
    .slice(1)
    .some((token) => !token.startsWith("--"));
  if (!namesATarget) {
    return line;
  }
  return `${trimmed} --as "${BOT_OPERATOR_NAME}"`;
}
