import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// The conversation asks the model for each next turn; stub it deterministically.
vi.mock("../llm/llmClient", () => ({
  resolveConfiguredProvider: () => ({ provider: "ollama", routingMode: "single" }),
  generateWithConfiguredLlm: vi.fn(),
}));

// The final step hands off to /next guidance (which also calls the model); stub it.
vi.mock("./uiNextEntries", () => ({
  handleUiNextCommand: vi.fn(async () => ({
    actor: "Arturo",
    label: "Next step",
    body: "Recommended Business Functions (stub).",
  })),
}));

import {
  generateWithConfiguredLlm,
} from "../llm/llmClient";

import {
  buildAdviserConversationPrompt,
  endAdviseSession,
  extractNameSuggestion,
  extractReadyMarker,
  getActiveAdviseSession,
  handleUiAdviseContinuation,
  MAX_ADVISE_ANSWERS,
  MIN_ADVISE_ANSWERS,
  startAdviseSession,
  stripDanglingNameProposal,
} from "./uiAdviseEntries";

import {
  clearEnterprises,
  getEnterpriseByIdOrName,
} from "../enterprise/enterpriseStore";

const mockedGenerate = vi.mocked(generateWithConfiguredLlm);

/** Returns a distinct turn for each call, then READY from `readyAfter` onward. */
function turnsThenReady(readyAfter: number): void {
  let call = 0;
  mockedGenerate.mockImplementation(async () => {
    call += 1;
    return {
      response:
        call > readyAfter
          ? `That gives me a good picture.\nREADY`
          : `That's helpful, thanks. Turn ${call} question?`,
    };
  });
}

/**
 * Mocks a no-name conversation: ordinary questions/READY for regular turns, and
 * a distinct response (with an optional NAME: suggestion) for the dedicated
 * closing/naming call, distinguished by prompt content.
 */
function mockConversationThenNaming(
  readyAfter: number,
  suggestedName?: string
): void {
  let call = 0;
  mockedGenerate.mockImplementation(async ({ prompt }) => {
    if (prompt.includes("Write a short, warm closing")) {
      return suggestedName
        ? { response: `Great, that gives me a clear picture.\nNAME: ${suggestedName}` }
        : { response: "Great, that gives me a clear picture." };
    }

    call += 1;
    return {
      response:
        call > readyAfter
          ? "That gives me a good picture.\nREADY"
          : `That's helpful, thanks. Turn ${call} question?`,
    };
  });
}

beforeEach(() => {
  endAdviseSession();
  clearEnterprises();
  mockedGenerate.mockReset();
});

describe("extractReadyMarker", () => {
  it("strips a trailing standalone READY line", () => {
    expect(
      extractReadyMarker("Great, that's enough.\nREADY")
    ).toEqual({ message: "Great, that's enough.", ready: true });
  });

  it("leaves ordinary text untouched", () => {
    expect(
      extractReadyMarker("What do you sell?")
    ).toEqual({ message: "What do you sell?", ready: false });
  });

  it("does not match READY as part of a longer word or sentence", () => {
    expect(
      extractReadyMarker("Are you ready to start?")
    ).toEqual({ message: "Are you ready to start?", ready: false });
  });
});

