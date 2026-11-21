import { describe, expect, it } from "vitest";
import {
  classifyOperatorTurn,
  instructionForOperatorTurn,
} from "./uiAdviseTurnIntent";

describe("classifyOperatorTurn", () => {
  it.each([
    "Can we get on with it?",
    "Just set it up",
    "I've told you everything",
    "That's enough",
    "How many more questions are there?",
    "Stop asking questions",
  ])("treats %s as pushback", (reply) => {
    expect(classifyOperatorTurn(reply)).toBe("pushback");
  });

  it.each([
    "Isn't that what this is meant to be doing?",
    "Why do you need to know that?",
    "What does that mean?",
    "I don't understand",
  ])("treats %s as a question", (reply) => {
    expect(classifyOperatorTurn(reply)).toBe("question");
  });

  it.each([
    "That's about it really. Can we get started?",
    "That's everything.",
    "That's all I've got.",
    "I'm done.",
    "Nothing else.",
    "Yes, let's go.",
    "Sounds good, go ahead.",
    "Shall we begin?",
    "You have enough now I think",
  ])("treats %s as a finished conversation, not another answer", (reply) => {
    expect(classifyOperatorTurn(reply)).toBe("complete");
  });

  it.each([
    "A notebook and my memory basically",
    "residential",
    "Steady enough, busier in December",
    "Me full time plus Jess three days",
  ])("treats %s as an ordinary answer", (reply) => {
    expect(classifyOperatorTurn(reply)).toBe("answer");
  });

  it("treats a hurry-up phrased as a question as pushback, not a question", () => {
    expect(
      classifyOperatorTurn("Can we get on with it? I don't see the point")
    ).toBe("pushback");
  });

  it("ignores surrounding whitespace", () => {
    expect(classifyOperatorTurn("   just do it   ")).toBe("pushback");
  });
});

describe("instructionForOperatorTurn", () => {
  it("tells the adviser to stop and finish on pushback", () => {
    const instruction = instructionForOperatorTurn("pushback");

    expect(instruction).toContain("Do not ask another question");
    expect(instruction).toContain("READY");
  });

  it("tells the adviser to answer before continuing on a question", () => {
    expect(instructionForOperatorTurn("question")).toContain(
      "Answer it plainly"
    );
  });

  it("gives the adviser the answer to the obvious question", () => {
    expect(instructionForOperatorTurn("question")).toContain(
      "Arturo will organise this business"
    );
  });

  it("tells the adviser to thank and finish when the operator is done", () => {
    const instruction = instructionForOperatorTurn("complete");

    expect(instruction).toContain("Do not ask another question");
    expect(instruction).toContain("READY");
  });

  it.each(["complete", "pushback"] as const)(
    "asks for the one missing thing instead of faking a stop when %s arrives too early",
    (intent) => {
      const instruction = instructionForOperatorTurn(intent, false);

      expect(instruction).toContain("one more thing");
      expect(instruction).toContain("single most important question");
      expect(instruction).not.toContain("READY");
    }
  );

  it("leaves an ordinary answer to the normal instruction", () => {
    expect(instructionForOperatorTurn("answer")).toBeUndefined();
  });
});
