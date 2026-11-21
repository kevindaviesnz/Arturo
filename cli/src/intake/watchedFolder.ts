/**
 * A folder Arturo watches for new files.
 *
 * Gathering material — search results, feeds, exports — is a job for a script:
 * it is faster, cheaper and gives the same answer every time. What Arturo adds
 * is judgment on what was gathered. The join between the two was missing: a
 * file had to be registered and a Task created by hand, every time.
 *
 * Arturo does not run the script and never executes anything it finds. A file
 * that appears in a watched folder is registered as an Artefact and handed to
 * one Task, exactly as if a person had typed the two commands. Its contents
 * are untrusted data, and the Task it starts is routed and governed like any
 * other.
 */

export type WatchedFolder = {
  readonly id: string;
  /** Absolute, with symbolic links resolved when the watch was created. */
  readonly folder: string;
  readonly enterpriseId: string;
  readonly enterpriseName: string;
  readonly functionLabel: string;
  /** The instruction every file that arrives is handled under. */
  readonly instruction: string;
  /**
   * The registered person who set the watch up. They are recorded as having
   * supplied each file, because nobody else chose to trust the folder.
   */
  readonly setUpBy: string;
  readonly createdAt: number;
  /**
   * When set, a JSON file is not handed over whole. Arturo cuts the first few
   * entries out of one of its lists and creates a Task for each.
   */
  readonly each?: EachEntry;
};

export type EachEntry = {
  /** The top-level key of the list, such as "trends". */
  readonly list: string;
  /** How many entries to take, from the top, in the order the file gives. */
  readonly first: number;
};

/** The most entries one file may be split into. */
export const MAX_ENTRIES_PER_FILE = 5;

export type ListEntry = {
  readonly position: number;
  readonly of: number;
  /** What the entry calls itself, when it says. */
  readonly label: string;
  readonly entry: unknown;
};

/**
 * Cuts the first entries out of a list in a JSON document, with no model.
 *
 * Asked to choose the three strongest of ten ranked trends, a local model
 * wrote about the two weakest and padded the rest with its own; given a long
 * document it had worked from the end of it each time. Choosing is not asked
 * of the model here. The script that wrote the file put the entries in order,
 * and Arturo takes them from the top as they stand: it does not rank them.
 *
 * Returns the reason instead when the file is not JSON or has no such list.
 *
 * PURE: No side effects.
 */
export function selectListEntries(
  jsonText: string,
  each: EachEntry
): { readonly entries: readonly ListEntry[] } | { readonly reason: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { reason: "the file is not valid JSON" };
  }
  const list =
    typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)[each.list]
      : undefined;
  if (!Array.isArray(list)) {
    return { reason: `the file has no list called "${each.list}"` };
  }
  if (list.length === 0) {
    return { reason: `the list "${each.list}" is empty` };
  }
  const labelOf = (entry: unknown, position: number): string => {
    const named =
      typeof entry === "object" && entry !== null
        ? (entry as Record<string, unknown>).name ??
          (entry as Record<string, unknown>).title
        : undefined;
    return typeof named === "string" && named.trim()
      ? named.trim().slice(0, 80)
      : `entry ${position}`;
  };
  return {
    entries: list
      .slice(0, Math.min(each.first, MAX_ENTRIES_PER_FILE))
      .map((entry, index) => ({
        position: index + 1,
        of: list.length,
        label: labelOf(entry, index + 1),
        entry,
      })),
  };
}

export type TakenInFile = {
  /** Name, size and modification time: the same file is taken in once. */
  readonly key: string;
  readonly fileName: string;
  readonly takenAt: number;
  /** Absent for a file that was already in the folder when the watch began. */
  readonly artefactReference?: string;
  readonly taskId?: string;
  /** Every Task created, when the file was split into entries. */
  readonly taskIds?: readonly string[];
  /** Why a file was passed over, when it was. */
  readonly skipped?: string;
};

export type FolderEntry = {
  readonly name: string;
  readonly isFile: boolean;
  readonly isSymbolicLink: boolean;
  readonly sizeBytes: number;
  readonly mtimeMs: number;
};

/**
 * A file is left alone until it has gone this long without changing, so a
 * script that is still writing is not read half-finished.
 */
