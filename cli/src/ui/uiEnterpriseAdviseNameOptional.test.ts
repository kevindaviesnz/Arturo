import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Force the interactive branch so we can exercise the "name optional" behaviour
// without a real TTY. Kept in its own file so it doesn't affect the genuine
// non-interactive refusal test in uiEnterpriseAdvise.test.ts.
vi.mock("../core/interactivity", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("../core/interactivity")>();
  return {
    ...actual,
    isInteractiveSession: () => true,
  };
});

vi.mock("../llm/llmClient", () => ({
  resolveConfiguredProvider: () => ({ provider: "ollama", routingMode: "single" }),
  generateWithConfiguredLlm: vi.fn(async () => ({
    response: "Hi, tell me about your business.",
  })),
}));

import {
  handleUiEnterpriseAdviseCreateSubcommand,
} from "./uiCommandHandlers";

import {
  endAdviseSession,
} from "./uiAdviseEntries";

afterEach(() => {
  endAdviseSession();
});

describe("handleUiEnterpriseAdviseCreateSubcommand (interactive, name omitted)", () => {
  it("starts the guided session instead of a Usage error when no name is given", async () => {
    const entries =
      await handleUiEnterpriseAdviseCreateSubcommand([]);

    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe("Guided setup");
    expect(entries[0].body).not.toContain("Usage");
  });

  it("still starts the guided session when a name is given", async () => {
    const entries =
      await handleUiEnterpriseAdviseCreateSubcommand([
        "Ethical Toys",
      ]);

    expect(entries).toHaveLength(1);
    expect(entries[0].label).toBe("Guided setup");
  });
});
