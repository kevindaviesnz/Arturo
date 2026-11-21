import type {
  WorkStreamEntry,
} from "./uiState";

import {
  formatRuntimeDetail,
  formatRuntimeStarted,
  resolveRuntimeInspectionTarget,
  startRuntimeForBusinessFunction,
} from "../repl/runtimeCommands";

import {
  getBusinessFunctionDefinitionByIdOrLabel,
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";

import {
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";

function getRuntimeEnterpriseReference(
  args: readonly string[]
): string | undefined {
  const index =
    args.indexOf(
      "--enterprise"
    );
  return index >= 0
    ? args[index + 1]
    : undefined;
}

/**
 * Purpose: Handles /runtime start from the terminal UI.
 *
 * Params:
 * - args: Runtime start arguments.
 *
 * Returns:
 * - Work stream entries for runtime start, usage, or error.
 *
 * SIDE EFFECT:
 * - Starts runtime.
 * - Updates business function definition.
 */
export async function handleUiRuntimeStartCommand(
  args: readonly string[]
): Promise<readonly WorkStreamEntry[]> {
  const [
    idOrLabel,
  ] = args;
  const enterpriseReference =
    getRuntimeEnterpriseReference(
      args
    );

  if (!idOrLabel) {
    return [
      {
        actor: "Arturo",
        label: "Usage",
        body: 'Use /function start "<function-name-or-id>" [--enterprise "<enterprise-name-or-id>"], or run /function on its own and pick from the menu.',
      },
    ];
  }

  const enterprise =
    enterpriseReference
      ? getEnterpriseByIdOrName(
          enterpriseReference
        )
      : undefined;
  if (enterpriseReference && !enterprise) {
    return [
      {
        actor: "Arturo",
        label: "Enterprise not found",
        body: `enterprise not found: ${enterpriseReference}`,
      },
    ];
  }
  const definition =
    enterprise
      ? listBusinessFunctionDefinitionsByEnterprise(
          enterprise.id
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
    return [
      {
        actor: "Arturo",
        label: "Function not found",
        body: `function not found: ${idOrLabel}`,
      },
    ];
  }

  const runtime =
    startRuntimeForBusinessFunction(
      definition
    );

  return [
    {
      actor: "Arturo",
      label: "Function started",
      body: [
        formatRuntimeStarted(
          runtime
        ),
      ].join("\n\n"),
    },
  ];
}
