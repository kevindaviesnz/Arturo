import { describe, expect, it } from "vitest";

import {
  getUiCommandOptionHelp,
  UI_COMMAND_HELP,
} from "./uiCommandHelp";

import {
  formatApprovedModelAliasHelp,
  formatUiCommandHelp,
} from "./uiHelpEntries";

import {
  UI_COMMAND_LONG_HELP,
} from "./uiCommandLongHelp";

/**
 * The model is chosen in exactly one place — /model — and the choice holds
 * until it is run again. No command takes it as a switch, and no help text
 * teaches one.
 *
 * This is not only a UX rule. A per-Worker model was never passed to the
 * provider (`generateWithConfiguredLlm` routes on the /model selection), so a
 * second model name only ever produced a Worker record and a capability
 * attestation naming a model that was not called.
 */
describe("the model is never a switch", () => {
  const modelSwitches = ["--model", "--compare"];

  it.each(modelSwitches)(
    "is not documented as %s in any command's usage or examples",
    (flag) => {
      for (const detail of UI_COMMAND_HELP) {
        const surfaces = [
          ...detail.usage,
          ...detail.examples,
          ...(detail.notes ?? []),
          ...getUiCommandOptionHelp(detail.command),
        ];
        for (const line of surfaces) {
          expect(line, `${detail.command}: ${line}`).not.toContain(flag);
        }
      }
    }
  );

  it.each(modelSwitches)(
    "is not taught as %s in any command's long help",
    (flag) => {
      for (const [command, longHelp] of Object.entries(UI_COMMAND_LONG_HELP)) {
        const surfaces = [
          ...longHelp.whenToUse,
          ...longHelp.workflow,
          ...longHelp.verification,
          ...longHelp.failures,
          ...longHelp.boundaries,
        ];
        for (const line of surfaces) {
          expect(line, `${command}: ${line}`).not.toContain(flag);
        }
      }
    }
  );

  it("points the model-selection help block at /model alone", () => {
    const block = formatApprovedModelAliasHelp({
      ARTURO_LLM_MODEL: "llama-test",
    }).join("\n");
    expect(block).toContain("chosen with /model, and only with /model");
    expect(block).toContain("until you run /model again");
    expect(block).not.toContain("--model");
    expect(block).not.toContain("--compare");
  });

  it("never renders a model switch in any rendered command help", () => {
    for (const detail of UI_COMMAND_HELP) {
      const body = formatUiCommandHelp(detail, {
        ARTURO_LLM_MODEL: "llama-test",
      });
      for (const flag of modelSwitches) {
        expect(body, `${detail.command} renders ${flag}`).not.toContain(flag);
      }
    }
  });
});
