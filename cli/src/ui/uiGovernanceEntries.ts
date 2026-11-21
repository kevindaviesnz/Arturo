import { governanceCommandOutput } from "../repl/governanceCommands";
import type { WorkStreamEntry } from "./uiState";

function toEntry(result: { label: string; body: string }): WorkStreamEntry {
  return { actor: "Arturo", ...result };
}

export function readGovernanceEntry(): WorkStreamEntry {
  return toEntry(governanceCommandOutput());
}

export function createGovernanceUsageEntry(): WorkStreamEntry {
  return toEntry(governanceCommandOutput(["unknown"]));
}

export function readGovernancePolicyInspectEntry(args: readonly string[]): WorkStreamEntry {
  return toEntry(governanceCommandOutput(["policy", "inspect", ...args]));
}

export function handleUiGovernanceCommand(args: readonly string[]): WorkStreamEntry {
  return toEntry(governanceCommandOutput(args));
}
