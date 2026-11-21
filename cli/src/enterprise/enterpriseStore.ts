import type {
  BusinessFunctionId,
} from "../business/businessFunction";

import {
  addEnterpriseBusinessFunction,
  createEnterprise,
  setEnterpriseDescription,
  setEnterpriseName,
  setEnterpriseMission,
  setEnterpriseStatus,
  type Enterprise,
  type EnterpriseStatus,
} from "./enterprise";

import {
  clearPersistedEnterprises,
  loadEnterprises,
  saveEnterprise,
} from "../storage/enterpriseRepository";

const enterprises: Record<string, Enterprise> =
  Object.fromEntries(
    loadEnterprises().map(
      (enterprise) => [
        enterprise.id,
        enterprise,
      ]
    )
  );

let nextEnterpriseId =
  Object.keys(
    enterprises
  ).length + 1;

/**
 * Purpose: Clears all enterprises and resets id generation.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Mutates the in-memory enterprise store.
 */
export function clearEnterprises(): void {
  Object.keys(
    enterprises
  ).forEach(
    (id) => {
      delete enterprises[id];
    }
  );

  nextEnterpriseId = 1;

  clearPersistedEnterprises();
}

/**
 * Purpose: Creates and stores a new enterprise.
 *
 * Params:
 * - input: Enterprise creation input.
 *
 * Returns:
 * - Stored enterprise.
 *
 * SIDE EFFECT:
 * - Mutates the in-memory enterprise store.
 */
export function createAndSaveEnterprise(
  input: {
    readonly name: string;
    readonly mission?: string;
    readonly description?: string;
    readonly businessFunctionIds?: readonly BusinessFunctionId[];
    readonly now?: number;
  }
): Enterprise {
  const enterprise =
    createEnterprise({
      id: `enterprise-${nextEnterpriseId++}`,
      name: input.name,
      mission: input.mission,
      description: input.description,
      businessFunctionIds:
        input.businessFunctionIds,
      now: input.now,
    });

  enterprises[enterprise.id] =
    enterprise;

  saveEnterprise(
    enterprise
  );
  
  return enterprise;
}

/**
 * Purpose: Finds an enterprise by id.
 *
 * Params:
 * - id: Enterprise id.
 *
 * Returns:
 * - Matching enterprise or undefined.
 *
 * SIDE EFFECT:
 * - Reads the in-memory enterprise store.
 */
export function getEnterprise(
  id: string
): Enterprise | undefined {
  return enterprises[id];
}

/**
 * Purpose: Finds an enterprise by name using case-insensitive matching.
 *
 * Params:
 * - name: Enterprise name.
 *
 * Returns:
 * - Matching enterprise or undefined.
 *
 * SIDE EFFECT:
 * - Reads the in-memory enterprise store.
 */
export function getEnterpriseByName(
  name: string
): Enterprise | undefined {
  const normalizedName =
    name.trim().toLowerCase();

  return Object.values(
    enterprises
  ).find(
    (enterprise) =>
      enterprise.name.trim().toLowerCase() ===
      normalizedName
  );
}

/**
 * Purpose: Finds an enterprise by id or name.
 *
 * Params:
 * - idOrName: Enterprise id or enterprise name.
 *
 * Returns:
 * - Matching enterprise or undefined.
 *
 * SIDE EFFECT:
 * - Reads the in-memory enterprise store.
 */
export function getEnterpriseByIdOrName(
  idOrName: string
): Enterprise | undefined {
  return (
    getEnterprise(
      idOrName
    ) ??
    getEnterpriseByName(
      idOrName
    )
  );
}

/**
 * Purpose: Lists all enterprises.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Stored enterprises.
 *
 * SIDE EFFECT:
 * - Reads the in-memory enterprise store.
 */
export function listEnterprises(): readonly Enterprise[] {
  return Object.values(
    enterprises
  );
}

