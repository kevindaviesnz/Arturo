import { describe, expect, it } from "vitest";

import {
  findUiCommandHelp,
  getUiCommandGuidedPrompt,
  UI_COMMAND_HELP,
} from "./uiCommandHelp";

import {
  formatUiCommandHelp,
} from "./uiHelpEntries";

import {
  readFileSync,
} from "node:fs";

import { join } from "node:path";

/**
 * Every value a command takes can be given by answering a numbered question,
 * so help has to lead with that form. A switch list presented first is what
 * sent operators copy-pasting flags in the first place.
 *
 * This also guards the catalogue against drifting from the code: a command
 * whose bare form opens a menu must say so in help, and help must not claim a
 * guided form that is not wired up.
 */
describe("guided-form help", () => {
  it("leads Usage with the guided form and demotes the switches", () => {
    const detail = findUiCommandHelp("/governance");
    expect(detail).toBeDefined();
    const body = formatUiCommandHelp(detail!);

    const usageIndex = body.indexOf("Usage:");
    const guidedIndex = body.indexOf("Asks what the rule is for");
    const switchesIndex = body.indexOf("Switches (only needed for scripts");

    expect(guidedIndex).toBeGreaterThan(usageIndex);
    expect(switchesIndex).toBeGreaterThan(guidedIndex);
    expect(body).toContain("type cancel at any point to stop");
    expect(body).toContain("Or give the values directly:");
  });

  it("keeps the plain switch heading for commands with no guided form", () => {
    // /chat takes its Worker and message positionally and has no menu.
    const detail = findUiCommandHelp("/workflow");
    expect(detail).toBeDefined();
    const body = formatUiCommandHelp(detail!);
    expect(body).toContain("Or give the values directly:");

    // A pure list command documents no switches at all any more: it shows
    // everything, so there is nothing to narrow.
    const workers = formatUiCommandHelp(findUiCommandHelp("/workers")!);
    expect(workers).not.toContain("Switches and values:");
    expect(workers).not.toContain("--");
  });

  it("does not repeat the bare command under the guided description", () => {
    const detail = findUiCommandHelp("/memory");
    const body = formatUiCommandHelp(detail!);
    const lines = body.split("\n");
    const start = lines.indexOf("Usage:");
    // Sections are unindented headings; the next one ends the Usage block.
    const end = lines.findIndex(
      (line, index) => index > start && /^\S.*:$/.test(line)
    );
    const usage = lines.slice(start, end);
    // Inside Usage, "/memory" appears once — as the guided form — rather than
    // again in the list of direct forms below it.
    expect(usage.filter((line) => line.trim() === "/memory")).toHaveLength(1);
  });

  it("only claims a guided form for a command that has one wired up", () => {
    const handlers = readFileSync(
      join(process.cwd(), "src", "ui", "uiCommandHandlers.ts"),
      "utf8"
    );
    const humanWorkerFlow = readFileSync(
      join(process.cwd(), "src", "ui", "uiAddHumanWorkerFlow.ts"),
      "utf8"
    );
    const modelEntries = readFileSync(
      join(process.cwd(), "src", "ui", "uiModelEntries.ts"),
      "utf8"
    );
    const source = [handlers, humanWorkerFlow, modelEntries].join("\n");

    const claimed = UI_COMMAND_HELP.map((detail) => detail.command).filter(
      (command) => getUiCommandGuidedPrompt(command) !== undefined
    );
    expect(claimed.length).toBeGreaterThan(15);

    for (const command of claimed) {
      // The dispatcher matches on the exact command string, so a claimed
      // guided form with no dispatch entry is a documentation-only promise.
      expect(source, `${command} claims a guided form`).toContain(
        `command === "${command}"`
      );
    }
  });
});
