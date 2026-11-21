import fs from "node:fs";
import path from "node:path";

import { formatArtefactReference } from "../artefacts/artefact";
import { createArtefact } from "../artefacts/artefactStore";
import { handleTaskCreateCommand } from "../repl/taskRoutingCommands";
import { listJobs } from "../runtime/jobQueue";
import { broadcastEvent } from "../runtime/runtimeEventPublisher";
import {
  clearPersistedWatchedFolders,
  deleteWatchedFolder,
  loadAllTakenInFiles,
  loadTakenInFiles,
  loadWatchedFolders,
  saveTakenInFile,
  saveWatchedFolder,
} from "../storage/watchedFolderRepository";
import { resolveRuntimeDataDirectory } from "../storage/runtimeStoragePaths";
import {
  fileKey,
  lookAtFolder,
  selectListEntries,
  type FolderEntry,
  type TakenInFile,
  type WatchedFolder,
} from "./watchedFolder";

/**
 * Reads what is directly inside a folder, without following anything.
 *
 * SIDE EFFECT: Reads the file system.
 */
export function readFolderEntries(folder: string): FolderEntry[] {
  return fs.readdirSync(folder).flatMap((name) => {
    try {
      // lstat, not stat: a link is reported as a link, never as its target.
      const stat = fs.lstatSync(path.join(folder, name));
      return [
        {
          name,
          isFile: stat.isFile(),
          isSymbolicLink: stat.isSymbolicLink(),
          sizeBytes: stat.size,
          mtimeMs: stat.mtimeMs,
        },
      ];
    } catch {
      // Removed between being listed and being looked at.
      return [];
    }
  });
}

/**
 * Starts watching a folder. Whatever is in it already is noted and left
 * alone: only files that arrive from now on are taken in.
 *
 * SIDE EFFECT: Reads the file system and writes the runtime database.
 */
export function addWatchedFolder(
  input: Omit<WatchedFolder, "id" | "createdAt">,
  now = Date.now()
): WatchedFolder {
  const highest = loadWatchedFolders().reduce(
    (max, folder) => Math.max(max, Number(folder.id.replace("watch-", "")) || 0),
    0
  );
  const watched: WatchedFolder = {
    ...input,
    id: `watch-${highest + 1}`,
    createdAt: now,
  };
  saveWatchedFolder(watched);
  for (const entry of readFolderEntries(watched.folder)) {
    saveTakenInFile(watched.id, {
      key: fileKey(entry),
      fileName: entry.name,
      takenAt: now,
      skipped: "It was already in the folder when the watch began.",
    });
  }
  return watched;
}

/** SIDE EFFECT: Reads the runtime database. */
export function listWatchedFolders(): WatchedFolder[] {
  return loadWatchedFolders();
}

/** SIDE EFFECT: Reads the runtime database. */
export function listTakenInFiles(folderId: string): TakenInFile[] {
  return loadTakenInFiles(folderId);
}

/**
 * Every file any watch has taken in, with the folder it came from when that
 * watch still exists. A removed watch keeps its history but not its folder.
 *
 * SIDE EFFECT: Reads the runtime database.
 */
export function listAllTakenInFiles(): Array<{ folder?: WatchedFolder; file: TakenInFile }> {
  const folders = new Map(loadWatchedFolders().map((folder) => [folder.id, folder]));
  return loadAllTakenInFiles().map(({ folderId, file }) => ({ folder: folders.get(folderId), file }));
}

/**
 * Stops watching. Artefacts and Tasks it already created are untouched.
 *
 * SIDE EFFECT: Writes the runtime database.
 */
export function removeWatchedFolder(id: string): boolean {
  const exists = loadWatchedFolders().some((folder) => folder.id === id);
  if (exists) deleteWatchedFolder(id);
  return exists;
}

/** SIDE EFFECT: Deletes every watched folder and its history. */
export function clearWatchedFolders(): void {
  clearPersistedWatchedFolders();
}

/**
 * Creates the Task for one file through the ordinary command, so it is
 * routed and governed exactly as one typed by hand, and reports what the
 * command said.
 *
 * SIDE EFFECT: May create a Task.
 */
