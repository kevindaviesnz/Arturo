import type { TakenInFile, WatchedFolder } from "../intake/watchedFolder";
import { runtimeDb } from "./runtimeDatabase";

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadWatchedFolders(): WatchedFolder[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM watched_folders ORDER BY created_at, id")
    .all() as Array<{ recordJson: string }>;
  return rows.map((row) => JSON.parse(row.recordJson) as WatchedFolder);
}

/** SIDE EFFECT: Inserts or replaces one row in the runtime SQLite database. */
export function saveWatchedFolder(folder: WatchedFolder): void {
  runtimeDb
    .prepare("INSERT OR REPLACE INTO watched_folders (id, created_at, record_json) VALUES (?, ?, ?)")
    .run(folder.id, folder.createdAt, JSON.stringify(folder));
}

/** SIDE EFFECT: Deletes one watched folder; what it took in is kept as history. */
export function deleteWatchedFolder(id: string): void {
  runtimeDb.prepare("DELETE FROM watched_folders WHERE id = ?").run(id);
}

/** SIDE EFFECT: Reads the runtime SQLite database. */
export function loadTakenInFiles(folderId: string): TakenInFile[] {
  const rows = runtimeDb
    .prepare("SELECT record_json AS recordJson FROM watched_folder_files WHERE folder_id = ? ORDER BY taken_at")
    .all(folderId) as Array<{ recordJson: string }>;
  return rows.map((row) => JSON.parse(row.recordJson) as TakenInFile);
}

/**
 * Every file any watch has taken in, including watches since removed.
 *
 * SIDE EFFECT: Reads the runtime SQLite database.
 */
export function loadAllTakenInFiles(): Array<{ folderId: string; file: TakenInFile }> {
  const rows = runtimeDb
    .prepare("SELECT folder_id AS folderId, record_json AS recordJson FROM watched_folder_files ORDER BY taken_at")
    .all() as Array<{ folderId: string; recordJson: string }>;
  return rows.map((row) => ({ folderId: row.folderId, file: JSON.parse(row.recordJson) as TakenInFile }));
}

/** SIDE EFFECT: Inserts or replaces one row in the runtime SQLite database. */
export function saveTakenInFile(folderId: string, file: TakenInFile): void {
  runtimeDb
    .prepare("INSERT OR REPLACE INTO watched_folder_files (folder_id, file_key, taken_at, record_json) VALUES (?, ?, ?, ?)")
    .run(folderId, file.key, file.takenAt, JSON.stringify(file));
}

/** SIDE EFFECT: Deletes every watched folder and its history. */
export function clearPersistedWatchedFolders(): void {
  runtimeDb.prepare("DELETE FROM watched_folder_files").run();
  runtimeDb.prepare("DELETE FROM watched_folders").run();
}
