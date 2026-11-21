import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  attachEnterpriseBusinessFunction,
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  clearBusinessFunctions,
} from "../business/businessFunctionRuntimeStore";

import {
  clearBusinessFunctionDefinitions,
  createAndSaveBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  registerAiWorker,
  clearWorkers,
} from "../control/workers";

import {
  saveStaffingAssignment,
  clearStaffingAssignments,
} from "../staffing/staffingStore";

import {
  clearPolicyRules,
  savePolicyRules,
} from "../storage/policyRepository";

import {
  formatEnterpriseDetail,
  formatEnterpriseList,
  handleEnterpriseCommand,
} from "./enterpriseCommands";

beforeEach(() => {
  clearEnterprises();
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
  clearWorkers();
  clearStaffingAssignments();
  clearPolicyRules();

  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("enterpriseCommands", () => {
  it("formats an empty enterprise list", () => {
    expect(
      formatEnterpriseList()
    ).toBe(
      "No enterprises."
    );
  });

  it("formats missing enterprise detail", () => {
    expect(
      formatEnterpriseDetail(
        "missing"
      )
    ).toBe(
      "enterprise not found: missing"
    );
  });

  it("formats enterprise detail without functions", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Daily Intelligence",
        mission: "Operate an AI-native news business.",
        now: 1000,
      });

    expect(
      formatEnterpriseDetail(
        enterprise.id
      )
    ).toBe(
      [
        "Enterprise: Daily Intelligence",
        "  ID:          enterprise-1",
        "  Status:      active",
        "  Mission:     Operate an AI-native news business.",
        "  Description: (none)",
        "  Functions (0):",
        "    (none)",
        "",
        "  Workers (0):",
        "    (none)",
        "",
        "  Policies (0):",
        "    (none)",
      ].join("\n")
    );
  });

  it("formats enterprise detail with functions", () => {
    const enterprise =
      createAndSaveEnterprise({
        name: "Daily Intelligence",
        mission: "Operate an AI-native news business.",
        now: 1000,
      });

    const definition =
      createAndSaveBusinessFunctionDefinition({
        id: "enterprise-1:function-1",
        enterpriseId: "enterprise-1",
        label: "News Discovery",
        objective: "Find trusted articles.",
        now: 1000,
      });

    attachEnterpriseBusinessFunction(
      enterprise.id,
      definition.id
    );

    expect(
      formatEnterpriseDetail(
        enterprise.id
      )
    ).toBe(
      [
        "Enterprise: Daily Intelligence",
        "  ID:          enterprise-1",
        "  Status:      active",
        "  Mission:     Operate an AI-native news business.",
        "  Description: (none)",
        "  Functions (1):",
        "    - News Discovery (enterprise-1:function-1) — declared",
        "",
        "  Workers (0):",
        "    (none)",
        "",
        "  Policies (0):",
        "    (none)",
      ].join("\n")
    );
  });

  it("prints enterprise usage when subcommand is missing", () => {
    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([]);

    expect(log).toHaveBeenCalledWith(
      [
        "Usage:",
        '  /enterprise "<name>" --description "<description>" [--mission "<mission>"]',
        '  /enterprise create "<name>" [--mission "<mission>"] [--description "<description>"]',
        '  /enterprise inspect "<name-or-id>"',
        '  /enterprise update "<name-or-id>" --description "<description>"',
        "  /enterprise list",
      ].join("\n")
    );
  });

  it("formats enterprises", () => {
    createAndSaveEnterprise({
      name: "Daily Intelligence",
      mission: "Operate an AI-native news business.",
      now: 1000,
    });

    const output =
      formatEnterpriseList();

    expect(output).toContain(
      "ID"
    );

    expect(output).toContain(
      "Name"
    );

    expect(output).toContain(
      "Status"
    );

    expect(output).toContain(
      "Functions"
    );

    expect(output).toContain(
      "enterprise-1"
    );

    expect(output).toContain(
      "Daily Intelligence"
    );

    expect(output).toContain(
      "active"
    );

    expect(output).toContain(
      "0"
    );
  });

  it("prints enterprise list", () => {
    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([
      "list",
    ]);

    expect(log).toHaveBeenCalledWith(
      "No enterprises."
    );
  });

  it("prints usage when enterprise create args are missing", () => {
    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([
      "create",
    ]);

    expect(log).toHaveBeenCalledWith(
      'Usage: /enterprise "<name>" --description "<description>" or /enterprise create "<name>" [--mission "<mission>"] [--description "<description>"]'
    );
  });

  it("creates an enterprise without a mission", () => {
    vi.useFakeTimers();
    vi.setSystemTime(
      new Date(
        "2026-07-05T09:14:02.000Z"
      )
    );

    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([
      "create",
      "Coffee Reminder",
    ]);

    expect(log).toHaveBeenCalledWith(
      [
        "Enterprise created.",
        "",
        "  ID:                  enterprise-1",
        "  Name:                Coffee Reminder",
        "  Description:         (none)",
        "  Status:              active",
        "  Created:             2026-07-05T09:14:02.000Z",
        "  Functions:                0",
        "  Workers:             0",
        "  Policies:            0",
        "",
        'Run /next "Coffee Reminder" to create this Enterprise\'s ongoing Functions, or /function to add one yourself.',
      ].join("\n")
    );
  });

  it("creates an enterprise with an optional mission", () => {
    vi.useFakeTimers();
    vi.setSystemTime(
      new Date(
        "2026-07-05T09:14:02.000Z"
      )
    );

    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([
      "create",
      "Coffee Reminder",
      "--mission",
      "Promote healthy coffee habits",
    ]);

    expect(log).toHaveBeenCalledWith(
      [
        "Enterprise created.",
        "",
        "  ID:                  enterprise-1",
        "  Name:                Coffee Reminder",
        "  Description:         (none)",
        "  Status:              active",
        "  Created:             2026-07-05T09:14:02.000Z",
        "  Functions:                0",
        "  Workers:             0",
        "  Policies:            0",
        "",
        'Run /next "Coffee Reminder" to create this Enterprise\'s ongoing Functions, or /function to add one yourself.',
      ].join("\n")
    );
  });

  it("creates an enterprise from the short description form", () => {
    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([
      "Acme Real Estate",
      "--description",
      "Acme Real Estate is a small real estate business specialising in rural property",
    ]);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining(
        [
          "  Name:                Acme Real Estate",
          "  Description:         Acme Real Estate is a small real estate business specialising in rural property",
        ].join("\n")
      )
    );
  });

  it("prints enterprise detail using inspect subcommand", () => {
    createAndSaveEnterprise({
      name: "Daily Intelligence",
      mission: "Operate an AI-native news business.",
      now: 1000,
    });

    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([
      "inspect",
      "enterprise-1",
    ]);

    expect(log).toHaveBeenCalledWith(
      [
        "Enterprise: Daily Intelligence",
        "  ID:          enterprise-1",
        "  Status:      active",
        "  Mission:     Operate an AI-native news business.",
        "  Description: (none)",
        "  Functions (0):",
        "    (none)",
        "",
        "  Workers (0):",
        "    (none)",
        "",
        "  Policies (0):",
        "    (none)",
      ].join("\n")
    );
  });

  it("prints enterprise detail using inspect subcommand by name", () => {
    createAndSaveEnterprise({
      name: "Coffee Reminder",
      mission: "Promote healthy coffee habits",
      now: 1000,
    });

    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([
      "inspect",
      "Coffee Reminder",
    ]);

    expect(log).toHaveBeenCalledWith(
      [
        "Enterprise: Coffee Reminder",
        "  ID:          enterprise-1",
        "  Status:      active",
        "  Mission:     Promote healthy coffee habits",
        "  Description: (none)",
        "  Functions (0):",
        "    (none)",
        "",
        "  Workers (0):",
        "    (none)",
        "",
        "  Policies (0):",
        "    (none)",
      ].join("\n")
    );
  });

  it("prints usage when enterprise inspect target is missing", () => {
    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([
      "inspect",
    ]);

    expect(log).toHaveBeenCalledWith(
      'Usage: /enterprise inspect "<name-or-id>"'
    );
  });

  it("updates enterprise description", () => {
    vi.useFakeTimers();
    vi.setSystemTime(
      new Date(
        "2026-07-05T09:21:10.000Z"
      )
    );

    createAndSaveEnterprise({
      name: "Coffee Reminder",
      mission: "Promote healthy coffee habits",
      now: Date.parse(
        "2026-07-05T09:14:02.000Z"
      ),
    });

    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([
      "update",
      "Coffee Reminder",
      "--description",
      "Reminds the user to make coffee at sensible times of day.",
    ]);

    expect(log).toHaveBeenCalledWith(
      [
        "Enterprise updated.",
        "",
        "  ID:          enterprise-1",
        "  Name:        Coffee Reminder",
        "  Description: Reminds the user to make coffee at sensible times of day.",
        "  Status:      active",
        "  Updated:     2026-07-05T09:21:10.000Z",
      ].join("\n")
    );
  });

  it("prints usage when enterprise update description is missing", () => {
    createAndSaveEnterprise({
      name: "Daily Intelligence",
      mission: "Operate an AI-native news business.",
      now: 1000,
    });

    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([
      "update",
      "enterprise-1",
    ]);

    expect(log).toHaveBeenCalledWith(
      'Usage: /enterprise update "<name-or-id>" --description "<description>"'
    );
  });

  it("prints not found when updating a missing enterprise", () => {
    const log =
      vi.spyOn(
        console,
        "log"
      ).mockImplementation(
        () => undefined
      );

    handleEnterpriseCommand([
      "update",
      "missing",
      "--description",
      "Something else.",
    ]);

    expect(log).toHaveBeenCalledWith(
      "enterprise not found: missing"
    );
  });
});

