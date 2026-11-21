import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  clearEnterprises,
  createAndSaveEnterprise,
} from "../enterprise/enterpriseStore";

import {
  createComparedNextGuidanceForEnterprise,
  createNextGuidanceResultForEnterprise,
} from "../repl/nextCommands";

import {
  clearBusinessFunctionDefinitions,
  listBusinessFunctionDefinitionsByEnterprise,
} from "../business/businessFunctionDefinitionStore";

import {
  handleUiNextConfirmation,
} from "./uiCommandHandlers";

import {
  clearPendingNextConfirmation,
  handleUiNextCommand,
  readPendingNextConfirmation,
} from "./uiNextEntries";

vi.mock(
  "../repl/nextCommands",
  async () => {
    const actual =
      await vi.importActual<
        typeof import("../repl/nextCommands")
      >(
        "../repl/nextCommands"
      );

    return {
      ...actual,
      createNextGuidanceResultForEnterprise:
        vi.fn(),
      createComparedNextGuidanceForEnterprise:
        vi.fn(),
    };
  }
);

beforeEach(
  () => {
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearPendingNextConfirmation();
    vi.clearAllMocks();
  }
);

afterEach(
  () => {
    clearEnterprises();
    clearBusinessFunctionDefinitions();
    clearPendingNextConfirmation();
  }
);

describe(
  "uiNextEntries",
  () => {
    it(
      "explains that an Enterprise must be created first",
      async () => {
        const entry =
          await handleUiNextCommand(
            []
          );

        expect(
          entry.label
        ).toBe(
          "Next step"
        );

        expect(
          entry.body
        ).toContain(
          "/enterprise create"
        );
      }
    );

    it(
      "returns AI-generated Enterprise guidance",
      async () => {
        createAndSaveEnterprise({
          name:
            "Ethical Toys",
          mission:
            "Provide ethical toys for parents of young children.",
        });

        vi.mocked(
          createNextGuidanceResultForEnterprise
        ).mockResolvedValue(
          {
            guidance:
              "Generated guidance",
            recommendations: [],
          }
        );

        const entry =
          await handleUiNextCommand(
            []
          );

        expect(
          entry
        ).toEqual({
          actor:
            "Arturo",
          label:
            "AI-generated Enterprise guidance",
          body:
            "Generated guidance",
        });
      }
    );

    it(
      "returns a useful error when model generation fails",
      async () => {
        createAndSaveEnterprise({
          name:
            "Ethical Toys",
          mission:
            "Provide ethical toys.",
        });

        vi.mocked(
          createNextGuidanceResultForEnterprise
        ).mockRejectedValue(
          new Error(
            "Ollama is unavailable"
          )
        );

        const entry =
          await handleUiNextCommand(
            []
          );

        expect(
          entry
        ).toEqual({
          actor:
            "Arturo",
          label:
            "Enterprise guidance failed",
          body:
            "Ollama is unavailable",
        });
      }
    );

    it(
      "points the removed model switches at /model",
      async () => {
        createAndSaveEnterprise({
          name: "Ethical Toys",
          mission: "Provide ethical toys.",
        });

        const entry =
          await handleUiNextCommand([
            "Ethical Toys",
            "--compare",
            "local-default,premium-default",
          ]);

        expect(entry.body).toContain("/model");
        expect(
          readPendingNextConfirmation()
        ).toBeUndefined();
      }
    );

    it(
      "creates all pending recommendations when the user replies yes",
      async () => {
        const enterprise =
          createAndSaveEnterprise({
            name:
              "Ethical Toys",
            mission:
              "Provide ethical toys.",
          });

        vi.mocked(
          createNextGuidanceResultForEnterprise
        ).mockResolvedValue({
          guidance:
            "Generated guidance",
          recommendations: [
            {
              name:
                "Product Safety",
              objective:
                "Keep products safe.",
              reason:
                "Children use them.",
            },
            {
              name:
                "Ethical Sourcing",
              objective:
                "Source products ethically.",
              reason:
                "The mission requires it.",
            },
          ],
        });

        await handleUiNextCommand(
          []
        );

        expect(
          readPendingNextConfirmation()
            ?.recommendations
        ).toHaveLength(
          2
        );

        const entries =
          handleUiNextConfirmation(
            "yes"
          );

        expect(
          entries?.map(
            (entry) =>
              entry.label
          )
        ).toEqual([
          "Function created",
          "Function created",
          // The "run /staff next" step is appended once, not repeated per
          // Function, so a five-Function creation does not print it five times.
          "Next",
        ]);

        expect(
          entries
            ?.filter((entry) => entry.label === "Function created")
            .every((entry) => !entry.body.includes("/staff"))
        ).toBe(true);

        const created =
          listBusinessFunctionDefinitionsByEnterprise(
            enterprise.id
          );

        expect(
          created.map(
            (definition) =>
              definition.label
          )
        ).toEqual([
          "Product Safety",
          "Ethical Sourcing",
        ]);

        // Description should reflect why the Job is needed (the
        // recommendation's reason), not merely repeat the objective.
        expect(
          created[0].description
        ).toBe(
          "Children use them."
        );
        expect(
          created[0].description
        ).not.toBe(
          created[0].objective
        );

        expect(
          readPendingNextConfirmation()
        ).toBeUndefined();

        expect(
          handleUiNextConfirmation(
            "yes"
          )
        ).toBeUndefined();
      }
    );

    it(
      "leaves the Enterprise unchanged when the user replies no",
      async () => {
        const enterprise =
          createAndSaveEnterprise({
            name:
              "Ethical Toys",
            mission:
              "Provide ethical toys.",
          });

        vi.mocked(
          createNextGuidanceResultForEnterprise
        ).mockResolvedValue({
          guidance:
            "Generated guidance",
          recommendations: [
            {
              name:
                "Product Safety",
              objective:
                "Keep products safe.",
              reason:
                "Children use them.",
            },
          ],
        });

        await handleUiNextCommand(
          []
        );

        const entries =
          handleUiNextConfirmation(
            "no"
          );

        expect(
          entries?.[0].label
        ).toBe(
          "Functions unchanged"
        );

        expect(
          listBusinessFunctionDefinitionsByEnterprise(
            enterprise.id
          )
        ).toHaveLength(
          0
        );
      }
    );
  }
);
