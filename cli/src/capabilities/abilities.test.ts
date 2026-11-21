import { describe, expect, it } from "vitest";
import { archetypeRegistry } from "../agents/archetypeRegistry";
import {
  ABILITIES,
  abilitiesOf,
  ARCHETYPES,
  archetypesWithAbility,
  describeArchetype,
  describeMissingAbility,
  findMissingAbility,
  inferTaskAbilities,
  INTERNAL_CAPABILITIES,
  outsideReachPhrases,
  PAGE_ARCHETYPES,
  pageAbilityLabels,
} from "./abilities";
import { CORE_CAPABILITIES, requiresDefaultJobApproval } from "./capabilityCatalog";

describe("the abilities table", () => {
  it("places every capability in the catalogue in exactly one ability, or marks it internal", () => {
    for (const capability of CORE_CAPABILITIES) {
      const homes = ABILITIES.filter((ability) => (ability.capabilities as readonly string[]).includes(capability));
      const internal = INTERNAL_CAPABILITIES.includes(capability);
      expect(homes.length + (internal ? 1 : 0), capability).toBe(1);
    }
    for (const ability of ABILITIES) for (const capability of ability.capabilities) expect(CORE_CAPABILITIES, `${ability.id}: ${capability}`).toContain(capability);
  });

  it("gives every archetype only capabilities the catalogue knows", () => {
    for (const archetype of ARCHETYPES) {
      for (const capability of archetypeRegistry[archetype].capabilities) expect(CORE_CAPABILITIES, `${archetype}: ${capability}`).toContain(capability);
      expect(archetypeRegistry[archetype].summary.length, archetype).toBeGreaterThan(10);
    }
  });

  it("works out whether an ability waits for a go-ahead from the catalogue, never on its own", () => {
    for (const archetype of ARCHETYPES) {
      const capabilities = archetypeRegistry[archetype].capabilities;
      for (const { ability, needsGoAhead } of abilitiesOf(capabilities)) {
        const held = ability.capabilities.filter((capability) => capabilities.includes(capability));
        expect(needsGoAhead, `${archetype}: ${ability.id}`).toBe(held.some((capability) => requiresDefaultJobApproval(capability)));
      }
    }
    expect(pageAbilityLabels()["human-contact"]).toMatchObject({ id: "ask-for-review", outside: true, goAhead: true });
    expect(pageAbilityLabels().writing).toMatchObject({ id: "write", outside: false, goAhead: false });
    expect(pageAbilityLabels().llm).toBeUndefined();
  });

  it("says no archetype can send email or change other software, and only a researcher searches the web", () => {
    expect(archetypesWithAbility("send-email")).toEqual([]);
    expect(archetypesWithAbility("other-software")).toEqual([]);
    expect(archetypesWithAbility("arturo-records")).toEqual([]);
    expect(archetypesWithAbility("web-search")).toEqual(["researcher"]);
    expect(archetypesWithAbility("office-write")).toEqual(["operator"]);
  });

  it("lets the company page make every archetype but the operator, which needs Office or tools set up", () => {
    expect(PAGE_ARCHETYPES).not.toContain("operator");
    expect(PAGE_ARCHETYPES).toEqual(expect.arrayContaining(["reviewer", "creator", "analyst", "assistant", "researcher", "converter", "advisor", "planner"]));
  });

  it("describes an archetype in plain words, without saying a worker that can email people works only inside Arturo", () => {
    const reviewer = describeArchetype("reviewer");
    expect(reviewer).toMatchObject({ label: "Reviewer", can: ["Write and check"], asksFirst: ["Ask a person here for a review"] });
    expect(reviewer.cannot).toBe("It cannot search the web, change any records (yours, Office's or other software's), send email or use tools on this computer.");
    expect(describeArchetype("researcher").can).toEqual(["Write and check", "Search the web"]);
    expect(describeArchetype("converter").asksFirst).toEqual([]);
    expect(describeArchetype("operator").notes.join(" ")).toContain("saved as soon as its task runs");
    expect(outsideReachPhrases(archetypeRegistry.reviewer.capabilities)).toEqual(["have Arturo email a person registered here to ask for a review"]);
    expect(outsideReachPhrases(archetypeRegistry.converter.capabilities)).toEqual([]);
  });
});

describe("what a task asks for", () => {
  const ids = (text: string) => inferTaskAbilities(text).map((needed) => needed.id);

  it("finds a new client, an email to send, other software to change and a reminder to set", () => {
    expect(ids("I need a new client added: Joe Bloggs ABC Street 555-6789")).toEqual(["arturo-records"]);
    expect(ids("Send the proofs to Dana")).toEqual(["send-email"]);
    expect(ids("Email Bluebell Primary the invoice")).toEqual(["send-email"]);
    expect(ids("Can you forward this to the landlord's agent?")).toEqual(["send-email"]);
    expect(ids("Remind me Friday to chase Dana's sketches")).toEqual(["reminders"]);
    expect(inferTaskAbilities("Add Priya to the Google Sheet with her email")).toEqual([{ id: "other-software", detail: "Google Sheet" }]);
    expect(ids("Book Joe in my calendar for Tuesday at 10")).toEqual(["other-software"]);
  });

  it("leaves writing as writing, even about an email or a reminder", () => {
    for (const text of [
      "Draft an email to Dana about the proofs",
      "Write a letter to send to the landlord",
      "Email me a summary of the lease",
      "Send me the key dates in this lease",
      "Draft a reminder letter for clients who owe us money",
      "Review the lease for one-sided clauses",
      "Summarise the spreadsheet I attached",
      "",
    ]) expect(ids(text), text).toEqual([]);
  });

  it("is missing when no worker who could take the task has it, and never for writing", () => {
    expect(findMissingAbility([{ id: "send-email" }])).toEqual({ id: "send-email" });
    expect(findMissingAbility([{ id: "send-email" }], [["llm", "email-send"]])).toBeUndefined();
    expect(findMissingAbility([{ id: "web-search" }], [["llm", "writing"]])).toEqual({ id: "web-search" });
    expect(findMissingAbility([{ id: "web-search" }])).toBeUndefined();
    expect(findMissingAbility([{ id: "write" }], [["llm", "writing"]])).toBeUndefined();
    // People only, whatever a worker holds.
    expect(findMissingAbility([{ id: "arturo-records" }], [CORE_CAPABILITIES])).toEqual({ id: "arturo-records" });
  });

  it("says why in plain words, and that nothing was started", () => {
    expect(describeMissingAbility({ id: "send-email" })).toBe("This needs an email sent, and no worker can send email yet. Nothing was started.");
    expect(describeMissingAbility({ id: "other-software", detail: "Google Sheet" })).toBe("This needs something changed in your Google Sheet, and Arturo is not connected to it, so no worker can. Nothing was started.");
    expect(describeMissingAbility({ id: "arturo-records" }, { singular: "author", plural: "authors" })).toContain("AI workers cannot add authors");
    expect(describeMissingAbility({ id: "reminders" })).toContain("Nothing was started.");
  });
});
