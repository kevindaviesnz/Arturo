import { inflateRawSync } from "node:zlib";

/**
 * Reads the text of a Word document (.docx) so a Worker can be shown it.
 *
 * A law practice's documents are Word files, and until this existed a Worker
 * could be given plain text only: a supplied .docx reached it as a name and a
 * hash. A .docx is a ZIP of XML. This opens the three parts it needs, takes the
 * paragraph text, and — because contracts are numbered by Word, not typed —
 * rebuilds the numbering, without which "clause 4" is not in the text at all.
 *
 * The file is untrusted. Nothing is written, no other part is opened, the XML
 * is never handed to a parser that resolves entities, and every size is
 * bounded before it is allocated.
 */

/** A real contract's document.xml is well under this; a decompression bomb is not. */
const MAX_PART_BYTES = 20 * 1024 * 1024;
const MAX_STYLE_DEPTH = 10;

export class DocxReadError extends Error {}

type ZipEntry = {
  readonly method: number;
  readonly compressedSize: number;
  readonly localHeaderOffset: number;
  readonly encrypted: boolean;
};

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_FILE_HEADER = 0x04034b50;

/** Finds the named parts in the archive's central directory. */
function findZipEntries(
  file: Buffer,
  wanted: ReadonlySet<string>
): ReadonlyMap<string, ZipEntry> {
  // The end record is the last 22 bytes plus an optional comment of up to 64KB.
  const earliest = Math.max(0, file.length - 22 - 0xffff);
  let end = -1;
  for (let offset = file.length - 22; offset >= earliest; offset -= 1) {
    if (file.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      end = offset;
      break;
    }
  }
  if (end === -1) throw new DocxReadError("it is not a Word document (no ZIP directory found)");

  const entryCount = file.readUInt16LE(end + 10);
  let offset = file.readUInt32LE(end + 16);
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > file.length || file.readUInt32LE(offset) !== CENTRAL_DIRECTORY_ENTRY) {
      throw new DocxReadError("its ZIP directory is damaged");
    }
    const nameLength = file.readUInt16LE(offset + 28);
    const name = file.toString("utf8", offset + 46, offset + 46 + nameLength);

    if (wanted.has(name)) {
      entries.set(name, {
        encrypted: (file.readUInt16LE(offset + 8) & 1) === 1,
        method: file.readUInt16LE(offset + 10),
        compressedSize: file.readUInt32LE(offset + 20),
        localHeaderOffset: file.readUInt32LE(offset + 42),
      });
    }

    offset += 46 + nameLength + file.readUInt16LE(offset + 30) + file.readUInt16LE(offset + 32);
  }

  return entries;
}

/** Decompresses one part, refusing anything that would expand past the limit. */
function readZipEntry(
  file: Buffer,
  entry: ZipEntry
): string {
  if (entry.encrypted) throw new DocxReadError("it is password-protected");
  if (entry.compressedSize === 0xffffffff || entry.localHeaderOffset === 0xffffffff) {
    throw new DocxReadError("it is too large to read");
  }

  const header = entry.localHeaderOffset;
  if (header + 30 > file.length || file.readUInt32LE(header) !== LOCAL_FILE_HEADER) {
    throw new DocxReadError("its ZIP contents are damaged");
  }
  const start = header + 30 + file.readUInt16LE(header + 26) + file.readUInt16LE(header + 28);
  const data = file.subarray(start, start + entry.compressedSize);
  if (data.length !== entry.compressedSize) throw new DocxReadError("its ZIP contents are damaged");

  if (entry.method === 0) {
    if (data.length > MAX_PART_BYTES) throw new DocxReadError("it is too large to read");
    return data.toString("utf8");
  }
  if (entry.method !== 8) throw new DocxReadError("it uses a compression method Arturo does not read");

  try {
    return inflateRawSync(data, { maxOutputLength: MAX_PART_BYTES }).toString("utf8");
  } catch (error) {
    throw new DocxReadError(
      error instanceof RangeError || (error as NodeJS.ErrnoException).code === "ERR_BUFFER_TOO_LARGE"
        ? "it is too large to read"
        : "its contents could not be decompressed"
    );
  }
}

