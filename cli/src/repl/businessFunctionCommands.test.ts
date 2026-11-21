import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  createBusinessFunctionRuntime,
} from "../business/businessFunctionRuntime";

import {
  clearBusinessFunctions,
  saveBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  formatBusinessFunctions,
  handleFunctionsCommand,
} from "./businessFunctionCommands";

import {
  clearEnterprises,
  createAndSaveEnterprise,
  getEnterprise,
} from "../enterprise/enterpriseStore";

import {
  getBusinessFunction,
} from "../business/businessFunctionRuntimeStore";

import {
  createEnterpriseBusinessFunctionId,
  handleAddFunctionCommand,
} from "./businessFunctionCommands";

import {
  clearBusinessFunctionDefinitions,
  getBusinessFunctionDefinition,
} from "../business/businessFunctionDefinitionStore";

import {
  handleStartFunctionCommand,
} from "./businessFunctionCommands";

import {
  handleFunctionCommand,
} from "./businessFunctionCommands";

beforeEach(() => {
  clearBusinessFunctions();
  clearBusinessFunctionDefinitions();
});

describe("businessFunctionCommands", () => {
  it("formats empty business functions", () => {
    expect(
      formatBusinessFunctions(
        []
      )
    ).toBe(
      "No active functions found."
    );
  });

  it("formats business functions", () => {
    expect(
      formatBusinessFunctions([
        createBusinessFunctionRuntime({
          id: "run-1:function-2",
          label: "Market Research",
          objective: "Research Gen Z fashion trends.",
          ownerWorker: "auto-researcher",
        }),
      ])
    ).toBe(
      [
        "1. Market Research",
        "   id: run-1:function-2",
        "   status: draft",
        "   owner: auto-researcher",
        "   refinements: 0",
        "   tasks: 0",
      ].join("\n")
    );
  });

  it("creates a readable enterprise business function id from names", () => {
  expect(
    createEnterpriseBusinessFunctionId(
      "Discovery Hub",
      "Curated Content Manager"
    )
  ).toBe(
    "discovery-hub:curated-content-manager"
  );
});

it("appends a numeric suffix when the readable id collides", () => {
  expect(
    createEnterpriseBusinessFunctionId(
      "Discovery Hub",
      "Curated Content Manager",
      [
        "discovery-hub:curated-content-manager",
        "discovery-hub:curated-content-manager-2",
      ]
    )
  ).toBe(
    "discovery-hub:curated-content-manager-3"
  );
});

it("falls back to generic segments when names slug to empty", () => {
  expect(
    createEnterpriseBusinessFunctionId("!!!", "***")
  ).toBe("enterprise:function");
});

it("prints usage when add-function arguments are missing", () => {
  const log =
    vi.spyOn(console, "log").mockImplementation(
      () => undefined
    );

  handleAddFunctionCommand([]);

  expect(log).toHaveBeenCalledWith(
    'Usage: /add-function <enterprise-id> "<function name>" "<objective>"'
  );
});

it("prints not found for a missing enterprise", () => {
  const log =
    vi.spyOn(console, "log").mockImplementation(
      () => undefined
    );

  handleAddFunctionCommand([
    "missing",
    "News Discovery",
    "Find relevant articles.",
  ]);

  expect(log).toHaveBeenCalledWith(
    "enterprise not found: missing"
  );
});

it("adds a function to an enterprise", () => {
  const log =
    vi.spyOn(console, "log").mockImplementation(
      () => undefined
    );

  const enterprise =
    createAndSaveEnterprise({
      name: "Daily Intelligence",
      mission: "Operate an AI-native news business.",
    });

  handleAddFunctionCommand([
    enterprise.id,
    "News Discovery",
    "Find relevant articles from trusted sources.",
  ]);

  expect(
    getBusinessFunction(
      "daily-intelligence:news-discovery"
    )
  ).toEqual(
    expect.objectContaining({
      id: "daily-intelligence:news-discovery",
      label: "News Discovery",
      objective: "Find relevant articles from trusted sources.",
      ownerWorker: "unassigned",
      state: "draft",
      jobIds: [],
      refinements: [],
    })
  );

  expect(
    getEnterprise(
      enterprise.id
    )?.businessFunctionIds
  ).toEqual([
    "daily-intelligence:news-discovery",
  ]);

  expect(log).toHaveBeenCalledWith(
    [
      "function added",
      "enterprise: enterprise-1",
      "function: News Discovery",
      "id: daily-intelligence:news-discovery",
    ].join("\n")
  );

  expect(
  getBusinessFunctionDefinition(
    "daily-intelligence:news-discovery"
  )
).toEqual(
  expect.objectContaining({
    id: "daily-intelligence:news-discovery",
    enterpriseId: "enterprise-1",
    label: "News Discovery",
    objective: "Find relevant articles from trusted sources.",
    executionMode: "manual",
  })
  );
  
});
  
  it("prints stored business functions", () => {
    const log =
      vi.spyOn(console, "log").mockImplementation(
        () => undefined
      );

    saveBusinessFunction(
      createBusinessFunctionRuntime({
        id: "run-1:function-2",
        label: "Market Research",
        objective: "Research Gen Z fashion trends.",
        ownerWorker: "auto-researcher",
      })
    );

    handleFunctionsCommand();

    expect(log).toHaveBeenCalledWith(
      [
        "1. Market Research",
        "   id: run-1:function-2",
        "   status: draft",
        "   owner: auto-researcher",
        "   refinements: 0",
        "   tasks: 0",
      ].join("\n")
    );

    
  });

  it("prints usage when start-function id is missing", () => {
  const log =
    vi.spyOn(console, "log").mockImplementation(
      () => undefined
    );

  handleStartFunctionCommand([]);

  expect(log).toHaveBeenCalledWith(
    "Usage: /start-function <function-id>"
  );
});

it("prints not found when starting a missing function", () => {
  const log =
    vi.spyOn(console, "log").mockImplementation(
      () => undefined
    );

  handleStartFunctionCommand([
    "enterprise-1:function-1",
  ]);

  expect(log).toHaveBeenCalledWith(
    "function not found: enterprise-1:function-1"
  );
});

it("leaves description unset (not defaulted to objective) when omitted", () => {
  const log =
    vi.spyOn(console, "log").mockImplementation(
      () => undefined
    );

  const enterprise =
    createAndSaveEnterprise({
      name: "Ethical Toys",
      mission: "Provide ethical toys.",
    });

  handleFunctionCommand([
    "create",
    "Product Safety",
    "--enterprise",
    enterprise.id,
    "--objective",
    "Keep products safe.",
  ]);

  const body =
    log.mock.calls[log.mock.calls.length - 1][0] as string;

  expect(body).toContain("Objective:     Keep products safe.");
  expect(body).toContain("Description:   (none)");
});

it("tells the operator to run /staff next after creating a Function", () => {
  const log =
    vi.spyOn(console, "log").mockImplementation(
      () => undefined
    );

  const enterprise =
    createAndSaveEnterprise({
      name: "Ethical Toys",
      mission: "Provide ethical toys.",
    });

  handleFunctionCommand([
    "create",
    "Product Safety",
    "--enterprise",
    enterprise.id,
    "--objective",
    "Keep products safe.",
  ]);

  const body =
    log.mock.calls[log.mock.calls.length - 1][0] as string;

  expect(body).toContain(
    "Run /staff to add Workers."
  );
});

it("starts an existing business function", () => {
  const log =
    vi.spyOn(console, "log").mockImplementation(
      () => undefined
    );

  saveBusinessFunction(
    createBusinessFunctionRuntime({
      id: "enterprise-1:function-1",
      label: "News Discovery",
      objective: "Find relevant articles.",
      ownerWorker: "unassigned",
    })
  );

  handleStartFunctionCommand([
    "enterprise-1:function-1",
  ]);

  expect(log).toHaveBeenCalledWith(
    [
      "function started",
      "id: enterprise-1:function-1",
      "status: running",
    ].join("\n")
  );
});

  
});
