/**
 * Telling when two business functions are the same kind of work in other
 * words: "Lease reviews", "Lease review" and "Reviewing leases".
 *
 * Arturo now offers to set up a business function whenever a task fits none,
 * so without this a business would collect one per wording of the same work,
 * each with its own instructions, and nobody would know which a piece of work
 * ran under. These rules are fixed (no model), small, and English only:
 *
 *   - the same words: the same set of word stems, in any order. A function
 *     with the same words as one the business has is refused, at the
 *     terminal and on the page alike (createEnterpriseFunction);
 *   - a very similar name: two or fewer letters different;
 *   - a similar name: every word of one is in the other.
 *
 * The last two only ever lead to a question ("Use Lease reviews instead?"),
 * never a refusal, because "Accounts" and "Customer accounts" may be
 * different work.
 *
 * PURE: No side effects.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "for", "to", "in", "on", "with", "from", "by", "at", "as", "into", "about",
  "our", "my", "your", "their", "his", "her", "its", "this", "that", "these", "those",
  "is", "are", "be", "it", "me", "us", "we", "i", "you", "he", "she", "they",
  "please", "can", "could", "would", "will", "need", "needs", "want", "wants", "new", "all", "any", "some",
]);

/**
 * A word cut back to its stem, well enough for names of work: "reviews",
 * "reviewing", "reviewed" and "reviewer" all become "review"; "lease",
 * "leases" and "leasing" become "leas".
 */
export function stemWord(word: string): string {
  let w = word.toLowerCase().replace(/['’]s$/, "").replace(/['’]/g, "");
  if (w.length > 4 && w.endsWith("ies")) w = `${w.slice(0, -3)}y`;
  else if (w.length > 3 && w.endsWith("s") && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
  const before = w;
  if (w.length > 5 && w.endsWith("ing")) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith("ed")) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith("er")) w = w.slice(0, -2);
  // "planning" -> "plann" -> "plan", as "plan" itself.
  if (w !== before && /([b-df-hj-np-tv-z])\1$/.test(w) && !/(?:ll|ss|zz)$/.test(w)) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("e")) w = w.slice(0, -1);
  return w;
}

/** The stems of the words that say what the work is, without little words. */
export function nameStems(text: string): string[] {
  const words = (text.toLowerCase().match(/[\p{L}\p{N}'’]+/gu) ?? [])
    .map((word) => word.replace(/['’]s$/, ""))
    .filter((word) => word && !STOP_WORDS.has(word));
  return [...new Set(words.map(stemWord).filter((stem) => stem.length > 1))];
}

/** True when both names are the same words, in any order and any form. */
export function sameFunctionWords(a: string, b: string): boolean {
  const left = nameStems(a), right = nameStems(b);
  return left.length > 0 && left.length === right.length && left.every((stem) => right.includes(stem));
}

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let previous = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
      previous = current;
    }
  }
  return row[b.length];
}

export type FunctionLookalike<T> = {
  readonly definition: T;
  readonly because: "the same words" | "a very similar name" | "a similar name";
};

/**
 * The business functions whose names look like this one, closest first.
 */
export function findFunctionLookalikes<T extends { readonly label: string }>(label: string, existing: readonly T[]): FunctionLookalike<T>[] {
  const stems = nameStems(label);
  const joined = label.toLowerCase().replace(/\s+/g, " ").trim();
  if (!stems.length || !joined) return [];
  const found: FunctionLookalike<T>[] = [];
  for (const definition of existing) {
    const theirs = nameStems(definition.label);
    const theirsJoined = definition.label.toLowerCase().replace(/\s+/g, " ").trim();
    if (!theirs.length) continue;
    if (sameFunctionWords(label, definition.label)) {
      found.push({ definition, because: "the same words" });
    } else if (Math.max(joined.length, theirsJoined.length) >= 6 && editDistance(joined, theirsJoined) <= 2) {
      found.push({ definition, because: "a very similar name" });
    } else {
      const [shorter, longer] = stems.length <= theirs.length ? [stems, theirs] : [theirs, stems];
      if (shorter.every((stem) => stem.length >= 3 && longer.includes(stem))) found.push({ definition, because: "a similar name" });
    }
  }
  const order = { "the same words": 0, "a very similar name": 1, "a similar name": 2 } as const;
  return found.sort((a, b) => order[a.because] - order[b.because]);
}

/**
 * The stems a task and a business function's name share, for offering an
 * existing function before setting up a new one. Short stems ("go", "do")
 * say nothing about the work and are left out.
 */
export function sharedWorkStems(instruction: string, label: string): string[] {
  const theirs = new Set(nameStems(label));
  return nameStems(instruction).filter((stem) => stem.length >= 4 && theirs.has(stem));
}