function decodeXmlText(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]{1,6});/g, (_, hex: string) => codePoint(parseInt(hex, 16)))
    .replace(/&#(\d{1,7});/g, (_, decimal: string) => codePoint(Number(decimal)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function codePoint(value: number): string {
  return value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : "";
}

type Numbering = { readonly numId: string; readonly level: number };
type LevelFormat = { readonly format: string; readonly start: number };

const attribute = (xml: string, name: string): string | undefined =>
  new RegExp(`${name}="([^"]*)"`).exec(xml)?.[1];

/** The numbering a paragraph or style declares, if any. `numId` 0 means "no numbering". */
function readNumbering(xml: string): Numbering | undefined {
  const block = /<w:numPr>([\s\S]*?)<\/w:numPr>/.exec(xml)?.[1];
  if (block === undefined) return undefined;

  const numId = /<w:numId [^>]*w:val="(\d+)"/.exec(block)?.[1];
  if (!numId || numId === "0") return undefined;

  return { numId, level: Number(/<w:ilvl [^>]*w:val="(\d+)"/.exec(block)?.[1] ?? 0) };
}

/** Numbering that comes from a paragraph's style rather than the paragraph itself. */
function readStyleNumbering(stylesXml: string): ReadonlyMap<string, Numbering> {
  const styles = new Map<string, { readonly numbering?: Numbering; readonly basedOn?: string }>();
  for (const match of stylesXml.matchAll(/<w:style [^>]*>[\s\S]*?<\/w:style>/g)) {
    const id = attribute(match[0], "w:styleId");
    if (id) {
      styles.set(id, {
        numbering: readNumbering(match[0]),
        basedOn: /<w:basedOn [^>]*w:val="([^"]+)"/.exec(match[0])?.[1],
      });
    }
  }

  const resolved = new Map<string, Numbering>();
  for (const id of styles.keys()) {
    let current: string | undefined = id;
    for (let depth = 0; current && depth < MAX_STYLE_DEPTH; depth += 1) {
      const style = styles.get(current);
      if (style?.numbering) {
        resolved.set(id, style.numbering);
        break;
      }
      current = style?.basedOn;
    }
  }
  return resolved;
}

/** For each numbering list, the format and starting value of each of its levels. */
function readNumberingFormats(numberingXml: string): ReadonlyMap<string, ReadonlyMap<number, LevelFormat>> {
  const abstract = new Map<string, Map<number, LevelFormat>>();
  for (const match of numberingXml.matchAll(/<w:abstractNum [^>]*>[\s\S]*?<\/w:abstractNum>/g)) {
    const id = attribute(match[0], "w:abstractNumId");
    if (!id) continue;

    const levels = new Map<number, LevelFormat>();
    for (const level of match[0].matchAll(/<w:lvl [^>]*>[\s\S]*?<\/w:lvl>/g)) {
      levels.set(Number(attribute(level[0], "w:ilvl") ?? 0), {
        format: /<w:numFmt [^>]*w:val="([^"]+)"/.exec(level[0])?.[1] ?? "decimal",
        start: Number(/<w:start [^>]*w:val="(\d+)"/.exec(level[0])?.[1] ?? 1),
      });
    }
    abstract.set(id, levels);
  }

  const formats = new Map<string, ReadonlyMap<number, LevelFormat>>();
  for (const match of numberingXml.matchAll(/<w:num [^>]*>[\s\S]*?<\/w:num>/g)) {
    const numId = attribute(match[0], "w:numId");
    const abstractId = /<w:abstractNumId [^>]*w:val="(\d+)"/.exec(match[0])?.[1];
    if (numId && abstractId) formats.set(numId, abstract.get(abstractId) ?? new Map());
  }
  return formats;
}

function toLetters(value: number): string {
  let letters = "";
  for (let rest = value; rest > 0; rest = Math.floor((rest - 1) / 26)) {
    letters = String.fromCharCode(97 + ((rest - 1) % 26)) + letters;
  }
  return letters;
}

