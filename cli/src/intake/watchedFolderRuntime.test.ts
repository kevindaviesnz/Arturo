import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getArtefact } from "../artefacts/artefactStore";
import { DEMO_ENTERPRISE_NAME } from "../demo/demoScript";
import { seedDemoEnterprise } from "../demo/seedDemo";
import { getEnterpriseByName } from "../enterprise/enterpriseStore";
import { getJob, listJobs } from "../runtime/jobQueue";
import { handleUiCommand } from "../ui/uiCommandHandlers";
import {
  addWatchedFolder,
  clearWatchedFolders,
  listTakenInFiles,
  listWatchedFolders,
  runWatchedFolders,
} from "./watchedFolderRuntime";

const INSTRUCTION = "Summarise what the supplied document says. Use only the supplied document.";

/** Writes a file that stopped changing a minute ago. */
const drop = (folder: string, name: string, content: string): string => {
  const file = path.join(folder, name);
  fs.writeFileSync(file, content);
  const settled = new Date(Date.now() - 60_000);
  fs.utimesSync(file, settled, settled);
  return file;
};

describe("a watched folder", () => {
  let folder: string;
  let watchId: string;

  beforeAll(async () => {
    await seedDemoEnterprise(() => undefined);
    folder = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "arturo-watch-")));
    drop(folder, "already-here.txt", "Old material.");
    watchId = addWatchedFolder({
      folder,
      enterpriseId: getEnterpriseByName(DEMO_ENTERPRISE_NAME)!.id,
      enterpriseName: DEMO_ENTERPRISE_NAME,
      functionLabel: "Contract Review",
      instruction: INSTRUCTION,
      setUpBy: "Principal Lawyer",
    }).id;
  });

  afterAll(() => {
    clearWatchedFolders();
    fs.rmSync(folder, { recursive: true, force: true });
  });

  it("leaves alone what was in the folder before the watch began", () => {
    const before = listJobs().length;

    expect(runWatchedFolders()).toEqual([]);
    expect(listJobs()).toHaveLength(before);
  });

  it("registers a file that arrives and gives it to a Task, as the two commands would", () => {
    const before = new Set(listJobs().map((job) => job.id));
    drop(folder, "monday.txt", "Lace is trending.");

    const [taken] = runWatchedFolders();

    expect(taken).toMatchObject({ fileName: "monday.txt" });
    expect(taken.skipped).toBeUndefined();

    const version = getArtefact(taken.artefactReference!.split("@")[0])!.versions[0];
    expect(version.createdBy).toBe("Principal Lawyer");
    expect(version.localPath).toBe(path.join(folder, "monday.txt"));
    // The record says a program put it there, not a person.
    expect(version.notes).toContain("Taken in automatically from the watched folder");
    expect(version.notes).toContain("nobody looked at this file before it was registered");

    const task = getJob(taken.taskId!)!;
    expect(before.has(task.id)).toBe(false);
    expect(task.inputArtefactRefs).toEqual([taken.artefactReference]);
    expect(task.task.startsWith(INSTRUCTION)).toBe(true);
    expect(task.selectedWorker).toBe("Contract Reviewer");
    // Created, not run: it waits its turn and its governance like any other.
    expect(task.status).toBe("queued");
  });

  it("does not take the same file in twice", () => {
    const before = listJobs().length;

    expect(runWatchedFolders()).toEqual([]);
    expect(listJobs()).toHaveLength(before);
  });

  it("refuses a link that points out of the folder, once", () => {
    const outside = path.join(os.tmpdir(), `arturo-outside-${process.pid}.txt`);
    fs.writeFileSync(outside, "Not for Arturo.");
    fs.symlinkSync(outside, path.join(folder, "linked.txt"));
    const before = listJobs().length;

    const [passed] = runWatchedFolders();

    expect(passed.skipped).toContain("only files in the folder itself are read");
    expect(passed.artefactReference).toBeUndefined();
    expect(listJobs()).toHaveLength(before);
    expect(runWatchedFolders()).toEqual([]);
    fs.rmSync(outside);
  });

  it("records a file it registered but could not give to anyone", () => {
    const unstaffed = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "arturo-watch-")));
    addWatchedFolder({
      folder: unstaffed,
      enterpriseId: getEnterpriseByName(DEMO_ENTERPRISE_NAME)!.id,
      enterpriseName: DEMO_ENTERPRISE_NAME,
      functionLabel: "No Such Function",
      instruction: INSTRUCTION,
      setUpBy: "Principal Lawyer",
    });
    drop(unstaffed, "orphan.txt", "Material nobody is assigned to.");
    const before = listJobs().length;

    const [taken] = runWatchedFolders();

    expect(taken.taskId).toBeUndefined();
    expect(taken.skipped).toContain("no Task could be created");
    expect(listJobs()).toHaveLength(before);
    fs.rmSync(unstaffed, { recursive: true, force: true });
  });

  it("splits a JSON file into its first entries, one Task each, each given only its own entry", () => {
    const split = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "arturo-watch-")));
    addWatchedFolder({
      folder: split,
      enterpriseId: getEnterpriseByName(DEMO_ENTERPRISE_NAME)!.id,
      enterpriseName: DEMO_ENTERPRISE_NAME,
      functionLabel: "Contract Review",
      instruction: INSTRUCTION,
      setUpBy: "Principal Lawyer",
      each: { list: "trends", first: 2 },
    });
    drop(split, "report.json", JSON.stringify({
      trends: [
        { rank: 1, name: "ballet flats", views: 484000 },
        { rank: 2, name: "burgundy", views: 214000 },
        { rank: 3, name: "wide-leg jeans", views: 310000 },
      ],
    }));

    const [taken] = runWatchedFolders();

    expect(taken.taskIds).toHaveLength(2);
    const [first, second] = taken.taskIds!.map((id) => getJob(id)!);
    expect(first.task).toContain("ballet flats");
    expect(first.task).not.toContain("burgundy");
    expect(second.task).toContain("burgundy");
    expect(second.task).not.toContain("wide-leg jeans");

    const entry = getArtefact(first.inputArtefactRefs![0].split("@")[0])!;
    expect(entry.name).toBe("report.json — trends 1 of 3: ballet flats");
    expect(entry.versions[0].notes).toContain("cut out by Arturo with no AI model involved");
    expect(entry.versions[0].notes).toContain(taken.artefactReference!);
    fs.rmSync(split, { recursive: true, force: true });
  });

  it("registers but does not split a file that has no such list", () => {
    const split = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "arturo-watch-")));
    addWatchedFolder({
      folder: split,
      enterpriseId: getEnterpriseByName(DEMO_ENTERPRISE_NAME)!.id,
      enterpriseName: DEMO_ENTERPRISE_NAME,
      functionLabel: "Contract Review",
      instruction: INSTRUCTION,
      setUpBy: "Principal Lawyer",
      each: { list: "trends", first: 2 },
    });
    drop(split, "other.json", JSON.stringify({ styles: [] }));
    const before = listJobs().length;

    const [taken] = runWatchedFolders();

    expect(taken.skipped).toContain('the file has no list called "trends"');
    expect(taken.taskId).toBeUndefined();
    expect(listJobs()).toHaveLength(before);
    fs.rmSync(split, { recursive: true, force: true });
  });

  it("is set up, listed and removed from the command", async () => {
    const drops = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "arturo-watch-")));

    const [refused] = await handleUiCommand("/artefact", [
      "watch", "add", drops, "--function", "Contract Review", "--enterprise", DEMO_ENTERPRISE_NAME,
      "--task", INSTRUCTION, "--created-by", "Contract Reviewer",
    ]);
    expect(refused.body).toContain("Contract Reviewer is not a registered person");

    const [added] = await handleUiCommand("/artefact", [
      "watch", "add", drops, "--function", "Contract Review", "--enterprise", DEMO_ENTERPRISE_NAME,
      "--task", INSTRUCTION, "--created-by", "Principal Lawyer",
    ]);
    expect(added.body).toContain(`Watching ${drops}`);
    expect(added.body).toContain("It never runs them");

    const [again] = await handleUiCommand("/artefact", [
      "watch", "add", drops, "--function", "Contract Review", "--enterprise", DEMO_ENTERPRISE_NAME,
      "--task", INSTRUCTION, "--created-by", "Principal Lawyer",
    ]);
    expect(again.body).toContain("already being watched");

    const [home] = await handleUiCommand("/artefact", [
      "watch", "add", os.homedir(), "--function", "Contract Review", "--enterprise", DEMO_ENTERPRISE_NAME,
      "--task", INSTRUCTION, "--created-by", "Principal Lawyer",
    ]);
    expect(home.body).toContain("Folder not watched");

    const [listed] = await handleUiCommand("/artefact", ["watch", "list"]);
    expect(listed.body).toContain(drops);
    expect(listed.body).toContain(`${watchId}  ${folder}`);
    expect(listed.body).toContain("most recently monday.txt");

    const added_id = listWatchedFolders().find((watch) => watch.folder === drops)!.id;
    const [removed] = await handleUiCommand("/artefact", ["watch", "remove", added_id]);
    expect(removed.body).toContain("Stopped watching");
    expect(listWatchedFolders().some((watch) => watch.folder === drops)).toBe(false);
    expect(listTakenInFiles(watchId).some((file) => file.fileName === "monday.txt")).toBe(true);
    fs.rmSync(drops, { recursive: true, force: true });
  });
});
