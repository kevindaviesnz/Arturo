import { describe, expect, it } from "vitest";
import {
  MAX_FILES_PER_LOOK,
  SETTLE_MS,
  describeUnreadableEntry,
  fileKey,
  lookAtFolder,
  refuseWatchedFolder,
  selectListEntries,
  type FolderEntry,
} from "./watchedFolder";

const NOW = 1_800_000_000_000;

const file = (name: string, overrides: Partial<FolderEntry> = {}): FolderEntry => ({
  name,
  isFile: true,
  isSymbolicLink: false,
  sizeBytes: 1200,
  mtimeMs: NOW - 60_000,
  ...overrides,
});

describe("what in a watched folder is read", () => {
  it("takes in an ordinary text or Word file that has stopped changing", () => {
    const look = lookAtFolder([file("trends.txt"), file("report.DOCX")], new Set(), NOW);

    expect(look.takeIn.map((entry) => entry.name)).toEqual(["report.DOCX", "trends.txt"]);
    expect(look.passedOver).toEqual([]);
  });

  it("never follows a link out of the folder", () => {
    const link = file("passwords.txt", { isFile: false, isSymbolicLink: true });

    expect(describeUnreadableEntry(link)).toContain("only files in the folder itself are read");
    expect(lookAtFolder([link], new Set(), NOW)).toMatchObject({
      takeIn: [],
      passedOver: [{ entry: link }],
    });
  });

  it("passes over what it cannot read, and says why", () => {
    expect(describeUnreadableEntry(file("run.sh"))).toContain("this is none of those");
    expect(describeUnreadableEntry(file(".DS_Store"))).toBe("it is a hidden file");
    expect(describeUnreadableEntry(file("empty.txt", { sizeBytes: 0 }))).toBe("it is empty");
    expect(describeUnreadableEntry(file("huge.txt", { sizeBytes: 3 * 1024 * 1024 }))).toBe("it is larger than 2 MB");
  });

  it("says nothing about subfolders", () => {
    const folder = file("archive", { isFile: false });

    expect(lookAtFolder([folder], new Set(), NOW)).toEqual({ takeIn: [], passedOver: [] });
  });

  it("waits for a file that is still being written", () => {
    const writing = file("trends.txt", { mtimeMs: NOW - (SETTLE_MS - 1) });

    expect(lookAtFolder([writing], new Set(), NOW)).toEqual({ takeIn: [], passedOver: [] });
    expect(lookAtFolder([writing], new Set(), NOW + SETTLE_MS).takeIn).toHaveLength(1);
  });

  it("takes the same file in once, and a changed one again", () => {
    const first = file("trends.txt");
    const seen = new Set([fileKey(first)]);

    expect(lookAtFolder([first], seen, NOW).takeIn).toEqual([]);
    expect(lookAtFolder([file("trends.txt", { sizeBytes: 1300 })], seen, NOW).takeIn).toHaveLength(1);
  });

  it("limits how many files one look takes in, oldest first", () => {
    const many = Array.from({ length: MAX_FILES_PER_LOOK + 3 }, (_, index) =>
      file(`day-${index}.txt`, { mtimeMs: NOW - 100_000 + index })
    );

    const look = lookAtFolder(many, new Set(), NOW);

    expect(look.takeIn).toHaveLength(MAX_FILES_PER_LOOK);
    expect(look.takeIn[0].name).toBe("day-0.txt");
  });
});

describe("which folders may be watched", () => {
  const HOME = "/Users/kevin";
  const DATA = "/Users/kevin/Arturo/cli/.data/fast-fashion";

  it("allows a folder kept for the purpose", () => {
    expect(refuseWatchedFolder("/Users/kevin/trend-drops", HOME, DATA)).toBeUndefined();
  });

  it("refuses a folder too broad to be meant", () => {
    expect(refuseWatchedFolder("/", HOME, DATA)).toContain("too broad");
    expect(refuseWatchedFolder(HOME, HOME, DATA)).toContain("too broad");
    expect(refuseWatchedFolder("/Users", HOME, DATA)).toContain("your whole home folder");
  });

  it("refuses Arturo's own data, from either side", () => {
    expect(refuseWatchedFolder(`${DATA}/evidence`, HOME, DATA)).toContain("Arturo's own data");
    expect(refuseWatchedFolder("/Users/kevin/Arturo/cli/.data", HOME, DATA)).toContain("Arturo's own data");
    // A neighbour whose name merely starts the same is not inside it.
    expect(refuseWatchedFolder(`${DATA}-drops`, HOME, DATA)).toBeUndefined();
  });
});

describe("taking a list's first entries, with no model", () => {
  const REPORT = JSON.stringify({
    trends: [
      { rank: 1, name: "ballet flats" },
      { rank: 2, name: "burgundy" },
      { rank: 3, title: "wide-leg jeans" },
      { rank: 4 },
    ],
    notes: ["DEMO"],
  });

  it("takes them from the top, in the file's own order", () => {
    const selected = selectListEntries(REPORT, { list: "trends", first: 3 });

    expect("entries" in selected && selected.entries.map((item) => [item.position, item.of, item.label])).toEqual([
      [1, 4, "ballet flats"],
      [2, 4, "burgundy"],
      [3, 4, "wide-leg jeans"],
    ]);
    expect("entries" in selected && selected.entries[0].entry).toEqual({ rank: 1, name: "ballet flats" });
  });

  it("names an entry by its position when it does not name itself", () => {
    const selected = selectListEntries(REPORT, { list: "trends", first: 5 });

    expect("entries" in selected && selected.entries[3].label).toBe("entry 4");
  });

  it("never takes more than the limit, whatever was asked", () => {
    const many = JSON.stringify({ trends: Array.from({ length: 40 }, (_, index) => ({ name: `t${index}` })) });
    const selected = selectListEntries(many, { list: "trends", first: 40 });

    expect("entries" in selected && selected.entries).toHaveLength(5);
  });

  it("says why a file cannot be split", () => {
    expect(selectListEntries("not json", { list: "trends", first: 3 })).toEqual({ reason: "the file is not valid JSON" });
    expect(selectListEntries(REPORT, { list: "styles", first: 3 })).toEqual({ reason: 'the file has no list called "styles"' });
    expect(selectListEntries(JSON.stringify({ trends: [] }), { list: "trends", first: 3 })).toEqual({ reason: 'the list "trends" is empty' });
    expect(selectListEntries(JSON.stringify([1, 2]), { list: "trends", first: 3 })).toEqual({ reason: 'the file has no list called "trends"' });
  });
});
