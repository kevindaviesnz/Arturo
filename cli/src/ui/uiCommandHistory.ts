import fs from "node:fs";
import path from "node:path";

import {
  resolveRuntimeDataDirectory,
} from "../storage/runtimeStoragePaths";

export const MAX_COMMAND_HISTORY_ENTRIES =
  500;

const COMMAND_HISTORY_PATH =
  path.join(
    resolveRuntimeDataDirectory(),
    "command-history.json"
  );

/** Parses persisted command history defensively. */
export function parseCommandHistory(
  value: string
): readonly string[] {
  try {
    const parsed: unknown =
      JSON.parse(
        value
      );

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter(
        (entry): entry is string =>
          typeof entry === "string" &&
          entry.trim().length > 0
      )
      .slice(
        -MAX_COMMAND_HISTORY_ENTRIES
      );
  } catch {
    return [];
  }
}

/** Loads history from disk, returning an empty list when none exists. */
export function loadCommandHistory(
  filePath: string =
    COMMAND_HISTORY_PATH
): readonly string[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return parseCommandHistory(
    fs.readFileSync(
      filePath,
      "utf8"
    )
  );
}

/** Appends one submitted command using an atomic file replacement. */
export function appendCommandHistory(
  command: string,
  filePath: string =
    COMMAND_HISTORY_PATH
): readonly string[] {
  const normalized =
    command.trim();

  if (normalized.length === 0) {
    return loadCommandHistory(
      filePath
    );
  }

  const history = [
    ...loadCommandHistory(
      filePath
    ),
    normalized,
  ].slice(
    -MAX_COMMAND_HISTORY_ENTRIES
  );

  fs.mkdirSync(
    path.dirname(filePath),
    {
      recursive: true,
    }
  );

  const temporaryPath =
    `${filePath}.tmp-${process.pid}`;

  fs.writeFileSync(
    temporaryPath,
    JSON.stringify(
      history,
      null,
      2
    ),
    "utf8"
  );

  fs.renameSync(
    temporaryPath,
    filePath
  );

  return history;
}

/** Maintains shell-style Up/Down navigation, including draft restoration. */
export class CommandHistoryNavigator {
  private history: string[];
  private cursor: number;
  private draft = "";

  constructor(
    history: readonly string[]
  ) {
    this.history = [
      ...history,
    ];
    this.cursor =
      this.history.length;
  }

  record(
    command: string
  ): void {
    const normalized =
      command.trim();

    if (normalized.length > 0) {
      this.history = [
        ...this.history,
        normalized,
      ].slice(
        -MAX_COMMAND_HISTORY_ENTRIES
      );
    }

    this.cursor =
      this.history.length;
    this.draft = "";
  }

  previous(
    currentValue: string
  ): string {
    if (this.history.length === 0) {
      return currentValue;
    }

    if (
      this.cursor ===
      this.history.length
    ) {
      this.draft =
        currentValue;
    }

    this.cursor =
      Math.max(
        0,
        this.cursor - 1
      );

    return this.history[
      this.cursor
    ];
  }

  next(
    currentValue: string
  ): string {
    if (
      this.history.length === 0 ||
      this.cursor === this.history.length
    ) {
      return currentValue;
    }

    this.cursor += 1;

    return this.cursor ===
      this.history.length
      ? this.draft
      : this.history[
          this.cursor
        ];
  }
}
