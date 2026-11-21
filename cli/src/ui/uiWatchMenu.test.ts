import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { clearCommandMenu, handleCommandMenuReply, startArtefactMenu } from "./uiCommandHandlers";
import { addWorker, clearWorkers, createHumanWorker } from "../control/workers";
import { clearEnterprises, createAndSaveEnterprise } from "../enterprise/enterpriseStore";
import { clearBusinessFunctionDefinitions, createAndSaveBusinessFunctionDefinition } from "../business/businessFunctionDefinitionStore";
import { clearWatchedFolders, listWatchedFolders } from "../intake/watchedFolderRuntime";

describe("watching a folder, a question at a time", () => {
  let folder: string;
  const reset = () => {
    clearCommandMenu();
    clearWatchedFolders();
    clearBusinessFunctionDefinitions();
    clearEnterprises();
    clearWorkers();
  };

  beforeEach(() => {
    reset();
    folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "arturo-watch-menu-")));
    const enterprise = createAndSaveEnterprise({ name: "Threadline Fashion", mission: "Make clothes." });
    createAndSaveBusinessFunctionDefinition({ id: `${enterprise.id}:design-briefs`, enterpriseId: enterprise.id, label: "Design Briefs", objective: "Write briefs." });
    addWorker(createHumanWorker("Kevin", "guardian"));
  });
  afterEach(() => {
    reset();
    fs.rmSync(folder, { recursive: true, force: true });
  });

  const reply = async (text: string) => (await handleCommandMenuReply(text))!;

  it("asks for the folder, Function, instruction and split, and sets up the same watch as the one-line form", async () => {
    expect(startArtefactMenu()[0].body).toContain("8. Watch a folder");

    expect((await reply("8"))[0].label).toBe("Which folder?");
    expect((await reply(folder))[0].body).toContain("Design Briefs — Threadline Fashion");
    expect((await reply("1"))[0].label).toBe("What should be done with each file?");
    // The only person registered is taken without asking.
    expect((await reply("Write the content of one garment design brief from the supplied document."))[0].body).toContain(
      "Kevin will be recorded as having set this up."
    );
    expect((await reply("trends"))[0].body).toContain('How many entries of "trends"');

    const [done] = await reply("");

    expect(done.label).toBe("Folder watched");
    expect(done.body).toContain("takes the first 3 entries");
    expect(listWatchedFolders()).toMatchObject([
      {
        folder,
        functionLabel: "Design Briefs",
        enterpriseName: "Threadline Fashion",
        setUpBy: "Kevin",
        each: { list: "trends", first: 3 },
      },
    ]);
  });

  it("hands each file over whole when no list is named", async () => {
    startArtefactMenu();
    await reply("8");
    await reply(folder);
    await reply("1");
    await reply("Summarise the supplied document.");

    const [done] = await reply("");

    expect(done.body).toContain("is registered as a document and given to Design Briefs");
    expect(listWatchedFolders()[0].each).toBeUndefined();
  });
});
