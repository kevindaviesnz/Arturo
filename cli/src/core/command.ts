/**
 * Command Core Types
 *
 * This defines the ONLY allowed interface between:
 * - REPL layer (impure)
 * - Command layer (orchestration)
 *
 * Commands MUST NOT access state directly.
 * They use getState/setState only.
 */

import { WorkerState } from "./workerRegistry";

export type Command = {
  name: string;
  description: string;
  handler: (args: string[], ctx: CommandContext) => void;
};

export type CommandContext = {
  getState: () => WorkerState;
  setState: (state: WorkerState) => void;
};