/**
 * Purpose: Updates a stored enterprise status.
 *
 * Params:
 * - idOrName: Enterprise id or name.
 * - status: New enterprise status.
 *
 * Returns:
 * - Updated enterprise or undefined.
 *
 * SIDE EFFECT:
 * - Reads and mutates the in-memory enterprise store.
 */
export function updateEnterpriseStatus(
  idOrName: string,
  status: EnterpriseStatus
): Enterprise | undefined {
  const enterprise =
    getEnterpriseByIdOrName(
      idOrName
    );

  if (!enterprise) {
    return undefined;
  }

  const updated =
    setEnterpriseStatus(
      enterprise,
      status
    );

  enterprises[enterprise.id] =
    updated;

    saveEnterprise(
    updated
  );
  return updated;
}

/**
 * Purpose: Updates a stored enterprise mission.
 *
 * Params:
 * - idOrName: Enterprise id or name.
 * - mission: New enterprise mission.
 *
 * Returns:
 * - Updated enterprise or undefined.
 *
 * SIDE EFFECT:
 * - Reads and mutates the in-memory enterprise store.
 */
export function updateEnterpriseMission(
  idOrName: string,
  mission: string
): Enterprise | undefined {
  const enterprise =
    getEnterpriseByIdOrName(
      idOrName
    );

  if (!enterprise) {
    return undefined;
  }

  const updated =
    setEnterpriseMission(
      enterprise,
      mission
    );

  enterprises[enterprise.id] =
    updated;

    saveEnterprise(
    updated
    );
  
  return updated;
}

/**
 * Purpose: Updates a stored enterprise description.
 *
 * Params:
 * - idOrName: Enterprise id or name.
 * - description: New enterprise description.
 *
 * Returns:
 * - Updated enterprise or undefined.
 *
 * SIDE EFFECT:
 * - Reads and mutates the in-memory enterprise store.
 */
/**
 * Purpose: Renames a stored enterprise.
 *
 * Params:
 * - idOrName: Enterprise id or current name.
 * - name: Corrected name.
 *
 * Returns:
 * - Updated enterprise, or undefined when no Enterprise matches.
 *
 * SIDE EFFECT:
 * - Reads and mutates the in-memory enterprise store and its persistence.
 */
export function updateEnterpriseName(
  idOrName: string,
  name: string
): Enterprise | undefined {
  const enterprise =
    getEnterpriseByIdOrName(
      idOrName
    );

  if (!enterprise) {
    return undefined;
  }

  const updated =
    setEnterpriseName(
      enterprise,
      name
    );

  enterprises[enterprise.id] =
    updated;
  saveEnterprise(
    updated
  );

  return updated;
}

export function updateEnterpriseDescription(
  idOrName: string,
  description: string
): Enterprise | undefined {
  const enterprise =
    getEnterpriseByIdOrName(
      idOrName
    );

  if (!enterprise) {
    return undefined;
  }

  const updated =
    setEnterpriseDescription(
      enterprise,
      description
    );

  enterprises[enterprise.id] =
    updated;
  saveEnterprise(
    updated
  );

  return updated;
}

/**
 * Purpose: Adds a business function to a stored enterprise.
 *
 * Params:
 * - idOrName: Enterprise id or name.
 * - businessFunctionId: Business function id to attach.
 *
 * Returns:
 * - Updated enterprise or undefined.
 *
 * SIDE EFFECT:
 * - Reads and mutates the in-memory enterprise store.
 */
export function attachEnterpriseBusinessFunction(
  idOrName: string,
  businessFunctionId: string
): Enterprise | undefined {
  const enterprise =
    getEnterpriseByIdOrName(
      idOrName
    );

  if (!enterprise) {
    return undefined;
  }

  const updated =
    addEnterpriseBusinessFunction(
      enterprise,
      businessFunctionId as BusinessFunctionId
    );

  enterprises[enterprise.id] =
    updated;

    saveEnterprise(
    updated
    );
  
  return updated;
}