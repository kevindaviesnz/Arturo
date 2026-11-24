import { describe, expect, it } from "vitest";
import {
  FIXED_LOCKED_WORK_TYPES,
  isKnownMatterType,
  isLockedMatterType,
  LAW_PRACTICE_MATTER_ONLY,
  MAX_WORK_DEPTH,
  precedentsForMatterType,
  refuseParentChain,
  refuseWorkRecord,
  signWorkRecord,
  UNLOCKED_WORK_TYPES,
  WORK_TYPE_LABELS,
  verifyWorkRecordSignature,
  type UnsignedWorkRecord,
  type WorkRecord,
  type WorkRecordContext,
  type WorkRefusal,
  type WorkStanding,
  workRefusalText,
} from "./workRecord";

/** The terminal's words for a refusal, as /work create prints them. */
const say = (refusal: WorkRefusal | undefined) => (refusal ? workRefusalText(refusal, "terminal") : undefined);

const SECRET = "test-secret-for-work-records-0000";
const record = (over: Partial<UnsignedWorkRecord> = {}): WorkRecord => {
  const unsigned: UnsignedWorkRecord = {
    id: "work-a", enterpriseId: "ent-1", name: "Matter A", kind: "matter", noAi: false, paidEscalationAllowed: false,
    version: 1, createdAt: 1000, createdBy: "Amy Wise", ...over,
  };
  return { ...unsigned, signature: signWorkRecord(unsigned, SECRET) };
};
const lookupOf = (records: readonly WorkRecord[], unverified: readonly string[] = []) => (id: string): WorkStanding => {
  if (unverified.includes(id)) return { state: "unverified", id };
  const found = records.find((one) => one.id === id);
  return found ? { state: "verified", work: found } : { state: "missing", id };
};
const context = (over: Partial<WorkRecordContext> = {}): WorkRecordContext => ({
  lookup: lookupOf([]), lawPractice: false, customMatterTypes: [], clientBusiness: () => undefined, matterNumbers: [], ...over,
});

