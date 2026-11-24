import { afterEach, describe, expect, it } from "vitest";

import {
  SOMETHING_ELSE_TYPE,
  clearWorkTypePicks,
  formatWorkTypeGoAhead,
  formatWorkTypeMenu,
  isPickedTypeLocked,
  lastWorkTypePick,
  rememberWorkTypePick,
  wordCheckLock,
} from "./workTypePick";

function flat(text: string): string {
  return text.replace(/\s+/g, " ");
}

afterEach(() => clearWorkTypePicks());

describe("the work-type pick", () => {
  it("shows locked types, not hidden, with the lock note on its own line, and Something else as locked", () => {
    const menu = formatWorkTypeMenu({});
    expect(menu.body).toContain("What kind of work is this?");
    expect(menu.body).toContain("Commercial contracts");
    expect(menu.body).toContain("Employment (non-contentious)");
    expect(menu.body).toContain("Property and conveyancing");
    expect(menu.body).toContain("General advice");
    expect(menu.body).toContain("Will");
    expect(menu.body).toContain("(locked: a person");
    expect(menu.body).toContain("Something else");
    expect(menu.options.some((option) => option.id === SOMETHING_ELSE_TYPE && option.locked)).toBe(true);
  });

  it("pre-selects nothing, and remembers this person's last pick as option 1", () => {
    const first = formatWorkTypeMenu({ functionId: "fn-1", person: "Kevin" });
    expect(first.body).not.toContain("Same as last time");
    rememberWorkTypePick("fn-1", "Kevin", "commercial");
    expect(lastWorkTypePick("fn-1", "Kevin")).toBe("commercial");
    const again = formatWorkTypeMenu({ functionId: "fn-1", person: "Kevin" });
    expect(flat(again.body)).toContain("Same as last time: Commercial contracts");
    expect(again.options[0]?.id).toBe("commercial");
  });

  it("explains a word-check lock once, and a word check may add a lock but never removes one", () => {
    const check = wordCheckLock("Please draft a will for this client.");
    expect(check).toMatchObject({ type: "will", word: "will" });
    const menu = formatWorkTypeMenu({ description: "Please draft a will for this client." });
    expect(flat(menu.body)).toContain('Locked because it mentions "will". A person does it.');
    expect(isPickedTypeLocked("commercial", [], "Please draft a will for this client.")).toBe(true);
    expect(isPickedTypeLocked("will", [], "A letter to a supplier.")).toBe(true);
  });

  it("repeats the type and who picked it on the go-ahead screen", () => {
    expect(formatWorkTypeGoAhead("Report or summary", "Kevin")).toBe(
      "Work type: Report or summary. Picked by Kevin."
    );
    expect(formatWorkTypeGoAhead("Commercial contracts", "Amy Wise")).toBe(
      "Work type: Commercial contracts. Picked by Amy Wise."
    );
  });

  it("puts further types under More types when there are more than seven plus Something else", () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      id: `extra-${index + 1}`,
      label: `Extra type ${index + 1}`,
      locked: true,
    }));
    const menu = formatWorkTypeMenu({ custom: many });
    expect(menu.options.some((option) => option.id === "__more__")).toBe(true);
    expect(menu.body).toContain("More types");
    expect(menu.more.length).toBeGreaterThan(0);
  });
});
