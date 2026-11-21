/**
 * Checks that what a Worker presents as its sources and its method is true of
 * the material it was actually given.
 *
 * A Worker handed one article, containing one link, returned a summary citing
 * fifteen: retailer pages, brand sites, one on a domain spelled "chANEL.com".
 * It closed with a methodology saying it had reviewed press releases and social
 * media. None of it existed, and the existing integrity check caught none of
 * it: that check looks for "I searched the web" and for author-year citations,
 * and this was neither.
 *
 * Which links a Worker was given is known exactly, so whether a cited link is
 * real is decidable rather than a matter of the model obeying its prompt.
 */

const LINK = /\b(?:https?:\/\/|www\.)[^\s<>"'`\])}]+/gi;

/**
 * Reduces a link to the form two spellings of the same address share.
 *
 * Case is ignored throughout: a Worker that changes the case of a path has
 * still cited the page it was given, and one that invents a page is not saved
 * by matching case.
 *
 * PURE: No side effects.
 */
export function normaliseLink(link: string): string {
  return link
    .trim()
    .replace(/[.,;:!?)\]}'"*_]+$/, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/#.*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();
}

/**
 * PURE: No side effects.
 */
export function findLinks(text: string): string[] {
  return [...new Set((text.match(LINK) ?? []).map(normaliseLink))].filter(
    (link) => link.length > 0
  );
}

/**
 * Addresses reserved for illustration. A draft that writes "example.com" where
 * a real address will go is marking a gap, not citing a source.
 */
const PLACEHOLDER_LINK = /^(?:[a-z0-9-]+\.)*example\.(?:com|org|net)(?:[/?]|$)/;

/**
 * The links a result cites that appear nowhere in what the Worker was given.
 *
 * A link counts as given only if that exact address was in the material. A
 * deeper page on a supplied site is still a page nobody supplied.
 *
 * PURE: No side effects.
 */
export function findLinksNotSupplied(
  output: string,
  material: string
): string[] {
  const supplied = new Set(findLinks(material));
  return findLinks(output).filter(
    (link) => !supplied.has(link) && !PLACEHOLDER_LINK.test(link)
  );
}

/** How many invented links a message names before it gives a count instead. */
const MAX_LINKS_NAMED = 5;

/**
 * PURE: No side effects.
 */
export function describeLinksNotSupplied(
  links: readonly string[]
): string | undefined {
  if (links.length === 0) return undefined;
  const named = links.slice(0, MAX_LINKS_NAMED).join(", ");
  const more =
    links.length > MAX_LINKS_NAMED
      ? ` and ${links.length - MAX_LINKS_NAMED} more`
      : "";
  return `Worker cited ${links.length === 1 ? "a link" : `${links.length} links`} that ${links.length === 1 ? "was" : "were"} not in the material it was given: ${named}${more}. A source link must be one that was supplied.`;
}

const RESEARCH_VERB =
  "(?:review(?:ed|ing)|analy[sz](?:ed|ing)|gather(?:ed|ing)|collect(?:ed|ing)|consult(?:ed|ing)|search(?:ed|ing)|brows(?:ed|ing)|monitor(?:ed|ing)|scrap(?:ed|ing)|survey(?:ed|ing)|interview(?:ed|ing))";

const OUTSIDE_SOURCE =
  "(?:press releases?|social media|official websites?|online (?:sources|marketplaces|databases|platforms|retailers)|the (?:web|internet)|news (?:articles|reports|outlets)|fashion week reports?|industry reports?|market (?:data|reports?)|databases?|forums?|interviews?)";

const METHOD_HEADING =
  /^[\s>#*_-]*(?:research\s+)?(?:methodology|methods?|approach|sources\s+consulted|how\s+this\s+was\s+(?:researched|produced))\b[^\n]*$/im;

const METHOD_SENTENCE = new RegExp(
  `\\b(?:the|this|our|my)\\s+(?:method(?:ology)?|approach|research|analysis|summary|report|review)\\b[^.\\n]{0,60}\\b(?:involved|included|consisted of|was based on|is based on|drew on|draws on)\\b[^.\\n]{0,120}\\b${OUTSIDE_SOURCE}`,
  "i"
);

const METHOD_STEP = new RegExp(
  `\\b${RESEARCH_VERB}\\b[^.\\n]{0,80}\\b${OUTSIDE_SOURCE}`,
  "i"
);

/**
 * Finds a statement of method that describes research nothing in this
 * execution could have done.
 *
 * Only a result's account of *how it was produced* is examined: a section
 * headed as its method, or a sentence saying what its method involved. Prose
 * that merely mentions social media or press releases — because that is what
 * the supplied material is about — is left alone.
 *
 * PURE: No side effects.
 */
export function findUnsupportedMethodClaim(
  output: string
): string | undefined {
  const sentence = METHOD_SENTENCE.exec(output);
  if (sentence) {
    return sentence[0].trim();
  }

  const heading = METHOD_HEADING.exec(output);
  if (!heading) {
    return undefined;
  }
  const afterHeading = output.slice(heading.index + heading[0].length);
  const nextHeading = /^\s*#{1,6}\s+\S/m.exec(afterHeading);
  const section = nextHeading
    ? afterHeading.slice(0, nextHeading.index)
    : afterHeading;
  return METHOD_STEP.exec(section)?.[0].trim();
}