describe("work records", () => {
  it("refuses a deal with no parent, a parent that isn't a book, and a non-deal with a parent", () => {
    const matter = record({ id: "work-m", kind: "matter" });
    const book = record({ id: "work-b", kind: "book", name: "Mole's Big Day" });
    const ctx = context({ lookup: lookupOf([matter, book]) });
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "German rights", kind: "deal" }, ctx))).toContain("A deal belongs to a book");
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "German rights", kind: "deal", parentWorkId: "work-m" }, ctx))).toContain("must be a book");
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Another", kind: "book", parentWorkId: "work-b" }, ctx))).toContain("Only a deal");
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "German rights", kind: "deal", parentWorkId: "work-b" }, ctx))).toBeUndefined();
  });

  it("refuses a cycle (A→B→A) and a chain deeper than MAX_WORK_DEPTH", () => {
    expect(MAX_WORK_DEPTH).toBe(2);
    // Only injected data can make these: the record rules never let a book have a parent.
    const a = record({ id: "work-a", kind: "book", parentWorkId: "work-b" });
    const b = record({ id: "work-b", kind: "book", parentWorkId: "work-a" });
    expect(say(refuseParentChain("work-a", "ent-1", lookupOf([a, b])))).toMatch(/belong to itself|nested at most/);
    const top = record({ id: "work-top", kind: "book" });
    const middle = record({ id: "work-mid", kind: "book", parentWorkId: "work-top" });
    expect(say(refuseParentChain("work-mid", "ent-1", lookupOf([top, middle])))).toContain(`nested at most ${MAX_WORK_DEPTH}`);
  });

  it("refuses a parent in another business and a missing parent", () => {
    const elsewhere = record({ id: "work-x", kind: "book", enterpriseId: "ent-2" });
    const ctx = context({ lookup: lookupOf([elsewhere], ["work-bad"]) });
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Deal", kind: "deal", parentWorkId: "work-x" }, ctx))).toContain("at this business");
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Deal", kind: "deal", parentWorkId: "work-none" }, ctx))).toContain("There is no work called work-none");
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Deal", kind: "deal", parentWorkId: "work-bad" }, ctx))).toContain("does not verify");
  });

  it("refuses a law-practice matter with no number, a bad number, a duplicate number or no type", () => {
    const ctx = context({ lawPractice: true, matterNumbers: [{ number: "HL-1", id: "work-hl1", name: "Smith lease", cancelled: false, createdAt: 1 }] });
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Lease", kind: "matter", matterType: "property" }, ctx))).toBe(LAW_PRACTICE_MATTER_ONLY);
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Lease", kind: "matter", matterNumber: "-bad", matterType: "property" }, ctx))).toContain("A matter number is");
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Lease", kind: "matter", matterNumber: "hl-1", matterType: "property" }, ctx))).toContain("already used");
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Lease", kind: "matter", matterNumber: "HL-2" }, ctx))).toBe(LAW_PRACTICE_MATTER_ONLY);
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Lease", kind: "matter", matterNumber: "HL-2", matterType: "other" }, ctx))).toContain("Choose one of this business's work types");
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Lease", kind: "matter", matterNumber: "HL-2", matterType: "property" }, ctx))).toBeUndefined();
  });

  it("on a law-practice account, refuses anything but a matter with a number and a type, in Amy's words", () => {
    expect(LAW_PRACTICE_MATTER_ONLY).toBe("On a law-practice account, open a matter with a number and type first.");
    const book = record({ id: "work-b", kind: "book" });
    const ctx = context({ lawPractice: true, lookup: lookupOf([book]) });
    for (const kind of ["work", "book", "deal"]) {
      expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Office admin", kind, ...(kind === "deal" ? { parentWorkId: "work-b" } : {}) }, ctx)), kind).toBe(LAW_PRACTICE_MATTER_ONLY);
    }
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Lease", kind: "matter", matterNumber: "  ", matterType: "property" }, ctx))).toBe(LAW_PRACTICE_MATTER_ONLY);
    // Not a law practice: other kinds still open.
    expect(say(refuseWorkRecord({ enterpriseId: "ent-1", name: "Office admin", kind: "work" }, context()))).toBeUndefined();
  });

  it("signature covers kind, parent, client, matter number, type, noAi and version", () => {
    const signed = record({ kind: "deal", parentWorkId: "work-b", clientId: "client-1", matterNumber: "HL-1", matterType: "commercial" });
    expect(verifyWorkRecordSignature(signed, SECRET)).toBe(true);
    for (const change of [
      { kind: "book" }, { parentWorkId: "work-c" }, { clientId: "client-2" }, { matterNumber: "HL-9" },
      { matterType: "will" }, { noAi: true }, { version: 2 }, { enterpriseId: "ent-2" }, { paidEscalationAllowed: true },
    ] as Partial<WorkRecord>[]) {
      expect(verifyWorkRecordSignature({ ...signed, ...change } as WorkRecord, SECRET), JSON.stringify(change)).toBe(false);
    }
    expect(verifyWorkRecordSignature(signed, "another-secret-entirely-000000000")).toBe(false);
  });

  it("locks the fixed types, leaves the built-in unlocked types open including general, locks any other or unknown type, and lists precedents", () => {
    for (const type of FIXED_LOCKED_WORK_TYPES) expect(isLockedMatterType(type, [{ id: type, label: type, locked: false }])).toBe(true);
    for (const type of UNLOCKED_WORK_TYPES) expect(isLockedMatterType(type)).toBe(false);
    expect(UNLOCKED_WORK_TYPES).toContain("general");
    expect(WORK_TYPE_LABELS.general).toBe("General work");
    expect(isLockedMatterType("general")).toBe(false);
    expect(isLockedMatterType("other")).toBe(true);
    expect(isKnownMatterType("other")).toBe(false);
    expect(isLockedMatterType("trusts")).toBe(true);
    expect(isLockedMatterType("trusts", [{ id: "trusts", label: "Trusts", locked: false }])).toBe(false);
    expect(precedentsForMatterType("commercial")).toContain("mutual-nda");
    expect(precedentsForMatterType("property")).toEqual([]);
    expect(precedentsForMatterType("general")).toEqual([]);
  });
});