describe("advise conversation", () => {
  it("returns undefined when no session is active", async () => {
    expect(await handleUiAdviseContinuation("hello")).toBeUndefined();
  });

  it("opens with a model-generated conversational turn, no question numbering", async () => {
    turnsThenReady(10);
    const entry = await startAdviseSession("Ethical Toys");
    expect(getActiveAdviseSession()?.name).toBe("Ethical Toys");
    expect(entry.body).toContain("Turn 1 question?");
    expect(entry.body).not.toMatch(/Question \d+ of \d+/);
  });

  it("passes the transcript so far to the model on each turn", async () => {
    turnsThenReady(10);
    await startAdviseSession("Ethical Toys");
    await handleUiAdviseContinuation("Parents of toddlers");

    const secondCallPrompt =
      mockedGenerate.mock.calls[1][0].prompt;
    expect(secondCallPrompt).toContain("Parents of toddlers");
    expect(secondCallPrompt).toContain("Turn 1 question?");
  });

  it("re-shows the last turn verbatim on an empty answer (no model call)", async () => {
    turnsThenReady(10);
    await startAdviseSession("Ethical Toys");
    mockedGenerate.mockClear();
    const entries = await handleUiAdviseContinuation("   ");
    expect(entries?.[0].body).toContain("Turn 1 question?");
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it("cancels without creating an Enterprise", async () => {
    turnsThenReady(10);
    await startAdviseSession("Ethical Toys");
    const entries = await handleUiAdviseContinuation("cancel");
    expect(entries?.[0].label).toBe("Guided setup cancelled");
    expect(getActiveAdviseSession()).toBeUndefined();
    expect(getEnterpriseByIdOrName("Ethical Toys")).toBeUndefined();
  });

  it("ignores an early READY before the minimum number of answers", async () => {
    // The model says READY immediately, but no answers have been given yet —
    // the conversation must not end.
    mockedGenerate.mockResolvedValue({ response: "Sounds great.\nREADY" });
    await startAdviseSession("Ethical Toys");
    const entries = await handleUiAdviseContinuation("Parents of toddlers");
    expect(getActiveAdviseSession()).toBeDefined();
    expect(entries?.[0].body).not.toContain("READY");
  });

  it("finishes and creates the Enterprise once the model signals READY at/after the minimum", async () => {
    turnsThenReady(MIN_ADVISE_ANSWERS);
    await startAdviseSession("Ethical Toys");
    for (let i = 0; i < MIN_ADVISE_ANSWERS; i += 1) {
      await handleUiAdviseContinuation(`answer ${i}`);
    }

    expect(getActiveAdviseSession()).toBeUndefined();
    const enterprise = getEnterpriseByIdOrName("Ethical Toys");
    expect(enterprise).toBeDefined();
    expect(enterprise?.mission).toContain("answer 0");
  });

  it("ends when the operator says they are done, even if the model never says READY", async () => {
    mockedGenerate.mockResolvedValue({ response: "Another question?" });
    await startAdviseSession("Ethical Toys");
    for (let i = 0; i < MIN_ADVISE_ANSWERS; i += 1) {
      await handleUiAdviseContinuation(`answer ${i}`);
    }
    expect(getActiveAdviseSession()).toBeDefined();

    await handleUiAdviseContinuation("That's about it really. Can we get started?");

    expect(getActiveAdviseSession()).toBeUndefined();
    expect(getEnterpriseByIdOrName("Ethical Toys")).toBeDefined();
  });

  it("keeps interviewing when the operator signals completion below the minimum", async () => {
    mockedGenerate.mockResolvedValue({ response: "Another question?" });
    await startAdviseSession("Ethical Toys");

    await handleUiAdviseContinuation("That's everything.");

    expect(getActiveAdviseSession()).toBeDefined();
  });

  it("caps the conversation at MAX answers even if the model never says READY", async () => {
    mockedGenerate.mockResolvedValue({ response: "Another question?" });
    await startAdviseSession("Ethical Toys");
    for (let i = 0; i < MAX_ADVISE_ANSWERS; i += 1) {
      await handleUiAdviseContinuation(`answer ${i}`);
    }
    expect(getActiveAdviseSession()).toBeUndefined();
    expect(getEnterpriseByIdOrName("Ethical Toys")).toBeDefined();
  });

  it("falls back to a fixed opener if the model is unavailable at session start", async () => {
    mockedGenerate.mockRejectedValue(new Error("model unavailable"));
    const entry = await startAdviseSession("Ethical Toys");
    expect(entry.body.length).toBeGreaterThan(0);
    expect(getActiveAdviseSession()).toBeDefined();
  });

  it("finishes gracefully if the model fails mid-conversation", async () => {
    turnsThenReady(10);
    await startAdviseSession("Ethical Toys");
    mockedGenerate.mockRejectedValueOnce(new Error("model unavailable"));
    const entries = await handleUiAdviseContinuation("Parents of toddlers");
    expect(getActiveAdviseSession()).toBeUndefined();
    expect(getEnterpriseByIdOrName("Ethical Toys")).toBeDefined();
    expect(entries).toBeDefined();
  });
});

describe("buildAdviserConversationPrompt (no name)", () => {
  it("does not claim a name when none is known", () => {
    const prompt =
      buildAdviserConversationPrompt(
        undefined,
        []
      );
    expect(prompt).not.toContain('called "');
    expect(prompt).toContain("doesn't have a name yet");
  });

  it.each([
    ["the interview turn", []],
    ["a pushback turn", [{ role: "user" as const, content: "That's everything." }]],
  ])("forbids unevidenced business advice on %s", (_label, transcript) => {
    expect(
      buildAdviserConversationPrompt("Ethical Toys", transcript)
    ).toMatch(/not to advise it|Do not offer advice/);
  });
});

describe("extractNameSuggestion", () => {
  it("strips a trailing NAME: line and reports the suggestion", () => {
    expect(
      extractNameSuggestion('That gives me a clear picture.\nNAME: Ethical Toys Co')
    ).toEqual({
      message: "That gives me a clear picture.",
      suggestedName: "Ethical Toys Co",
    });
  });

  it("strips surrounding quotes from the suggested name", () => {
    expect(
      extractNameSuggestion('Sounds good.\nNAME: "Ethical Toys Co"')
    ).toEqual({
      message: "Sounds good.",
      suggestedName: "Ethical Toys Co",
    });
  });

  it.each([
    "NAME: Community Table Auckland —",
    "NAME: Community Table Auckland.",
    "NAME: - Community Table Auckland",
    'NAME: "Community Table Auckland" —',
  ])("keeps trailing model punctuation out of the name (%s)", (line) => {
    expect(
      extractNameSuggestion(`That gives me a clear picture.\n${line}`).suggestedName
    ).toBe("Community Table Auckland");
  });

  it("tolerates a response with no NAME: line", () => {
    expect(
      extractNameSuggestion("Sounds good, that's plenty to go on.")
    ).toEqual({
      message: "Sounds good, that's plenty to go on.",
      suggestedName: undefined,
    });
  });
});

describe("advise conversation (name omitted)", () => {
  it("starts without a name and does not ask for one directly", async () => {
    mockConversationThenNaming(10);
    const entry = await startAdviseSession();
    expect(getActiveAdviseSession()?.name).toBeUndefined();
    expect(entry.body.toLowerCase()).not.toContain("what would you like to call");
  });

  it("proposes a name once the conversation concludes, and creates the Enterprise on acceptance", async () => {
    mockConversationThenNaming(MIN_ADVISE_ANSWERS, "Ethical Toys Co");
    await startAdviseSession();
    for (let i = 0; i < MIN_ADVISE_ANSWERS; i += 1) {
      await handleUiAdviseContinuation(`answer ${i}`);
    }

    // Conversation should have ended and moved into naming confirmation, with
    // nothing created yet.
    expect(getActiveAdviseSession()).toBeDefined();
    expect(getEnterpriseByIdOrName("Ethical Toys Co")).toBeUndefined();

    const entries = await handleUiAdviseContinuation("yes");
    expect(getActiveAdviseSession()).toBeUndefined();
    const enterprise = getEnterpriseByIdOrName("Ethical Toys Co");
    expect(enterprise).toBeDefined();
    expect(enterprise?.mission).toContain("answer 0");
    expect(entries).toBeDefined();
  });

  it("lets the operator override the suggested name outright", async () => {
    mockConversationThenNaming(MIN_ADVISE_ANSWERS, "Ethical Toys Co");
    await startAdviseSession();
    for (let i = 0; i < MIN_ADVISE_ANSWERS; i += 1) {
      await handleUiAdviseContinuation(`answer ${i}`);
    }

    await handleUiAdviseContinuation("Kindly Toys");

    expect(getEnterpriseByIdOrName("Ethical Toys Co")).toBeUndefined();
    expect(getEnterpriseByIdOrName("Kindly Toys")).toBeDefined();
  });

  it("re-asks for a name when the suggestion is declined, without creating anything yet", async () => {
    mockConversationThenNaming(MIN_ADVISE_ANSWERS, "Ethical Toys Co");
    await startAdviseSession();
    for (let i = 0; i < MIN_ADVISE_ANSWERS; i += 1) {
      await handleUiAdviseContinuation(`answer ${i}`);
    }

    const declineEntries =
      await handleUiAdviseContinuation("no");
    expect(declineEntries?.[0].body).toContain("what would you like to call it instead");
    expect(getActiveAdviseSession()).toBeDefined();
    expect(getEnterpriseByIdOrName("Ethical Toys Co")).toBeUndefined();

    await handleUiAdviseContinuation("Kindly Toys");
    expect(getEnterpriseByIdOrName("Kindly Toys")).toBeDefined();
  });

  it("triggers naming confirmation at the MAX cap even without READY", async () => {
    mockConversationThenNaming(MAX_ADVISE_ANSWERS + 10, "Ethical Toys Co");
    await startAdviseSession();
    for (let i = 0; i < MAX_ADVISE_ANSWERS; i += 1) {
      await handleUiAdviseContinuation(`answer ${i}`);
    }

    // Should be waiting on naming confirmation, not finished.
    expect(getActiveAdviseSession()).toBeDefined();
    expect(getEnterpriseByIdOrName("Ethical Toys Co")).toBeUndefined();

    await handleUiAdviseContinuation("yes");
    expect(getEnterpriseByIdOrName("Ethical Toys Co")).toBeDefined();
  });

  it("falls back to asking directly when the model gives no name suggestion", async () => {
    mockConversationThenNaming(MIN_ADVISE_ANSWERS, undefined);
    await startAdviseSession();
    for (let i = 0; i < MIN_ADVISE_ANSWERS; i += 1) {
      await handleUiAdviseContinuation(`answer ${i}`);
    }

    const entries = await handleUiAdviseContinuation("Kindly Toys");
    expect(getEnterpriseByIdOrName("Kindly Toys")).toBeDefined();
    expect(entries).toBeDefined();
  });

  it("falls back to asking directly when the naming call itself fails", async () => {
    let call = 0;
    mockedGenerate.mockImplementation(async ({ prompt }) => {
      if (prompt.includes("Write a short, warm closing")) {
        throw new Error("model unavailable");
      }
      call += 1;
      return {
        response:
          call > MIN_ADVISE_ANSWERS
            ? "That gives me a good picture.\nREADY"
            : `That's helpful, thanks. Turn ${call} question?`,
      };
    });

    await startAdviseSession();
    for (let i = 0; i < MIN_ADVISE_ANSWERS; i += 1) {
      await handleUiAdviseContinuation(`answer ${i}`);
    }

    expect(getActiveAdviseSession()).toBeDefined();
    await handleUiAdviseContinuation("Kindly Toys");
    expect(getEnterpriseByIdOrName("Kindly Toys")).toBeDefined();
  });

  it("cancels during naming confirmation without creating an Enterprise", async () => {
    mockConversationThenNaming(MIN_ADVISE_ANSWERS, "Ethical Toys Co");
    await startAdviseSession();
    for (let i = 0; i < MIN_ADVISE_ANSWERS; i += 1) {
      await handleUiAdviseContinuation(`answer ${i}`);
    }

    const entries = await handleUiAdviseContinuation("cancel");
    expect(entries?.[0].label).toBe("Guided setup cancelled");
    expect(getActiveAdviseSession()).toBeUndefined();
    expect(getEnterpriseByIdOrName("Ethical Toys Co")).toBeUndefined();
  });

  it("re-shows the naming-confirmation prompt verbatim on an empty answer", async () => {
    mockConversationThenNaming(MIN_ADVISE_ANSWERS, "Ethical Toys Co");
    await startAdviseSession();
    for (let i = 0; i < MIN_ADVISE_ANSWERS; i += 1) {
      await handleUiAdviseContinuation(`answer ${i}`);
    }

    mockedGenerate.mockClear();
    const entries = await handleUiAdviseContinuation("   ");
    expect(entries?.[0].body).toContain("Ethical Toys Co");
    expect(mockedGenerate).not.toHaveBeenCalled();
  });
});

describe("stripDanglingNameProposal", () => {
  it("drops a proposal the operator has no way to accept", () => {
    expect(
      stripDanglingNameProposal(
        "I completely understand the complexities you're facing. Based on what you've shared, I think a fitting name for your business would be Auckland Family Pantry —"
      )
    ).toBe("I completely understand the complexities you're facing.");
  });

  it("leaves a closing message that proposes nothing", () => {
    const message = "Thanks — I have a good picture of the business now.";
    expect(stripDanglingNameProposal(message)).toBe(message);
  });

  it("falls back rather than showing nothing when the whole message was a proposal", () => {
    expect(
      stripDanglingNameProposal("How about we call it Auckland Family Pantry?")
    ).toBe("Thanks — I have a good picture of the business now.");
  });
});
