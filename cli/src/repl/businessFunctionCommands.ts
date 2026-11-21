import { describeHandOff, getHandOff } from "../runtime/handOff";
import { getBusinessFunctionDefinition as findFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { functionContinuesByItself, MAX_CHAIN_DEPTH } from "../runtime/followUpChain";
import { listStaffingAssignments } from "../staffing/staffingStore";
import type {
  BusinessFunctionDefinition,
} from "../business/businessFunctionDefinition";

import {
  createAndSaveBusinessFunctionDefinition,
  getBusinessFunctionDefinitionByIdOrLabel,
  listBusinessFunctionDefinitions,
  listBusinessFunctionDefinitionsByEnterprise,
  updateBusinessFunctionDetails,
} from "../business/businessFunctionDefinitionStore";

import {
  createBusinessFunctionRuntime,
  type BusinessFunctionRuntime,
} from "../business/businessFunctionRuntime";

import {
  getBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  failBusinessFunctionRuntime,
  listBusinessFunctions,
  pauseBusinessFunctionRuntime,
  resumeBusinessFunctionRuntime,
  saveBusinessFunction,
  startBusinessFunctionRuntime,
  stopBusinessFunctionRuntime,
} from "../business/businessFunctionRuntimeStore";

import {
  attachEnterpriseBusinessFunction,
  getEnterprise,
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";

import type {
  Enterprise,
} from "../enterprise/enterprise";

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
 * Purpose: Formats an optional business function description.
 *
 * Params:
 * - description: Optional description.
 *
 * Returns:
 * - Description or "(none)".
 *
 * PURE: No side effects.
 */
function formatBusinessFunctionDescription(
  description: string | undefined
): string {
  return description && description.trim().length > 0
    ? description
    : "(none)";
}

/** Formats the first guided action after a Business Function is created. */
export function formatBusinessFunctionCreatedNextAction(): string {
  return "Run /staff to add Workers.";
}

/**
 * Purpose: Formats a business function runtime display value.
 *
 * Params:
 * - definition: Business function definition.
 *
 * Returns:
 * - Runtime display text.
 *
 * PURE: No side effects.
 */
function formatBusinessFunctionRuntime(
  definition: BusinessFunctionDefinition
): string {
  return definition.runtimeId ?? "(none)";
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
 * Purpose: Converts a human name into a URL-safe slug segment.
 *
 * Params:
 * - value: Free-text name (e.g. an Enterprise or Job name).
 * - fallback: Segment to use when the name slugs to empty.
 *
 * Returns:
 * - Lowercase slug with non-alphanumeric runs collapsed to single hyphens.
 *
 * PURE: No side effects.
 */
function slugifyIdSegment(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

/**
 * Purpose: Creates a readable, unique business function id from names.
 *
 * The id reads like `discovery-hub:curated-content-manager` so operators can
 * recognise a Job at a glance instead of parsing `enterprise-2:function-1`.
 *
 * Params:
 * - enterpriseName: Enterprise name (slugged for the id prefix).
 * - label: Job/function name (slugged for the id suffix).
 * - existingIds: Ids already in use; a numeric suffix is appended on collision.
 *
 * Returns:
 * - Business function id, guaranteed not to collide with existingIds.
 *
 * PURE: No side effects.
 */
export function createEnterpriseBusinessFunctionId(
  enterpriseName: string,
  label: string,
  existingIds: readonly string[] = []
): string {
  const prefix = slugifyIdSegment(enterpriseName, "enterprise");
  const suffix = slugifyIdSegment(label, "function");
  const base = `${prefix}:${suffix}`;

  const taken = new Set(existingIds);

  if (!taken.has(base)) {
    return base;
  }

  let counter = 2;

  while (taken.has(`${base}-${counter}`)) {
    counter += 1;
  }

  return `${base}-${counter}`;
}

/**
 * Purpose: Formats runtime business functions for terminal output.
 *
 * Params:
 * - businessFunctions: Runtime business functions.
 *
 * Returns:
 * - Human-readable business function list.
 *
 * PURE: No side effects.
 */
export function formatBusinessFunctions(
  businessFunctions: ReturnType<typeof listBusinessFunctions>
): string {
  if (businessFunctions.length === 0) {
    return "No active functions found.";
  }

  return businessFunctions
    .map((businessFunction, index) =>
      [
        `${index + 1}. ${businessFunction.label}`,
        `   id: ${businessFunction.id}`,
        `   status: ${businessFunction.state}`,
        `   owner: ${businessFunction.ownerWorker}`,
        `   refinements: ${businessFunction.refinements.length}`,
        `   tasks: ${businessFunction.jobIds.length}`,
      ].join("\n")
    )
    .join("\n\n");
}

/**
 * Purpose: Formats a Chapter 4 business function creation result.
 *
 * Params:
 * - definition: Created business function definition.
 * - enterprise: Owning enterprise.
 *
 * Returns:
 * - Human-readable creation output.
 *
 * PURE: No side effects.
 */
export function formatBusinessFunctionCreated(
  definition: BusinessFunctionDefinition,
  enterprise: Enterprise
): string {
  return [
    "Function created.",
    "",
    `  ID:            ${definition.id}`,
    `  Name:          ${definition.label}`,
    `  Enterprise:    ${enterprise.name} (${enterprise.id})`,
    `  Objective:     ${definition.objective || "(none)"}`,
    `  Description:   ${formatBusinessFunctionDescription(definition.description)}`,
    `  Status:        ${definition.status}`,
    "  Operating state: Not started",
    `  Created:       ${formatTimestamp(definition.createdAt)}`,
    "",
    formatBusinessFunctionCreatedNextAction(),
  ].join("\n");
}

/**
 * Purpose: Formats a Chapter 4 business function update result.
 *
 * Params:
 * - definition: Updated business function definition.
 *
 * Returns:
 * - Human-readable update output.
 *
 * PURE: No side effects.
 */
export function formatBusinessFunctionUpdated(
  definition: BusinessFunctionDefinition
): string {
  return [
    "Function updated.",
    "",
    `  ID:            ${definition.id}`,
    `  Name:          ${definition.label}`,
    `  Objective:     ${definition.objective || "(none)"}`,
    `  Description:   ${formatBusinessFunctionDescription(definition.description)}`,
    `  Status:        ${definition.status}`,
    `  Updated:       ${formatTimestamp(definition.updatedAt)}`,
  ].join("\n");
}

/**
 * Purpose: Formats a Chapter 4 or Chapter 5 business function inspection result.
 *
 * Params:
 * - definition: Business function definition.
 * - enterprise: Owning enterprise.
 *
 * Returns:
 * - Human-readable inspection output.
 *
 * SIDE EFFECT:
 * - Reads runtime store when a runtime is attached.
 */
/**
 * Says who is assigned to a Function.
 *
 * The detail view showed everything about a Function except who does its
 * work, so an operator who had just staffed one could not confirm it there.
 *
 * SIDE EFFECT: Reads the staffing assignment store.
 */
export function formatBusinessFunctionStaffLines(
  functionId: string
): string[] {
  const assignments = listStaffingAssignments(functionId);
  const workers = assignments
    .filter((assignment) => assignment.role === "ai" && assignment.workerName)
    .map((assignment) => assignment.workerName);
  const approvers = assignments
    .filter((assignment) => assignment.role === "human-approver")
    .map((assignment) => assignment.workerName || "nobody yet");

  const definition = findFunctionDefinition(functionId);
  const handOff = getHandOff(functionId);

  return [
    `  Workers:       ${workers.length > 0 ? workers.join(", ") : "none assigned — run /staff"}`,
    ...(approvers.length > 0
      ? [`  Approver:      ${[...new Set(approvers)].join(", ")}`]
      : []),
    // Whether Arturo may add to the work by itself is as much a fact about a
    // Function as who staffs it, and was visible nowhere.
    `  Follow-on work: ${
      definition && functionContinuesByItself(definition)
        ? `on — may create up to ${MAX_CHAIN_DEPTH} further Tasks from one that finishes`
        : "off — only does the work you ask for"
    }`,
    ...(handOff ? [`  Hand-off:      ${describeHandOff(handOff)}`] : []),
  ];
}

export function formatBusinessFunctionDetail(
  definition: BusinessFunctionDefinition,
  enterprise: Enterprise
): string {
  const runtime =
    definition.runtimeId
      ? getBusinessFunction(
          definition.runtimeId
        )
      : undefined;

  if (definition.runtimeId && runtime) {
    return [
      `Function: ${definition.label}`,
      `  ID:            ${definition.id}`,
      `  Objective:     ${definition.objective || "(none)"}`,
      `  Status:        ${definition.status}`,
      `  Operating state: ${runtime.state}`,
      ...formatBusinessFunctionStaffLines(definition.id),
    ].join("\n");
  }

  return [
    `Function: ${definition.label}`,
    `  ID:            ${definition.id}`,
    `  Enterprise:    ${enterprise.name} (${enterprise.id})`,
    `  Objective:     ${definition.objective || "(none)"}`,
    `  Description:   ${formatBusinessFunctionDescription(definition.description)}`,
    `  Status:        ${definition.status}`,
    ...formatBusinessFunctionStaffLines(definition.id),
    `  Created:       ${formatTimestamp(definition.createdAt)}`,
    `  Updated:       ${formatTimestamp(definition.updatedAt)}`,
    "",
    "  Operating state:",
    "    Not started",
    "",
    "  Governance:",
    "    (none defined)",
  ].join("\n");
}

/**
 * Purpose: Formats Chapter 4 business function list output.
 *
 * Params:
 * - definitions: Business function definitions.
 *
 * Returns:
 * - Human-readable list output.
 *
 * PURE: No side effects.
 */
export function formatBusinessFunctionDefinitionList(
  definitions: readonly BusinessFunctionDefinition[]
): string {
  if (definitions.length === 0) {
    return "No functions found.";
  }

  return [
    "  ID                     Name                 Status      Operating state",
    ...definitions.map(
      (definition) =>
        [
          `  ${definition.id.padEnd(22)}`,
          definition.label.padEnd(20),
          definition.status.padEnd(11),
          formatBusinessFunctionRuntime(
            definition
          ),
        ].join(" ")
    ),
  ].join("\n");
}

/**
 * Purpose: Creates usage text for /function.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - Usage text.
 *
 * PURE: No side effects.
 */
function createFunctionUsage(): string {
  return [
    "Usage:",
    '  /function create "<name>" --enterprise "<enterprise-name-or-id>" [--objective "<objective>"] [--description "<description>"]',
    '  /function update "<name-or-id>" [--objective "<objective>"] [--description "<description>"] [--enterprise "<enterprise-name-or-id>"]',
    '  /function inspect "<name-or-id>" [--enterprise "<enterprise-name-or-id>"]',
    '  /function list [--enterprise "<enterprise-name-or-id>"]',
  ].join("\n");
}

/**
 * Purpose: Handles /function create.
 *
 * Params:
 * - args: Command arguments after "create".
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads enterprise store.
 * - Mutates definition store.
 * - Mutates enterprise store.
 * - Writes terminal output.
 */
function handleFunctionCreateCommand(
  args: readonly string[]
): void {
  const enterpriseIdOrName =
    getFlagValue(
      args,
      "--enterprise"
    )?.trim();

  const objective =
    getFlagValue(
      args,
      "--objective"
    )?.trim() ?? "";

  const description =
    getFlagValue(
      args,
      "--description"
    )?.trim();

  const positionalArgs =
    removeFlagPair(
      removeFlagPair(
        removeFlagPair(
          args,
          "--enterprise"
        ),
        "--objective"
      ),
      "--description"
    );

  const [
    label,
  ] = positionalArgs;

  if (!label || !enterpriseIdOrName) {
    console.log(
      'Usage: /function create "<name>" --enterprise "<enterprise-name-or-id>" [--objective "<objective>"] [--description "<description>"]'
    );

    return;
  }

  const enterprise =
    getEnterpriseByIdOrName(
      enterpriseIdOrName
    );

  if (!enterprise) {
    console.log(
      `enterprise not found: ${enterpriseIdOrName}`
    );

    return;
  }

  const id =
    createEnterpriseBusinessFunctionId(
      enterprise.name,
      label,
      listBusinessFunctionDefinitions().map(
        (definition) => definition.id
      )
    );

  const definition =
    createAndSaveBusinessFunctionDefinition({
      id,
      enterpriseId:
        enterprise.id,
      label,
      objective,
      description:
        description ||
        undefined,
    });

  attachEnterpriseBusinessFunction(
    enterprise.id,
    definition.id
  );

  console.log(
    formatBusinessFunctionCreated(
      definition,
      enterprise
    )
  );
}

/**
 * Purpose: Handles /function update.
 *
 * Params:
 * - args: Command arguments after "update".
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Mutates definition store.
 * - Writes terminal output.
 */
function handleFunctionUpdateCommand(
  args: readonly string[]
): void {
  const [
    idOrLabel,
  ] = args;

  const description =
    getFlagValue(
      args,
      "--description"
    )?.trim();

  const objective =
    getFlagValue(
      args,
      "--objective"
    )?.trim();

  const enterpriseReference =
    getFlagValue(
      args,
      "--enterprise"
    )?.trim();

  if (!idOrLabel || (!description && !objective)) {
    console.log(
      'Usage: /function update "<name-or-id>" [--objective "<objective>"] [--description "<description>"] [--enterprise "<enterprise-name-or-id>"]'
    );

    return;
  }

  const enterprise =
    enterpriseReference
      ? getEnterpriseByIdOrName(
          enterpriseReference
        )
      : undefined;
  if (enterpriseReference && !enterprise) {
    console.log(
      `enterprise not found: ${enterpriseReference}`
    );
    return;
  }
  const scopedDefinition =
    enterprise
      ? listBusinessFunctionDefinitionsByEnterprise(
          enterprise.id
        ).find(
          (candidate) =>
            candidate.id === idOrLabel ||
            candidate.label.trim().toLowerCase() ===
              idOrLabel.toLowerCase()
        )
      : undefined;
  if (enterprise && !scopedDefinition) {
    console.log(
      `function not found in ${enterprise.name}: ${idOrLabel}`
    );
    return;
  }
  const definition =
    updateBusinessFunctionDetails(
      enterprise
        ? scopedDefinition!.id
        : idOrLabel,
      { objective, description }
    );

  if (!definition) {
    console.log(
      `function not found: ${idOrLabel}`
    );

    return;
  }

  console.log(
    formatBusinessFunctionUpdated(
      definition
    )
  );
}

/**
 * Purpose: Handles /function inspect.
 *
 * Params:
 * - args: Command arguments after "inspect".
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads definition and enterprise stores.
 * - Writes terminal output.
 */
function handleFunctionInspectCommand(
  args: readonly string[]
): void {
  const [
    idOrLabel,
  ] = args;
  const enterpriseReference =
    getFlagValue(
      args,
      "--enterprise"
    )?.trim();

  if (!idOrLabel) {
    console.log(
      'Usage: /function inspect "<name-or-id>" [--enterprise "<enterprise-name-or-id>"]'
    );

    return;
  }

  const requestedEnterprise =
    enterpriseReference
      ? getEnterpriseByIdOrName(
          enterpriseReference
        )
      : undefined;
  if (enterpriseReference && !requestedEnterprise) {
    console.log(
      `enterprise not found: ${enterpriseReference}`
    );
    return;
  }
  const definition =
    requestedEnterprise
      ? listBusinessFunctionDefinitionsByEnterprise(
          requestedEnterprise.id
        ).find(
          (candidate) =>
            candidate.id === idOrLabel ||
            candidate.label.trim().toLowerCase() ===
              idOrLabel.toLowerCase()
        )
      : getBusinessFunctionDefinitionByIdOrLabel(
          idOrLabel
        );

  if (!definition) {
    console.log(
      `function not found: ${idOrLabel}`
    );

    return;
  }

  const enterprise =
    getEnterprise(
      definition.enterpriseId
    );

  if (!enterprise) {
    console.log(
      `enterprise not found: ${definition.enterpriseId}`
    );

    return;
  }

  console.log(
    formatBusinessFunctionDetail(
      definition,
      enterprise
    )
  );
}

/**
 * Purpose: Handles /function list.
 *
 * Params:
 * - args: Command arguments after "list".
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads definition and enterprise stores.
 * - Writes terminal output.
 */
function handleFunctionListCommand(
  args: readonly string[]
): void {
  const enterpriseIdOrName =
    getFlagValue(
      args,
      "--enterprise"
    )?.trim();

  if (!enterpriseIdOrName) {
    console.log(
      formatBusinessFunctionDefinitionList(
        listBusinessFunctionDefinitions()
      )
    );

    return;
  }

  const enterprise =
    getEnterpriseByIdOrName(
      enterpriseIdOrName
    );

  if (!enterprise) {
    console.log(
      `enterprise not found: ${enterpriseIdOrName}`
    );

    return;
  }

  console.log(
    formatBusinessFunctionDefinitionList(
      listBusinessFunctionDefinitionsByEnterprise(
        enterprise.id
      )
    )
  );
}

/**
 * Purpose: Handles /function and its Chapter 4 subcommands.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads or mutates business function state.
 * - Writes terminal output.
 */
export function handleFunctionCommand(
  args: readonly string[]
): void {
  const [
    subcommand,
    ...subcommandArgs
  ] = args;

  switch (subcommand) {
    case "create": {
      handleFunctionCreateCommand(
        subcommandArgs
      );

      return;
    }

    case "update": {
      handleFunctionUpdateCommand(
        subcommandArgs
      );

      return;
    }

    case "inspect": {
      handleFunctionInspectCommand(
        subcommandArgs
      );

      return;
    }

    case "list": {
      handleFunctionListCommand(
        subcommandArgs
      );

      return;
    }

    default: {
      console.log(
        createFunctionUsage()
      );
    }
  }
}

/**
 * Purpose: Formats the result of a business function lifecycle transition.
 *
 * Params:
 * - action: Lifecycle action that completed.
 * - businessFunction: Updated runtime business function.
 *
 * Returns:
 * - Human-readable lifecycle result.
 *
 * PURE: No side effects.
 */
export function formatFunctionLifecycleResult(
  action: string,
  businessFunction: BusinessFunctionRuntime
): string {
  return [
    `function ${action}`,
    `id: ${businessFunction.id}`,
    `status: ${businessFunction.state}`,
  ].join("\n");
}

/**
 * Purpose: Handles a business function lifecycle command.
 *
 * Params:
 * - args: Command arguments.
 * - usage: Usage message when no id is supplied.
 * - action: Lifecycle action that completed.
 * - transition: Runtime transition function.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Updates the runtime business function.
 * - Writes terminal output.
 */
export function handleFunctionLifecycleCommand(
  args: readonly string[],
  usage: string,
  action: string,
  transition: (
    id: string
  ) => BusinessFunctionRuntime | undefined
): void {
  const [
    id,
  ] = args;

  if (!id) {
    console.log(
      usage
    );
    return;
  }

  const businessFunction =
    transition(
      id
    );

  if (!businessFunction) {
    console.log(
      `function not found: ${id}`
    );
    return;
  }

  console.log(
    formatFunctionLifecycleResult(
      action,
      businessFunction
    )
  );
}

/**
 * Purpose: Handles the legacy /add-function command.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads enterprise store.
 * - Mutates business function definition store.
 * - Mutates business function runtime store.
 * - Mutates enterprise store.
 * - Writes terminal output.
 */
export function handleAddFunctionCommand(
  args: readonly string[]
): void {
  const [
    enterpriseId,
    label,
    ...objectiveParts
  ] = args;

  const objective =
    objectiveParts
      .join(" ")
      .trim();

  if (!enterpriseId || !label || !objective) {
    console.log(
      'Usage: /add-function <enterprise-id> "<function name>" "<objective>"'
    );
    return;
  }

  const enterprise =
    getEnterprise(
      enterpriseId
    );

  if (!enterprise) {
    console.log(
      `enterprise not found: ${enterpriseId}`
    );
    return;
  }

  const businessFunctionId =
    createEnterpriseBusinessFunctionId(
      enterprise.name,
      label,
      listBusinessFunctionDefinitions().map(
        (definition) => definition.id
      )
    );

  createAndSaveBusinessFunctionDefinition({
    id: businessFunctionId,
    enterpriseId,
    label,
    objective,
    description: objective,
    executionMode: "manual",
  });

  const businessFunction =
    createBusinessFunctionRuntime({
      id: businessFunctionId,
      label,
      objective,
      ownerWorker: "unassigned",
    });

  saveBusinessFunction(
    businessFunction
  );

  attachEnterpriseBusinessFunction(
    enterpriseId,
    businessFunction.id
  );

  console.log(
    [
      "function added",
      `enterprise: ${enterpriseId}`,
      `function: ${businessFunction.label}`,
      `id: ${businessFunction.id}`,
    ].join("\n")
  );
}

/**
 * Purpose: Handles the legacy /functions command.
 *
 * Params:
 * - None.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Reads runtime business functions.
 * - Writes terminal output.
 */
export function handleFunctionsCommand(): void {
  console.log(
    formatBusinessFunctions(
      listBusinessFunctions()
    )
  );
}

/**
 * Purpose: Handles the /start-function command.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Updates runtime business function state.
 * - Writes terminal output.
 */
export function handleStartFunctionCommand(
  args: readonly string[]
): void {
  handleFunctionLifecycleCommand(
    args,
    "Usage: /start-function <function-id>",
    "started",
    startBusinessFunctionRuntime
  );
}

/**
 * Purpose: Handles the /pause-function command.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Updates runtime business function state.
 * - Writes terminal output.
 */
export function handlePauseFunctionCommand(
  args: readonly string[]
): void {
  handleFunctionLifecycleCommand(
    args,
    "Usage: /pause-function <function-id>",
    "paused",
    pauseBusinessFunctionRuntime
  );
}

/**
 * Purpose: Handles the /resume-function command.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Updates runtime business function state.
 * - Writes terminal output.
 */
export function handleResumeFunctionCommand(
  args: readonly string[]
): void {
  handleFunctionLifecycleCommand(
    args,
    "Usage: /resume-function <function-id>",
    "resumed",
    resumeBusinessFunctionRuntime
  );
}

/**
 * Purpose: Handles the /stop-function command.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Updates runtime business function state.
 * - Writes terminal output.
 */
export function handleStopFunctionCommand(
  args: readonly string[]
): void {
  handleFunctionLifecycleCommand(
    args,
    "Usage: /stop-function <function-id>",
    "stopped",
    stopBusinessFunctionRuntime
  );
}

/**
 * Purpose: Handles the /fail-function command.
 *
 * Params:
 * - args: Command arguments.
 *
 * Returns:
 * - void
 *
 * SIDE EFFECT:
 * - Updates runtime business function state.
 * - Writes terminal output.
 */
export function handleFailFunctionCommand(
  args: readonly string[]
): void {
  handleFunctionLifecycleCommand(
    args,
    "Usage: /fail-function <function-id>",
    "failed",
    failBusinessFunctionRuntime
  );
}
