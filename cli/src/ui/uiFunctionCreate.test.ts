import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  handleUiFunctionCreateSubcommand,
} from "./uiCommandHandlers";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  clearBusinessFunctionDefinitions,
  listBusinessFunctionDefinitions,
} from "../business/businessFunctionDefinitionStore";

beforeEach(() => {
  clearEnterprises();
  clearBusinessFunctionDefinitions();
});

describe("handleUiFunctionCreateSubcommand", () => {
  it("leaves description unset (not defaulted to objective) when omitted", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Ethical Toys",
        mission: "Provide ethical toys.",
      });

    const entries =
      handleUiFunctionCreateSubcommand([
        "Product Safety",
        "--enterprise",
        enterprise.id,
        "--objective",
        "Keep products safe.",
      ]);

    expect(entries[0].label).toBe("Function created");
    // Read off the stored record. The created block no longer prints the
    // fields, but defaulting description to objective would still be wrong.
    const [definition] = listBusinessFunctionDefinitions();
    expect(definition.objective).toBe("Keep products safe.");
    expect(definition.description ?? "").toBe("");
  });

  it("infers the only business, so no --enterprise switch is needed", () => {
    createAndSaveEnterprise({
      name: "Sal's Street Eats",
      mission: "Serve tacos.",
    });

    const entries = handleUiFunctionCreateSubcommand(["Customer Enquiries"]);

    expect(entries[0].label).toBe("Function created");
    expect(entries[0].body).toContain("Customer Enquiries");
  });

  it("asks which business by listing them when more than one exists", () => {
    createAndSaveEnterprise({ name: "First Co", mission: "One." });
    createAndSaveEnterprise({ name: "Second Co", mission: "Two." });

    const entries = handleUiFunctionCreateSubcommand(["Customer Enquiries"]);

    expect(entries[0].label).toBe("Which business is this for?");
    expect(entries[0].body).toContain('"First Co"');
    expect(entries[0].body).toContain('"Second Co"');
    // Names the Function it will create, so the user just copies a line.
    expect(entries[0].body).toContain('"Customer Enquiries"');
  });

  it("guides to setup when there is no business at all", () => {
    const entries = handleUiFunctionCreateSubcommand(["Customer Enquiries"]);

    expect(entries[0].label).toBe("Set up a business first");
    expect(entries[0].body).toContain("/enterprise");
  });

  it("asks for a name in plain words when none is given", () => {
    createAndSaveEnterprise({ name: "Solo Co", mission: "Solo." });

    const entries = handleUiFunctionCreateSubcommand([]);

    expect(entries[0].body).toContain("ongoing responsibility");
    expect(entries[0].body).not.toContain("--enterprise");
  });

  it("refuses a same-named Function in the same Enterprise, since names are how commands address them", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Ethical Toys",
        mission: "Provide ethical toys.",
      });
    handleUiFunctionCreateSubcommand([
      "Product Safety",
      "--enterprise",
      enterprise.id,
      "--objective",
      "Keep products safe.",
    ]);

    const entries =
      handleUiFunctionCreateSubcommand([
        "product safety",
        "--enterprise",
        enterprise.id,
        "--objective",
        "A duplicate by another case.",
      ]);

    expect(entries[0].label).toBe("Function already exists");
    expect(entries[0].body).toContain('"Product Safety"');
    expect(entries[0].body).toContain("/function update");
  });

  it("allows the same Function name in a different Enterprise", () => {
    const first =
      createAndSaveEnterprise({
        name: "Ethical Toys",
        mission: "Provide ethical toys.",
      });
    const second =
      createAndSaveEnterprise({
        name: "Koru Kids",
        mission: "Help children learn.",
      });
    handleUiFunctionCreateSubcommand([
      "Product Safety",
      "--enterprise",
      first.id,
      "--objective",
      "Keep products safe.",
    ]);

    const entries =
      handleUiFunctionCreateSubcommand([
        "Product Safety",
        "--enterprise",
        second.id,
        "--objective",
        "Keep toys safe.",
      ]);

    expect(entries[0].label).toBe("Function created");
  });

  it("keeps an explicitly supplied description distinct from the objective", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Ethical Toys",
        mission: "Provide ethical toys.",
      });

    const entries =
      handleUiFunctionCreateSubcommand([
        "Product Safety",
        "--enterprise",
        enterprise.id,
        "--objective",
        "Keep products safe.",
        "--description",
        "Children use these products daily.",
      ]);

    const [definition] = listBusinessFunctionDefinitions();
    expect(definition.objective).toBe("Keep products safe.");
    expect(definition.description).toBe("Children use these products daily.");
  });

  it("tells the operator to run /staff next", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Ethical Toys",
        mission: "Provide ethical toys.",
      });

    const entries =
      handleUiFunctionCreateSubcommand([
        "Product Safety",
        "--enterprise",
        enterprise.id,
        "--objective",
        "Keep products safe.",
      ]);

    expect(entries[0].body).toContain(
      "Run /staff to add Workers."
    );
  });
});
