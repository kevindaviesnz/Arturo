import {
  describe,
  expect,
  it,
} from "vitest";

import {
  listModelProfiles,
  normalizeModelChoice,
  resolveModelProfile,
} from "./modelProfiles";

describe("modelProfiles", () => {
  it("always exposes the configured local model through a stable alias", () => {
    expect(
      listModelProfiles({
        ARTURO_LLM_MODEL: "local-model",
      })
    ).toContainEqual({
      alias: "local-default",
      provider: "ollama",
      model: "local-model",
      paid: false,
    });
  });

  it("supports multiple explicitly approved aliases", () => {
    const environment = {
      ARTURO_LLM_MODEL: "local-model",
      ARTURO_MODEL_PROFILES_JSON: JSON.stringify({
        "premium-reasoning": {
          provider: "gemini",
          model: "reasoning-model",
        },
        "local-review": {
          provider: "ollama",
          model: "larger-local-model",
        },
      }),
    };

    expect(
      resolveModelProfile(
        "premium-reasoning",
        environment
      )
    ).toEqual({
      alias: "premium-reasoning",
      provider: "gemini",
      model: "reasoning-model",
      paid: true,
    });
    expect(
      resolveModelProfile(
        "local-review",
        environment
      ).paid
    ).toBe(false);
  });

  it("supports friendly choices and configured model names", () => {
    const environment = {
      ARTURO_LLM_MODEL: "local-model",
      ARTURO_PAID_ESCALATION_MODEL: "premium-model",
    };

    expect(
      normalizeModelChoice(
        "local"
      )
    ).toBe(
      "local-default"
    );
    expect(
      resolveModelProfile(
        "premium",
        environment
      ).alias
    ).toBe(
      "premium-default"
    );
    expect(
      resolveModelProfile(
        "local-model",
        environment
      ).alias
    ).toBe(
      "local-default"
    );
  });

  it("rejects model names that are not configured", () => {
    expect(() =>
      resolveModelProfile(
        "gemini-arbitrary",
        {
          ARTURO_LLM_MODEL: "local-model",
        }
      )
    ).toThrow("Unknown model choice");
  });

  it("rejects malformed profile configuration", () => {
    expect(() =>
      listModelProfiles({
        ARTURO_MODEL_PROFILES_JSON: "{bad",
      })
    ).toThrow("must be a JSON object");
  });
});
