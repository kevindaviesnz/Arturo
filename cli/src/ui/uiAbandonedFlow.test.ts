import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { routeUiLine } from "./uiLineRouter";
import { clearCommandMenu, isCommandMenuActive } from "./uiCommandHandlers";
import { clearEnterprises, listEnterprises } from "../enterprise/enterpriseStore";

/**
 * All four investor demo scenarios failed the same way. Each answered the two
 * questions the menu advertised ("two questions, done"), then typed its next
 * command — but a further question was still open. The command ended the
 * flow, and any answers not yet saved were dropped without a word, so later
 * steps failed on "Enterprise required".
 *
 * The command still ends the flow. What changed is that it now says so.
 * /setup saves the name and mission once both are answered, so an interruption
 * after that keeps the business and says it is still there.
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

  async function startNamingABusiness(): Promise<void> {
    await routeUiLine("/setup");
    await routeUiLine("BrightPath Studio");
  }

  async function startSettingUpABusiness(): Promise<void> {
    await startNamingABusiness();
    await routeUiLine("Help independent professionals explain their services.");
  }

  it("says the half-finished flow was dropped", async () => {
    await startNamingABusiness();
    const result = await routeUiLine("/function");
    const bodies = result.entries.map((entry) => entry.body).join("\n");
    expect(bodies).toContain("setting up a business");
    expect(bodies).toContain("not saved");
  });

  it("still runs the command that interrupted it", async () => {
    await startNamingABusiness();
    const result = await routeUiLine("/function");
    expect(result.route).toBe("command");
    // The menu the command opens is the last word, not the abandoned flow.
    expect(isCommandMenuActive()).toBe(true);
  });

  it("creates nothing from the answers it dropped", async () => {
    await startNamingABusiness();
    await routeUiLine("/function");
    expect(listEnterprises()).toHaveLength(0);
  });

  it("keeps a business already saved and says so, when a later command arrives", async () => {
    await startSettingUpABusiness();
    const result = await routeUiLine("/function");
    const bodies = result.entries.map((entry) => entry.body).join("\n");
    expect(bodies).toContain("setting up a business");
    expect(bodies).toContain("already saved");
    expect(bodies).toContain("/setup");
    expect(listEnterprises()).toHaveLength(1);
    expect(listEnterprises()[0].name).toBe("BrightPath Studio");
    expect(result.route).toBe("command");
    expect(isCommandMenuActive()).toBe(true);
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

  it("lets the flow finish when the name and mission are answered", async () => {
    await startSettingUpABusiness();
    expect(listEnterprises()).toHaveLength(1);
    expect(listEnterprises()[0].name).toBe("BrightPath Studio");
    expect(listEnterprises()[0].mission).toContain("independent professionals");
  });
});
