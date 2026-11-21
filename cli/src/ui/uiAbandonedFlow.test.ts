import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { routeUiLine } from "./uiLineRouter";
import { clearCommandMenu, isCommandMenuActive } from "./uiCommandHandlers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";

/**
 * All four investor demo scenarios failed the same way. Each answered the two
 * questions the menu advertised ("two questions, done"), then typed its next
 * command — but the flow asks a third, optional one. The command ended the
 * flow, the half-built Enterprise was dropped without a word, and every later
 * step failed on "Enterprise required".
 *
 * The command still ends the flow. What changed is that it now says so.
 */
describe("a command typed part-way through a guided flow", () => {
  beforeEach(() => {
    clearCommandMenu();
    clearEnterprises();
    process.stdin.isTTY = true;
  });

  afterEach(() => {
    clearCommandMenu();
    clearEnterprises();
    process.stdin.isTTY = false;
  });

  async function startSettingUpABusiness(): Promise<void> {
    await routeUiLine("/enterprise");
    await routeUiLine("1");
    await routeUiLine("BrightPath Studio");
    await routeUiLine("Help independent professionals explain their services.");
  }

  it("says the half-finished flow was dropped", async () => {
    await startSettingUpABusiness();
    const result = await routeUiLine("/enterprise");
    const bodies = result.entries.map((entry) => entry.body).join("\n");
    expect(bodies).toContain("setting up a business");
    expect(bodies).toContain("not saved");
  });

  it("still runs the command that interrupted it", async () => {
    await startSettingUpABusiness();
    const result = await routeUiLine("/enterprise");
    expect(result.route).toBe("command");
    // The menu the command opens is the last word, not the abandoned flow.
    expect(isCommandMenuActive()).toBe(true);
  });

  it("creates nothing from the answers it dropped", async () => {
    await startSettingUpABusiness();
    await routeUiLine("/enterprise");
    expect(listEnterprises()).toHaveLength(0);
  });

  // The investor demos died here. A person half-added before /staff stayed
  // open, and because that flow is checked first, it answered the "yes" that
  // was confirming the staffing plan — reporting a person added while the
  // Workers were never applied. The Task needing them failed much later, with
  // a message pointing at /staff, which had appeared to succeed.
  it("does not let a half-added person answer a later question", async () => {
    await routeUiLine("/add-human-worker");
    await routeUiLine("Alex Reed");
    await routeUiLine("1");
    // The email question is still open here; the plan types a command instead.
    const interrupted = await routeUiLine("/workers");
    expect(interrupted.entries.map((entry) => entry.body).join("\n")).toContain(
      "adding a person"
    );

    const later = await routeUiLine("yes");
    expect(later.entries.map((entry) => entry.label).join(" ")).not.toContain(
      "Human worker added"
    );
  });

  it("stays quiet when no flow was open", async () => {
    const result = await routeUiLine("/enterprise");
    const labels = result.entries.map((entry) => entry.label).join(" ");
    expect(labels).not.toContain("Stopped part-way");
  });

  it("lets the flow finish when the third question is answered", async () => {
    await startSettingUpABusiness();
    await routeUiLine("skip");
    expect(listEnterprises()).toHaveLength(1);
    expect(listEnterprises()[0].name).toBe("BrightPath Studio");
  });
});