function createTaskForFile(
  watched: WatchedFolder,
  artefactReference: string
): { readonly taskId?: string; readonly said: string } {
  const before = new Set(listJobs().map((job) => job.id));
  const lines: string[] = [];
  const originalLog = console.log;
  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  try {
    // The arguments that follow "create", as the interface passes them. With
    // "create" included, a real Task's instruction began "create Summarise…".
    handleTaskCreateCommand([
      watched.instruction,
      "--function",
      watched.functionLabel,
      "--enterprise",
      watched.enterpriseName,
      "--input-artefact",
      artefactReference,
    ]);
  } finally {
    console.log = originalLog;
  }
  return {
    taskId: listJobs().find((job) => !before.has(job.id))?.id,
    said: lines.join(" "),
  };
}

/**
 * Splits an arrived JSON file into its first entries and creates a Task for
 * each, each given only its own entry.
 *
 * Every entry is written to a file of its own in Arturo's data directory and
 * registered as an Artefact, so what a Worker was shown is on record and
 * fingerprinted like any other document.
 *
 * SIDE EFFECT: Writes files, creates Artefacts and Tasks.
 */
function takeInEntries(
  watched: WatchedFolder,
  file: FolderEntry,
  sourceReference: string,
  now: number
): Partial<TakenInFile> {
  const each = watched.each!;
  const selected = selectListEntries(
    fs.readFileSync(path.join(watched.folder, file.name), "utf8"),
    each
  );
  if ("reason" in selected) {
    broadcastEvent(
      "intake.task_not_created",
      "warn",
      `${file.name} arrived in ${watched.folder} and was registered as ${sourceReference}, but was not split into Tasks: ${selected.reason}`
    );
    return {
      artefactReference: sourceReference,
      skipped: `Registered, but not split into Tasks: ${selected.reason}.`,
    };
  }

  const directory = path.join(
    resolveRuntimeDataDirectory(),
    "watched-entries",
    watched.id
  );
  fs.mkdirSync(directory, { recursive: true });

  const taskIds: string[] = [];
  const problems: string[] = [];
  for (const item of selected.entries) {
    const entryFile = path.join(
      directory,
      `${sourceReference.replace("@", "-v")}-${each.list}-${item.position}.json`
    );
    fs.writeFileSync(
      entryFile,
      `${JSON.stringify(
        {
          from: sourceReference,
          list: each.list,
          position: item.position,
          of: item.of,
          entry: item.entry,
        },
        null,
        2
      )}\n`
    );
    const artefact = createArtefact({
      enterpriseId: watched.enterpriseId,
      name: `${file.name} — ${each.list} ${item.position} of ${item.of}: ${item.label}`,
      kind: "other",
      file: entryFile,
      createdBy: watched.setUpBy,
      notes: `Entry ${item.position} of ${item.of} in the list "${each.list}" of ${sourceReference}, cut out by Arturo with no AI model involved (${watched.id}). The entries were taken from the top in the order the file gives; Arturo did not rank them.`,
      now,
    });
    const task = createTaskForFile(
      watched,
      formatArtefactReference({ artefactId: artefact.id, version: 1 })
    );
    if (task.taskId) {
      taskIds.push(task.taskId);
    } else {
      problems.push(task.said);
    }
  }

  broadcastEvent(
    taskIds.length > 0 ? "intake.file_taken_in" : "intake.task_not_created",
    taskIds.length > 0 ? "info" : "warn",
    `${file.name} arrived in ${watched.folder}: registered as ${sourceReference} and split into ${taskIds.length} Task${taskIds.length === 1 ? "" : "s"}${taskIds.length > 0 ? ` (${taskIds.join(", ")})` : ""}`
  );

  return {
    artefactReference: sourceReference,
    ...(taskIds.length > 0 ? { taskId: taskIds[0], taskIds } : {}),
    ...(problems.length > 0
      ? { skipped: `No Task could be created for ${problems.length} entr${problems.length === 1 ? "y" : "ies"}: ${problems[0]}` }
      : {}),
  };
}

