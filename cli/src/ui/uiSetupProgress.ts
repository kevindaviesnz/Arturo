import {
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";

import {
  listEnterprises,
} from "../enterprise/enterpriseStore";

import {
  listWorkers,
} from "../control/workers";

/**
 * How far an installation has got, and what to do next.
 *
 * Several commands need this same answer and each was inventing its own. The
 * worst was `/ask` on an empty install: it called the model, failed in red with
 * "Planner created a workflow, but some required workers are missing", and
 * prescribed four `/add-ai-worker "<name>" <archetype>` commands. Following
 * them produced Workers named after archetypes, attached to no Function,
 * bypassing Enterprise → Functions → `/staff` entirely — the exact shape the
 * staffing path exists to prevent. None of it could have worked: the
 * installation had no Enterprise.
 */

export type SetupState = {
  readonly enterpriseName?: string;
  readonly functionCount: number;
  readonly workerCount: number;
};

/**
 * Reads how far the installation has been set up.
 *
 * SIDE EFFECT: Reads the Enterprise, Function, and Worker stores.
 */
export function readSetupState(): SetupState {
  const [
    enterprise,
  ] = listEnterprises();

  return {
    enterpriseName: enterprise?.name,
    functionCount: enterprise
      ? listBusinessFunctionDefinitionsByEnterprise(
          enterprise.id
        ).length
      : 0,
    workerCount: listWorkers().filter(
      (worker) => !worker.system
    ).length,
  };
}

/**
 * The commands that advance an installation from where it is.
 *
 * Returns no lines when the Enterprise is set up and staffed, which callers
 * read as "there is nothing missing; go ahead".
 *
 * PURE: No side effects.
 */
export function describeNextSetupStep(
  state: SetupState
): readonly string[] {
  if (!state.enterpriseName) {
    return [
      '  /enterprise    Arturo asks about your business and sets it up',
    ];
  }

  if (state.functionCount === 0) {
    return [
      `  /next "${state.enterpriseName}"    Arturo recommends the Functions to create`,
    ];
  }

  return state.workerCount === 0
    ? ["  /staff    Arturo proposes the Workers to cover those Functions"]
    : [];
}

/** Whether the installation can be asked to do work at all. */
export function isReadyForWork(
  state: SetupState
): boolean {
  return describeNextSetupStep(state).length === 0;
}

/**
 * Explains what has to exist before Arturo can act on a request.
 *
 * PURE: No side effects.
 */
export function formatSetupRequiredBody(
  state: SetupState
): string {
  const reason = !state.enterpriseName
    ? "There is no Enterprise yet, so there is nothing for Arturo to do this on behalf of."
    : state.functionCount === 0
      ? `${state.enterpriseName} has no Functions yet, so there is no ongoing responsibility to attach work to.`
      : `${state.enterpriseName} has no Workers yet, so there is nobody to carry the work out.`;

  return [
    reason,
    "",
    ...describeNextSetupStep(state),
    "",
    "Nothing was created, and no model was called.",
  ].join("\n");
}
