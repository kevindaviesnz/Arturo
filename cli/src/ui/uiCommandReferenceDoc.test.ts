import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  UI_ALIAS_COMMANDS,
  UI_BEYOND_PRIMARY_COMMANDS,
  UI_COMMAND_HELP,
  UI_PRIMARY_COMMANDS,
} from "./uiCommandHelp.js";

/**
 * The written command reference. It is the only place a reader can find a
 * command without already knowing its name, so a command missing from it is
 * effectively undocumented outside the running terminal — which is how /start
 * came to have no coverage anywhere in docs while /ask, the command that
 * produces the plan /start runs, was documented in seven files.
 */
const referencePath = join(
  process.cwd(),
  "docs",
  "command-reference.md"
);

function readReference(): string {
  return readFileSync(referencePath, "utf8");
}

/** Commands the reference lists, read from its `| \`/x\` |` table cells. */
function referencedCommands(body: string): ReadonlySet<string> {
  return new Set(
    [...body.matchAll(/^\|\s*`(\/[a-z-]+)[^`]*`/gm)].map(
      (match) => match[1]
    )
  );
}

const aliasCommands = UI_ALIAS_COMMANDS;
const beyondPrimaryCommands = UI_BEYOND_PRIMARY_COMMANDS;

describe("written command reference", () => {
  it("covers every primary command", () => {
    const listed = referencedCommands(
      readReference()
    );

    for (const command of UI_PRIMARY_COMMANDS) {
      expect(
        listed.has(command),
        `docs/command-reference.md does not list ${command}`
      ).toBe(true);
    }
  });

  it("covers every accepted older name", () => {
    const listed = referencedCommands(
      readReference()
    );

    for (const command of aliasCommands) {
      expect(
        listed.has(command),
        `docs/command-reference.md does not list the accepted older name ${command}`
      ).toBe(true);
    }
  });

  it("lists no command the catalog does not define", () => {
    const known = new Set([
      ...UI_PRIMARY_COMMANDS,
      ...aliasCommands,
      ...beyondPrimaryCommands,
    ]);

    for (const command of referencedCommands(
      readReference()
    )) {
      expect(
        known.has(command),
        `docs/command-reference.md lists ${command}, which no longer exists`
      ).toBe(true);
    }
  });

  // Not advertised is not undocumented. A reader who meets /workflow in an
  // older transcript still has to be able to look it up.
  it("still lists the commands kept out of the primary guide", () => {
    const body = readReference();
    const listed = referencedCommands(body);
    for (const command of beyondPrimaryCommands) {
      expect(listed.has(command), `${command} is documented nowhere`).toBe(true);
    }
    expect(body).toContain("Beyond the primary surface");
  });

  it("keeps the older names out of the current-command tables", () => {
    // An alias listed beside the current command would teach the wrong name.
    // The alias table says what to use instead; the group tables must not.
    const body = readReference();
    const aliasSection = body.indexOf(
      "## Older names Arturo still accepts"
    );
    expect(aliasSection).toBeGreaterThan(0);

    const current = referencedCommands(
      body.slice(0, aliasSection)
    );

    for (const command of aliasCommands) {
      expect(
        current.has(command),
        `${command} is an older name and belongs only in the alias table`
      ).toBe(false);
    }
  });
});