function toRoman(value: number): string {
  const numerals: readonly (readonly [number, string])[] = [
    [1000, "m"], [900, "cm"], [500, "d"], [400, "cd"], [100, "c"], [90, "xc"],
    [50, "l"], [40, "xl"], [10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"],
  ];
  let rest = value;
  let roman = "";
  for (const [size, numeral] of numerals) {
    while (rest >= size) {
      roman += numeral;
      rest -= size;
    }
  }
  return roman;
}

/** Counts paragraphs through each list, as Word does when it draws the numbers. */
function createNumberer(
  formats: ReadonlyMap<string, ReadonlyMap<number, LevelFormat>>
): (numbering: Numbering) => string {
  const counters = new Map<string, number[]>();

  return ({ numId, level }) => {
    const levels = formats.get(numId);
    const counts = counters.get(numId) ?? [];
    counters.set(numId, counts);

    counts[level] = (counts[level] ?? (levels?.get(level)?.start ?? 1) - 1) + 1;
    counts.length = level + 1;

    const format = levels?.get(level)?.format ?? "decimal";
    const value = counts[level];
    if (format === "bullet" || format === "none") return "-";
    if (format === "lowerLetter") return `(${toLetters(value)})`;
    if (format === "upperLetter") return `(${toLetters(value).toUpperCase()})`;
    if (format === "lowerRoman") return `(${toRoman(value)})`;
    if (format === "upperRoman") return `(${toRoman(value).toUpperCase()})`;

    // "4." at the top level, "4.2" beneath it, the way a contract is cited.
    return level === 0
      ? `${value}.`
      : counts.slice(0, level + 1).map((count) => count ?? 1).join(".");
  };
}

/** The visible text of one paragraph: runs, tabs and line breaks, without deleted text. */
function readParagraphText(paragraphXml: string): string {
  const withoutDeletions = paragraphXml.replace(/<w:del [^>]*>[\s\S]*?<\/w:del>/g, "");
  let text = "";
  for (const token of withoutDeletions.matchAll(/<w:t(?: [^>]*)?>([\s\S]*?)<\/w:t>|<w:tab(?: [^>]*)?\/>|<w:(?:br|cr)(?: [^>]*)?\/>/g)) {
    if (token[1] !== undefined) text += decodeXmlText(token[1]);
    else text += token[0].startsWith("<w:tab") ? "\t" : "\n";
  }
  return text.trim();
}

/**
 * Extracts a Word document's text, with Word's automatic numbering written out.
 *
 * Paragraphs are separated by a blank line, except a numbered sub-paragraph,
 * which stays with the clause above it. Tracked insertions are included and
 * tracked deletions left out, so the text is the document as it would read
 * with every change accepted. Headers, footers, footnotes, comments and text
 * boxes are not read.
 *
 * Throws `DocxReadError`, worded to complete "could not be read because …".
 *
 * PURE: No side effects.
 */
export function extractDocxText(file: Buffer): string {
  if (file.length < 22) throw new DocxReadError("it is not a Word document (no ZIP directory found)");

  const entries = findZipEntries(
    file,
    new Set(["word/document.xml", "word/numbering.xml", "word/styles.xml"])
  );
  const documentEntry = entries.get("word/document.xml");
  if (!documentEntry) throw new DocxReadError("it is not a Word document (it has no document part)");

  const part = (name: string): string => {
    const entry = entries.get(name);
    return entry ? readZipEntry(file, entry) : "";
  };
  const styleNumbering = readStyleNumbering(part("word/styles.xml"));
  const numberOf = createNumberer(readNumberingFormats(part("word/numbering.xml")));

  let text = "";
  for (const match of readZipEntry(file, documentEntry).matchAll(/<w:p(?: [^>]*)?>[\s\S]*?<\/w:p>/g)) {
    const body = readParagraphText(match[0]);
    if (!body) continue;

    const style = /<w:pStyle [^>]*w:val="([^"]+)"/.exec(match[0])?.[1];
    // A paragraph can switch its style's numbering off with numId 0.
    const numbering = /<w:numPr>/.test(match[0])
      ? readNumbering(match[0])
      : style
        ? styleNumbering.get(style)
        : undefined;

    const line = numbering ? `${numberOf(numbering)} ${body}` : body;
    const separator = text === "" ? "" : numbering && numbering.level > 0 ? "\n   " : "\n\n";
    text += separator + line;
  }

  return text;
}
