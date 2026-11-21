import type {
  BusinessFunctionId,
} from "../business/businessFunction";

export type EnterpriseStatus =
  | "active"
  | "running"
  | "paused"
  | "failed";

export type Enterprise = {
  readonly id: string;
  readonly name: string;
  readonly mission: string;
  readonly description: string | undefined;
  readonly status: EnterpriseStatus;
  readonly businessFunctionIds: readonly BusinessFunctionId[];
  readonly createdAt: number;
  readonly updatedAt: number;
};

/**
 * Purpose: Creates an enterprise runtime model.
 *
 * Params:
 * - input: Enterprise creation input.
 *
 * Returns:
 * - Enterprise record.
 *
 * PURE: No side effects.
 */
export function createEnterprise(
  input: {
    readonly id: string;
    readonly name: string;
    readonly mission?: string;
    readonly description?: string;
    readonly businessFunctionIds?: readonly BusinessFunctionId[];
    readonly now?: number;
  }
): Enterprise {
  const now =
    input.now ?? Date.now();

  return {
    id: input.id,
    name: input.name,
    mission: input.mission ?? "",
    description: input.description,
    status: "active",
    businessFunctionIds:
      input.businessFunctionIds ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Purpose: Updates an enterprise status.
 *
 * Params:
 * - enterprise: Existing enterprise.
 * - status: New enterprise status.
 * - now: Timestamp for the update.
 *
 * Returns:
 * - Updated enterprise.
 *
 * PURE: No side effects.
 */
export function setEnterpriseStatus(
  enterprise: Enterprise,
  status: EnterpriseStatus,
  now: number = Date.now()
): Enterprise {
  return {
    ...enterprise,
    status,
    updatedAt: now,
  };
}

/**
 * Purpose: Updates an enterprise mission.
 *
 * Params:
 * - enterprise: Existing enterprise.
 * - mission: New enterprise mission.
 * - now: Timestamp for the update.
 *
 * Returns:
 * - Updated enterprise.
 *
 * PURE: No side effects.
 */
export function setEnterpriseMission(
  enterprise: Enterprise,
  mission: string,
  now: number = Date.now()
): Enterprise {
  return {
    ...enterprise,
    mission,
    updatedAt: now,
  };
}

/**
 * Purpose: Updates an enterprise description.
 *
 * Params:
 * - enterprise: Existing enterprise.
 * - description: New enterprise description.
 * - now: Timestamp for the update.
 *
 * Returns:
 * - Updated enterprise.
 *
 * PURE: No side effects.
 */
/**
 * Returns the Enterprise with a corrected name.
 *
 * Renaming exists because guided setup can capture the wrong name — an operator
 * answering "tell me what you'd prefer instead" in a full sentence had that
 * whole sentence stored as their company name, with no way back except deleting
 * everything.
 *
 * PURE: No side effects.
 */
export function setEnterpriseName(
  enterprise: Enterprise,
  name: string,
  now: number = Date.now()
): Enterprise {
  return {
    ...enterprise,
    name,
    updatedAt: now,
  };
}

export function setEnterpriseDescription(
  enterprise: Enterprise,
  description: string,
  now: number = Date.now()
): Enterprise {
  return {
    ...enterprise,
    description,
    updatedAt: now,
  };
}

/**
 * Purpose: Adds a business function id to an enterprise.
 *
 * Params:
 * - enterprise: Existing enterprise.
 * - businessFunctionId: Business function id to add.
 * - now: Timestamp for the update.
 *
 * Returns:
 * - Updated enterprise.
 *
 * PURE: No side effects.
 */
export function addEnterpriseBusinessFunction(
  enterprise: Enterprise,
  businessFunctionId: BusinessFunctionId,
  now: number = Date.now()
): Enterprise {
  if (
    enterprise.businessFunctionIds.includes(
      businessFunctionId
    )
  ) {
    return enterprise;
  }

  return {
    ...enterprise,
    businessFunctionIds: [
      ...enterprise.businessFunctionIds,
      businessFunctionId,
    ],
    updatedAt: now,
  };
}