export const SETTLE_MS = 10_000;

/**
 * At most this many files are taken in from one folder in one look. A script
 * that goes wrong and writes a thousand files should not queue a thousand
 * Tasks before anyone notices.
 */
export const MAX_FILES_PER_LOOK = 5;

/** Larger files are passed over; a Worker is given a bounded excerpt anyway. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024;

const READABLE_ENDINGS = [".txt", ".md", ".csv", ".json", ".docx"];

/**
 * PURE: No side effects.
 */
export function fileKey(entry: FolderEntry): string {
  return `${entry.name}|${entry.sizeBytes}|${Math.floor(entry.mtimeMs)}`;
}

/**
 * Says why a folder entry is not taken in, or undefined when it may be.
 *
 * Only an ordinary file sitting directly in the folder is ever read. A
 * symbolic link is refused because it can point anywhere on the machine, which
 * would let whatever writes to the folder choose what Arturo reads.
 *
 * PURE: No side effects.
 */
export function describeUnreadableEntry(
  entry: FolderEntry
): string | undefined {
  if (entry.isSymbolicLink) {
    return "it is a link to somewhere else, and only files in the folder itself are read";
  }
  if (!entry.isFile) {
    return "it is not a file";
  }
  if (entry.name.startsWith(".")) {
    return "it is a hidden file";
  }
  if (!READABLE_ENDINGS.some((ending) => entry.name.toLowerCase().endsWith(ending))) {
    return `Arturo reads ${READABLE_ENDINGS.join(", ")} files, and this is none of those`;
  }
  if (entry.sizeBytes === 0) {
    return "it is empty";
  }
  if (entry.sizeBytes > MAX_FILE_BYTES) {
    return "it is larger than 2 MB";
  }
  return undefined;
}

export type FolderLook = {
  /** Files to register and hand to a Task now, oldest first. */
  readonly takeIn: readonly FolderEntry[];
  /** Files that will never be taken in as they stand, each with the reason. */
  readonly passedOver: readonly { readonly entry: FolderEntry; readonly reason: string }[];
};

/**
 * Decides what to do about a folder's current contents.
 *
 * A file still changing, or beyond this look's limit, is neither taken in nor
 * passed over: it is simply looked at again next time.
 *
 * PURE: No side effects.
 */
export function lookAtFolder(
  entries: readonly FolderEntry[],
  alreadySeen: ReadonlySet<string>,
  now: number
): FolderLook {
  const unseen = entries.filter((entry) => !alreadySeen.has(fileKey(entry)));
  const passedOver = unseen.flatMap((entry) => {
    // A directory is not reported: a folder commonly holds subfolders, and
    // naming each as "passed over" would be noise.
    if (!entry.isFile && !entry.isSymbolicLink) return [];
    const reason = describeUnreadableEntry(entry);
    return reason ? [{ entry, reason }] : [];
  });
  const takeIn = unseen
    .filter((entry) => !describeUnreadableEntry(entry))
    .filter((entry) => now - entry.mtimeMs >= SETTLE_MS)
    .sort((a, b) => a.mtimeMs - b.mtimeMs || a.name.localeCompare(b.name))
    .slice(0, MAX_FILES_PER_LOOK);

  return { takeIn, passedOver };
}

/**
 * Says why a folder may not be watched, or undefined when it may.
 *
 * `folder` and `home` are absolute paths with symbolic links resolved.
 *
 * PURE: No side effects.
 */
export function refuseWatchedFolder(
  folder: string,
  home: string,
  dataDirectory: string
): string | undefined {
  const within = (inner: string, outer: string): boolean =>
    inner === outer || inner.startsWith(outer.endsWith("/") ? outer : `${outer}/`);

  if (folder === "/" || folder === home) {
    return "That folder is too broad to watch. Make a folder just for the files Arturo should take in, and watch that.";
  }
  if (within(home, folder)) {
    return "That folder contains your whole home folder. Make a folder just for the files Arturo should take in, and watch that.";
  }
  if (within(folder, dataDirectory) || within(dataDirectory, folder)) {
    return "That folder holds Arturo's own data. Watch a folder that is kept apart from it.";
  }
  return undefined;
}