/**
 * Registers one arrived file and hands it to a Task.
 *
 * The file is recorded as seen whatever happens, so a file that cannot be
 * handled is reported once and not retried on every look.
 *
 * SIDE EFFECT: Creates an Artefact and a Task; writes the runtime database.
 */
function takeInFile(
  watched: WatchedFolder,
  entry: FolderEntry,
  now: number
): TakenInFile {
  const record = (rest: Partial<TakenInFile>): TakenInFile => {
    const taken: TakenInFile = {
      key: fileKey(entry),
      fileName: entry.name,
      takenAt: now,
      ...rest,
    };
    saveTakenInFile(watched.id, taken);
    return taken;
  };

  try {
    const artefact = createArtefact({
      enterpriseId: watched.enterpriseId,
      name: entry.name,
      kind: "other",
      file: path.join(watched.folder, entry.name),
      createdBy: watched.setUpBy,
      notes: `Taken in automatically from the watched folder ${watched.folder} (${watched.id}). ${watched.setUpBy} set the watch up; nobody looked at this file before it was registered.`,
      now,
    });
    const artefactReference = formatArtefactReference({
      artefactId: artefact.id,
      version: 1,
    });
    if (watched.each) {
      return record(
        takeInEntries(watched, entry, artefactReference, now)
      );
    }

    const task = createTaskForFile(watched, artefactReference);

    if (!task.taskId) {
      broadcastEvent(
        "intake.task_not_created",
        "warn",
        `${entry.name} arrived in ${watched.folder} and was registered as ${artefactReference}, but no Task was created: ${task.said}`
      );
      return record({
        artefactReference,
        skipped: `Registered, but no Task could be created: ${task.said}`,
      });
    }

    broadcastEvent(
      "intake.file_taken_in",
      "info",
      `${entry.name} arrived in ${watched.folder}: registered as ${artefactReference} and given to Task ${task.taskId}`
    );
    return record({ artefactReference, taskId: task.taskId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    broadcastEvent(
      "intake.file_not_taken_in",
      "warn",
      `${entry.name} arrived in ${watched.folder} but could not be taken in: ${message}`
    );
    return record({ skipped: message });
  }
}

/**
 * Looks at every watched folder once.
 *
 * SIDE EFFECT: Reads the file system; may create Artefacts and Tasks.
 */
export function runWatchedFolders(now = Date.now()): TakenInFile[] {
  const results: TakenInFile[] = [];

  for (const watched of loadWatchedFolders()) {
    let entries: FolderEntry[];
    try {
      entries = readFolderEntries(watched.folder);
    } catch {
      // Unplugged drive, renamed folder: nothing to take in, and saying so
      // every few seconds would bury everything else. /artefact watch list
      // reports that the folder cannot be read.
      continue;
    }

    const seen = new Set(loadTakenInFiles(watched.id).map((file) => file.key));
    const look = lookAtFolder(entries, seen, now);

    for (const { entry, reason } of look.passedOver) {
      const passed: TakenInFile = {
        key: fileKey(entry),
        fileName: entry.name,
        takenAt: now,
        skipped: `Passed over: ${reason}.`,
      };
      saveTakenInFile(watched.id, passed);
      broadcastEvent(
        "intake.file_passed_over",
        "warn",
        `${entry.name} in ${watched.folder} was passed over: ${reason}`
      );
      results.push(passed);
    }
    for (const entry of look.takeIn) {
      results.push(takeInFile(watched, entry, now));
    }
  }

  return results;
}

let interval: NodeJS.Timeout | undefined;

/**
 * Starts the process-local look at watched folders.
 *
 * SIDE EFFECT: Starts a timer.
 */
export function startWatchedFolderRuntime(intervalMs = 20_000): void {
  if (interval) return;
  const look = (): void => {
    try {
      runWatchedFolders();
    } catch (error: unknown) {
      broadcastEvent(
        "intake.look_failed",
        "error",
        `Watched folders could not be looked at: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  };
  interval = setInterval(look, intervalMs);
  interval.unref();
}

/** SIDE EFFECT: Stops the timer; stored watches remain. */
export function stopWatchedFolderRuntime(): void {
  if (!interval) return;
  clearInterval(interval);
  interval = undefined;
}
