import { describe, expect, it } from "vitest";
import { createBusinessFunctionDefinition } from "../business/businessFunctionDefinition";
import {
  buildCategoryQuestionPrompt,
  classifySensitiveWork,
  describeSensitiveWork,
  readsAsYes,
  requiresHumanApproval,
} from "./sensitiveWorkClassifier";

const riskRegister = createBusinessFunctionDefinition({
  id: "e-1:risks",
  enterpriseId: "e-1",
  label: "Risk Register",
  objective: "Keep a register of risks to children at the club.",
});

const newsDigest = createBusinessFunctionDefinition({
  id: "e-1:news",
  enterpriseId: "e-1",
  label: "Science News Digest",
  objective: "Summarise published science news each week.",
});

describe("buildCategoryQuestionPrompt", () => {
  it("asks a single yes/no question about one category", () => {
    const prompt = buildCategoryQuestionPrompt(riskRegister, "vulnerable-people");

    expect(prompt).toContain("Answer with one word, YES or NO");
    expect(prompt).toContain("affect children, patients, or people at risk");
    expect(prompt).toContain("Risk Register");
    expect(prompt).not.toContain("move money");
  });
});

describe("readsAsYes", () => {
  it.each(["YES", "yes", "Yes.", "yes, it does"])("reads %s as yes", (answer) => {
    expect(readsAsYes(answer)).toBe(true);
  });

  it.each(["NO", "no", "No.", "no — it does not"])("reads %s as no", (answer) => {
    expect(readsAsYes(answer)).toBe(false);
  });

  it.each(["", "possibly", "I'm not sure", "it depends"])(
    "treats the unreadable answer %p as yes, because this is a governance control",
    (answer) => {
      expect(readsAsYes(answer)).toBe(true);
    }
  );
});

describe("classifySensitiveWork", () => {
  it("asks one question per category per Function", async () => {
    const prompts: string[] = [];
    await classifySensitiveWork([riskRegister, newsDigest], async (prompt) => {
      prompts.push(prompt);
      return "NO";
    });

    expect(prompts).toHaveLength(12);
  });

  it("collects only the categories answered yes", async () => {
    const classification = await classifySensitiveWork(
      [riskRegister],
      async (prompt) =>
        prompt.includes("children, patients, or people at risk") ? "YES" : "NO"
    );

    expect(classification.get("e-1:risks")).toEqual(["vulnerable-people"]);
  });

  it("records work that touches nothing sensitive", async () => {
    const classification = await classifySensitiveWork(
      [newsDigest],
      async () => "NO"
    );

    expect(classification.get("e-1:news")).toEqual([]);
  });

  it("leaves a Function unclassified when a call fails, without losing the others", async () => {
    const classification = await classifySensitiveWork(
      [riskRegister, newsDigest],
      async (prompt) => {
        if (prompt.includes("Risk Register")) throw new Error("model down");
        return "NO";
      }
    );

    expect(classification.get("e-1:risks")).toBeUndefined();
    expect(classification.get("e-1:news")).toEqual([]);
  });
});

describe("requiresHumanApproval", () => {
  it("requires approval when any category was answered yes", async () => {
    const classification = await classifySensitiveWork(
      [riskRegister],
      async (prompt) =>
        prompt.includes("children, patients, or people at risk") ? "YES" : "NO"
    );

    expect(requiresHumanApproval("e-1:risks", classification)).toBe(true);
  });

  it("does not require approval when every category was answered no", async () => {
    const classification = await classifySensitiveWork([newsDigest], async () => "NO");

    expect(requiresHumanApproval("e-1:news", classification)).toBe(false);
  });

  it("fails closed for a Function that could not be classified", async () => {
    const classification = await classifySensitiveWork([newsDigest], async () => {
      throw new Error("model down");
    });

    expect(requiresHumanApproval("e-1:news", classification)).toBe(true);
  });

  it("fails closed when there is no classification at all", () => {
    expect(requiresHumanApproval("e-1:news", undefined)).toBe(true);
  });
});

describe("describeSensitiveWork", () => {
  it("says plainly why a person is needed", () => {
    expect(
      describeSensitiveWork("Risk Register", ["vulnerable-people"])
    ).toBe(
      "Risk Register touches children or people at risk, so a person must approve its work rather than an AI Worker alone."
    );
  });

  it("reads as a sentence when several categories apply", () => {
    expect(
      describeSensitiveWork("Parent Communication", [
        "vulnerable-people",
        "legal-or-regulatory",
        "published-in-the-enterprise-name",
      ])
    ).toContain(
      "touches children or people at risk, a legal or regulatory obligation and anything published in the business's name"
    );
  });

  it("is honest when it could not establish the answer", () => {
    expect(describeSensitiveWork("Risk Register", [])).toContain(
      "could not establish"
    );
  });
});