describe("enterprise detail workers and policies", () => {
  it("lists the Workers staffed to the Enterprise's Functions", () => {
    const enterprise = createAndSaveEnterprise({
      name: "t & s heating ltd",
      mission: "Repair boilers.",
      now: 1000,
    });
    const definition = createAndSaveBusinessFunctionDefinition({
      id: "enterprise-1:invoicing",
      enterpriseId: enterprise.id,
      label: "invoicing",
      objective: "Bill customers for completed work.",
      now: 1000,
    });
    attachEnterpriseBusinessFunction(enterprise.id, definition.id);
    registerAiWorker("Invoicing Analyst", "analyst");
    saveStaffingAssignment({
      businessFunctionId: definition.id,
      workerName: "Invoicing Analyst",
      role: "ai",
      rationale: "Covers invoicing.",
    });

    const detail = formatEnterpriseDetail(enterprise.id);

    expect(detail).toContain("Workers (1):");
    expect(detail).toContain("Invoicing Analyst (ai) — invoicing");
  });

  it("shows the governance rules that apply to the Enterprise", () => {
    const enterprise = createAndSaveEnterprise({
      name: "t & s heating ltd",
      mission: "Repair boilers.",
      now: 1000,
    });
    savePolicyRules([{
      id: "staffing-approval:enterprise-1:invoicing",
      description: "Human approval required for invoicing, from the staffing plan you applied.",
      effect: "require-approval",
      match: { businessFunctionId: "enterprise-1:invoicing" },
      scope: { type: "organization", id: enterprise.id },
    }]);

    const detail = formatEnterpriseDetail(enterprise.id);

    expect(detail).toContain("Policies (1):");
    expect(detail).toContain("require-approval: Human approval required for invoicing");
  });

  it("does not show another Enterprise's rules", () => {
    const enterprise = createAndSaveEnterprise({
      name: "t & s heating ltd",
      mission: "Repair boilers.",
      now: 1000,
    });
    savePolicyRules([{
      id: "other",
      description: "Someone else's rule",
      effect: "deny",
      match: {},
      scope: { type: "organization", id: "enterprise-999" },
    }]);

    expect(formatEnterpriseDetail(enterprise.id)).toContain("Policies (0):");
  });
});
