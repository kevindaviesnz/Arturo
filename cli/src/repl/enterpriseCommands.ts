import type {
  Enterprise,
} from "../enterprise/enterprise";

import {
  createAndSaveEnterprise,
  getEnterpriseByIdOrName,
  listEnterprises,
  updateEnterpriseDescription,
} from "../enterprise/enterpriseStore";

import {
  getBusinessFunctionDefinition,
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";

import {
  listStaffingAssignments,
} from "../staffing/staffingStore";

import {
  getWorker,
} from "../control/workers";

import {
  loadPolicyRules,
} from "../storage/policyRepository";

import type {
  BusinessFunctionDefinition,
} from "../business/businessFunctionDefinition";

/**
 * Purpose: Formats a timestamp for terminal output.
 *
 * Params:
 * - timestamp: Unix timestamp in milliseconds.
 *
 * Returns:
 * - ISO timestamp.
 *
 * PURE: No side effects.
 */
function formatTimestamp(
  timestamp: number
): string {
  return new Date(
    timestamp
  ).toISOString();
}

/**
 * Purpose: Formats an optional description for terminal output.
 *
 * Params:
 * - description: Optional enterprise description.
 *
 * Returns:
 * - Description or "(none)".
 *
 * PURE: No side effects.
 */
function formatDescription(
  description: string | undefined
): string {
  return description && description.trim().length > 0
    ? description
    : "(none)";
}

/** Formats the first guided action after Enterprise creation. */
export function formatEnterpriseCreatedNextAction(
  enterprise:
    Pick<
      Enterprise,
      "name"
    >
): string {
  // Both routes, on one line. /next writes the Functions for you; /function
  // adds one at a time. Offering only the first read as the only way in.
  return `Run /next "${enterprise.name}" to create this Enterprise's ongoing Functions, or /function to add one yourself.`;
}

/**
 * Purpose: Finds a flag value in command args.
 *
 * Params:
 * - args: Command arguments.
 * - flag: Flag name.
 *
 * Returns:
 * - Flag value or undefined.
 *
 * PURE: No side effects.
 */
function getFlagValue(
  args: readonly string[],
  flag: string
): string | undefined {
  const equalsPrefix =
    `${flag}=`;

  const equalsValue =
    args.find(
      (arg) =>
        arg.startsWith(
          equalsPrefix
        )
    );

  if (equalsValue) {
    return equalsValue.slice(
      equalsPrefix.length
    );
  }

  const flagIndex =
    args.indexOf(
      flag
    );

  if (flagIndex === -1) {
    return undefined;
  }

  return args[flagIndex + 1];
}

/**
 * Purpose: Removes a flag and its value from command args.
 *
 * Params:
 * - args: Command arguments.
 * - flag: Flag name.
 *
 * Returns:
 * - Args without the flag pair.
 *
 * PURE: No side effects.
 */
function removeFlagPair(
  args: readonly string[],
  flag: string
): readonly string[] {
  const equalsPrefix =
    `${flag}=`;

  const flagIndex =
    args.findIndex(
      (arg) =>
        arg === flag ||
        arg.startsWith(
          equalsPrefix
        )
    );

  if (flagIndex === -1) {
    return args;
  }

  const isEqualsForm =
    args[flagIndex].startsWith(
      equalsPrefix
    );

  return args.filter(
    (_arg, index) =>
      isEqualsForm
        ? index !== flagIndex
        : index !== flagIndex &&
          index !== flagIndex + 1
  );
}

/**
 * Purpose: Creates usage text for enterprise creation.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Usage text.
 *
 * PURE: No side effects.
 */
function createEnterpriseCreateUsage(): string {
  return 'Usage: /enterprise "<name>" --description "<description>" or /enterprise create "<name>" [--mission "<mission>"] [--description "<description>"]';
}

/**
 * Purpose: Creates usage text for enterprise update.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Usage text.
 *
 * PURE: No side effects.
 */
function createEnterpriseUpdateUsage(): string {
  return 'Usage: /enterprise update "<name-or-id>" --description "<description>"';
}

/**
 * Purpose: Creates usage text for enterprise inspection.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Usage text.
 *
 * PURE: No side effects.
 */
function createEnterpriseInspectUsage(): string {
  return 'Usage: /enterprise inspect "<name-or-id>"';
}

/**
 * Purpose: Creates usage text for enterprise command.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Usage text.
 *
 * PURE: No side effects.
 */
function createEnterpriseUsage(): string {
  return [
    "Usage:",
    '  /enterprise "<name>" --description "<description>" [--mission "<mission>"]',
    '  /enterprise create "<name>" [--mission "<mission>"] [--description "<description>"]',
    '  /enterprise inspect "<name-or-id>"',
    '  /enterprise update "<name-or-id>" --description "<description>"',
    "  /enterprise list",
  ].join("\n");
}

/**
 * Purpose: Formats enterprise creation output.
 *
 * Params:
 * - enterprise: Created enterprise.
 *
 * Returns:
 * - Human-readable creation output.
 *
 * PURE: No side effects.
 */
function formatEnterpriseCreated(
  enterprise: Enterprise
): string {
  return [
    "Enterprise created.",
    "",
    `  ID:                  ${enterprise.id}`,
    `  Name:                ${enterprise.name}`,
    `  Description:         ${formatDescription(enterprise.description)}`,
    `  Status:              ${enterprise.status}`,
    `  Created:             ${formatTimestamp(enterprise.createdAt)}`,
    `  Functions:                ${enterprise.businessFunctionIds.length}`,
    "  Workers:             0",
    "  Policies:            0",
    "",
    formatEnterpriseCreatedNextAction(
      enterprise
    ),
  ].join("\n");
}

/**
 * Purpose: Formats enterprise update output.
 *
 * Params:
 * - enterprise: Updated enterprise.
 *
 * Returns:
 * - Human-readable update output.
 *
 * PURE: No side effects.
 */
function formatEnterpriseUpdated(
  enterprise: Enterprise
): string {
  return [
    "Enterprise updated.",
    "",
    `  ID:          ${enterprise.id}`,
    `  Name:        ${enterprise.name}`,
    `  Description: ${formatDescription(enterprise.description)}`,
    `  Status:      ${enterprise.status}`,
    `  Updated:     ${formatTimestamp(enterprise.updatedAt)}`,
  ].join("\n");
}

/**
 * Purpose: Formats an enterprise list for terminal output.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Human-readable enterprise list.
 *
 * SIDE EFFECT:
 * - Reads the in-memory enterprise store.
 */
export function formatEnterpriseList(): string {
  const enterprises =
    listEnterprises();

  if (enterprises.length === 0) {
    return "No enterprises.";
  }

  return [
    "  ID             Name                  Status    Functions",
    ...enterprises.map(
      (enterprise) =>
        [
          `  ${enterprise.id.padEnd(14)}`,
          enterprise.name.padEnd(21),
          enterprise.status.padEnd(9),
          String(enterprise.businessFunctionIds.length),
        ].join(" ")
    ),
  ].join("\n");
}

/**
 * Purpose: Formats an attached business function line for enterprise inspection.
 *
 * Params:
 * - definition: Business function definition.
 *
 * Returns:
 * - Chapter 4 enterprise business function line.
 *
 * PURE: No side effects.
 */
function formatEnterpriseBusinessFunctionLine(
  definition: BusinessFunctionDefinition
): string {
  return `    - ${definition.label} (${definition.id}) — ${definition.status}`;
}

/**
 * Purpose: Formats a missing business function reference for enterprise inspection.
 *
 * Params:
 * - id: Missing business function id.
 *
 * Returns:
 * - Human-readable missing reference line.
 *
 * PURE: No side effects.
 */
function formatMissingBusinessFunctionLine(
  id: string
): string {
  return `    - missing Function (${id})`;
}

/**
 * Purpose: Formats business functions owned by an enterprise.
 *
 * Params:
 * - enterprise: Enterprise to inspect.
 *
 * Returns:
 * - Business function display lines.
 *
 * SIDE EFFECT:
 * - Reads business function definition store.
 */
function formatEnterpriseBusinessFunctionLines(
  enterprise: Enterprise
): readonly string[] {
  if (enterprise.businessFunctionIds.length === 0) {
    return [
      "    (none)",
    ];
  }

  return enterprise.businessFunctionIds.map(
    (id) => {
      const definition =
        getBusinessFunctionDefinition(
          id
        );

      return definition
        ? formatEnterpriseBusinessFunctionLine(
            definition
          )
        : formatMissingBusinessFunctionLine(
            id
          );
    }
  );
}

/**
 * Purpose: Handles enterprise creation.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Mutates the in-memory enterprise store.
 * - Writes terminal output.
 */
function handleEnterpriseCreateCommand(
  args: readonly string[]
): void {
  const mission =
    getFlagValue(
      args,
      "--mission"
    )?.trim() ?? "";

  const description =
    getFlagValue(
      args,
      "--description"
    )?.trim();

  const positionalArgs =
    removeFlagPair(
      removeFlagPair(
        args,
        "--mission"
      ),
      "--description"
    );

  const [
    name,
  ] = positionalArgs;

  if (!name) {
    console.log(
      createEnterpriseCreateUsage()
    );

    return;
  }

  const enterprise =
    createAndSaveEnterprise({
      name,
      mission,
      description,
    });

  console.log(
    formatEnterpriseCreated(
      enterprise
    )
  );
}

/**
 * Purpose: Formats a single enterprise with attached business functions.
 *
 * Params:
 * - idOrName: Enterprise id or enterprise name.
 *
 * Returns:
 * - Human-readable enterprise detail.
 *
 * SIDE EFFECT:
 * - Reads enterprise and business function definition stores.
 */
export function formatEnterpriseDetail(
  idOrName: string
): string {
  const enterprise =
    getEnterpriseByIdOrName(
      idOrName
    );

  if (!enterprise) {
    return `enterprise not found: ${idOrName}`;
  }

  return [
    `Enterprise: ${enterprise.name}`,
    `  ID:          ${enterprise.id}`,
    `  Status:      ${enterprise.status}`,
    // Mission and description were stored but never displayed by create or
    // inspect, so an operator had no way to check the field every downstream
    // recommendation is built from.
    `  Mission:     ${enterprise.mission?.trim() || "(none)"}`,
    `  Description: ${enterprise.description?.trim() || "(none)"}`,
    `  Functions (${enterprise.businessFunctionIds.length}):`,
    ...formatEnterpriseBusinessFunctionLines(
      enterprise
    ),
    "",
    ...formatEnterpriseWorkerLines(
      enterprise
    ),
    "",
    ...formatEnterprisePolicyLines(
      enterprise
    ),
  ].join("\n");
}

/**
 * Purpose: Lists the Workers staffed to this Enterprise's Functions.
 *
 * These two sections were hardcoded to "(0)" and "(none)". A walkthrough
 * applied a staffing plan, watched the status bar report two Workers, and was
 * still told the Enterprise had none — and the same blank Policies section hid
 * the governance rule that staffing had just written. The only view an operator
 * has of their own staff and governance reported that neither existed.
 *
 * SIDE EFFECT: Reads the staffing, worker, and business function stores.
 */
export function formatEnterpriseWorkerLines(
  enterprise: Enterprise
): readonly string[] {
  const staffed = new Map<string, string[]>();

  for (const definition of listBusinessFunctionDefinitionsByEnterprise(enterprise.id)) {
    for (const assignment of listStaffingAssignments(definition.id)) {
      if (!assignment.workerName) continue;
      const roles = staffed.get(assignment.workerName) ?? [];
      roles.push(
        assignment.role === "human-approver"
          ? `approves ${definition.label}`
          : definition.label
      );
      staffed.set(assignment.workerName, roles);
    }
  }

  const names = [...staffed.keys()].sort();

  return [
    `  Workers (${names.length}):`,
    ...(names.length === 0
      ? ["    (none)"]
      : names.map(
          (name) => {
            const worker = getWorker(name);
            const kind = worker
              ? worker.kind
              : "not registered";
            return `    - ${name} (${kind}) — ${(staffed.get(name) ?? []).join(", ")}`;
          }
        )),
  ];
}

/**
 * Purpose: Lists the governance rules that apply to this Enterprise.
 *
 * SIDE EFFECT: Reads the policy rule store.
 */
export function formatEnterprisePolicyLines(
  enterprise: Enterprise
): readonly string[] {
  const rules = loadPolicyRules().filter(
    (rule) =>
      rule.scope?.type === "organization" &&
      rule.scope.id === enterprise.id
  );

  return [
    `  Policies (${rules.length}):`,
    ...(rules.length === 0
      ? ["    (none)"]
      : rules.map(
          (rule) => `    - ${rule.effect}: ${rule.description}`
        )),
  ];
}

/**
 * Purpose: Handles enterprise inspection by id or name.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads enterprise and business function stores.
 * - Writes terminal output.
 */
function handleEnterpriseInspectCommand(
  args: readonly string[]
): void {
  const [
    idOrName,
  ] = args;

  if (!idOrName) {
    console.log(
      createEnterpriseInspectUsage()
    );

    return;
  }

  console.log(
    formatEnterpriseDetail(
      idOrName
    )
  );
}

/**
 * Purpose: Handles enterprise description updates.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Mutates the in-memory enterprise store.
 * - Writes terminal output.
 */
function handleEnterpriseUpdateCommand(
  args: readonly string[]
): void {
  const [
    idOrName,
  ] = args;

  const description =
    getFlagValue(
      args,
      "--description"
    )?.trim();

  if (!idOrName || !description) {
    console.log(
      createEnterpriseUpdateUsage()
    );

    return;
  }

  const enterprise =
    updateEnterpriseDescription(
      idOrName,
      description
    );

  if (!enterprise) {
    console.log(
      `enterprise not found: ${idOrName}`
    );

    return;
  }

  console.log(
    formatEnterpriseUpdated(
      enterprise
    )
  );
}

/**
 * Purpose: Handles enterprise list command.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads the in-memory enterprise store.
 * - Writes terminal output.
 */
function handleEnterpriseListCommand(): void {
  console.log(
    formatEnterpriseList()
  );
}

/**
 * Purpose: Handles /enterprise command and subcommands.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads or mutates enterprise state.
 * - Writes terminal output.
 */
export function handleEnterpriseCommand(
  args: readonly string[]
): void {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  switch (subcommand) {
    case "create": {
      handleEnterpriseCreateCommand(
        subcommandArgs
      );

      return;
    }

    case "inspect": {
      handleEnterpriseInspectCommand(
        subcommandArgs
      );

      return;
    }

    case "update": {
      handleEnterpriseUpdateCommand(
        subcommandArgs
      );

      return;
    }

    case "list": {
      handleEnterpriseListCommand();

      return;
    }

    default: {
      if (
        subcommand &&
        getFlagValue(
          args,
          "--description"
        )?.trim()
      ) {
        handleEnterpriseCreateCommand(
          args
        );

        return;
      }

      console.log(
        createEnterpriseUsage()
      );
    }
  }
}
