import { describe, expect, it } from "vitest";
import {
  describeLinksNotSupplied,
  findLinks,
  findLinksNotSupplied,
  findUnsupportedMethodClaim,
  normaliseLink,
} from "./outputProvenance";

const MATERIAL = [
  "document:",
  "https://www.vogue.co.uk/article/spring-summer-2026-fashion-trends",
  "",
  "The Key Spring/Summer 2026 Trends To Shop Now",
  "The street-style set have been fervid champions of the scarf dressing movement on social media.",
].join("\n");

describe("links a result cites", () => {
  it("treats two spellings of one address as the same link", () => {
    expect(normaliseLink("https://www.Vogue.co.uk/article/trends/).")).toBe("vogue.co.uk/article/trends");
    expect(normaliseLink("http://vogue.co.uk/article/trends#street")).toBe("vogue.co.uk/article/trends");
    expect(findLinks("See [the piece](https://www.vogue.co.uk/a) and www.vogue.co.uk/a.")).toEqual(["vogue.co.uk/a"]);
  });

  it("passes a link that was in the supplied material", () => {
    const output = "Pyjama pants are trending ([Vogue](https://www.vogue.co.uk/article/spring-summer-2026-fashion-trends)).";

    expect(findLinksNotSupplied(output, MATERIAL)).toEqual([]);
    expect(describeLinksNotSupplied([])).toBeUndefined();
  });

  it("finds the links a real Worker invented from one supplied article", () => {
    const output = [
      "### Sources",
      "–  [COS Satin Wide-Leg Trousers](https://www.cos.com/en-us/c/satin-wide-leg-trousers)",
      "–  [Chanel Matthieu Blazy's Collection](https://www.chANEL.com/en-US/collections/spring-2026)",
      "–  [Agolde Website](https://agolde.com)",
    ].join("\n");

    expect(findLinksNotSupplied(output, MATERIAL)).toEqual([
      "cos.com/en-us/c/satin-wide-leg-trousers",
      "chanel.com/en-us/collections/spring-2026",
      "agolde.com",
    ]);
  });

  it("does not accept another page on a site that was supplied", () => {
    expect(
      findLinksNotSupplied("https://www.vogue.co.uk/article/autumn-2026", MATERIAL)
    ).toEqual(["vogue.co.uk/article/autumn-2026"]);
  });

  it("lets a draft mark a gap with an address reserved for examples", () => {
    expect(findLinksNotSupplied("Book at https://www.example.com/booking or https://example.org.", MATERIAL)).toEqual([]);
    expect(findLinksNotSupplied("https://example.com.evil.io/x", MATERIAL)).toEqual(["example.com.evil.io/x"]);
  });

  it("names the invented links, and counts the rest when there are many", () => {
    expect(describeLinksNotSupplied(["agolde.com"])).toBe(
      "Worker cited a link that was not in the material it was given: agolde.com. A source link must be one that was supplied."
    );
    expect(describeLinksNotSupplied(["a.com", "b.com", "c.com", "d.com", "e.com", "f.com", "g.com"])).toContain(
      "7 links that were not in the material it was given: a.com, b.com, c.com, d.com, e.com and 2 more."
    );
  });
});

describe("a result's account of how it was produced", () => {
  it("finds the methodology a real Worker wrote after reading one file", () => {
    const output = [
      "## Soft Utility and Luxury",
      "Loose silhouettes.",
      "",
      "## Methodology",
      "The method to identify current public evidence of fashion trends involved:",
      "1. Reviewing recent fashion collections from major designers.",
      "2. Analyzing press releases, fashion week reports, and online marketplaces.",
      "3. Gathering information from official websites and social media channels.",
    ].join("\n");

    expect(findUnsupportedMethodClaim(output)).toBe("Analyzing press releases, fashion week reports, and online marketplaces");
  });

  it("finds a method stated in a sentence, with no heading", () => {
    expect(
      findUnsupportedMethodClaim("This summary was based on a review of industry reports and social media.")
    ).toContain("was based on");
  });

  it("leaves alone prose that only mentions such sources because the material does", () => {
    expect(
      findUnsupportedMethodClaim("The article says the street-style set championed scarf dressing on social media. Designers reviewed their archives.")
    ).toBeUndefined();
  });

  it("leaves alone a method section that describes reading what was supplied", () => {
    expect(
      findUnsupportedMethodClaim("## Method\nI read the supplied document and listed each trend it names.\n\n## Trends\nBrands are monitoring social media.")
    ).toBeUndefined();
  });
});
