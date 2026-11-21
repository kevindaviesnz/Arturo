import { renderEnterprisePrompt } from "../prompts/enterprisePrompt";
/**
 * Turns a guided-setup conversation into a usable Enterprise mission.
 *
 * The mission is not decoration: it is the context every later prompt reads —
 * Function recommendations, staffing proposals, Task suggestions, and Worker
 * instructions. Joining the operator's raw answers with full stops produced
 * missions like "I want to start a sole legal practice specialing in property
 * law. residential. sale and purchasing. no. no." — typos, one-word replies to
 * questions the reader cannot see, and no statement of purpose. Every downstream
 * recommendation inherited that.
 *
 * Synthesis is model-backed, so it can fail. The caller falls back to the raw
 * joined answers rather than blocking Enterprise creation: a poor mission is
 * recoverable with `/enterprise update`, a failed setup is not.
 */

import {
  extractJsonObjectSubstring,
  isUnknownRecord,
  readRequiredString,
  stripNextStepMarkdownFences,
} from "./nextStepAdvisor";

export type MissionConversationTurn = {
  readonly role: "assistant" | "user";
  readonly content: string;
};

/** Longest acceptable mission, so it stays readable wherever it is displayed. */
export const MAX_MISSION_LENGTH = 320;

/**
 * Builds the JSON-only prompt that turns a setup conversation into a mission.
 *
 * The conversation is supplied with both sides intact: a bare "no" is
 * meaningless without the question it answered.
 *
 * PURE: No side effects.
 */
export function buildMissionSynthesisPrompt(
  enterpriseName: string,
  transcript: readonly MissionConversationTurn[]
): string {
  return renderEnterprisePrompt("Enterprise Mission Synthesis", {
    ENTERPRISE_NAME: enterpriseName,
    TRANSCRIPT: transcript
  .map(
    (turn) =>
      `${turn.role === "assistant" ? "Adviser" : "Operator"}: ${turn.content.trim()}`
  )
  .join("\n"),
    MAX_MISSION_LENGTH: MAX_MISSION_LENGTH
  });
}

const NUMBER_WORDS: Readonly<Record<string, string>> = {
  one: "1",
  two: "2",
  three: "3",
  four: "4",
  five: "5",
  six: "6",
  seven: "7",
  eight: "8",
  nine: "9",
  ten: "10",
  eleven: "11",
  twelve: "12",
  fifteen: "15",
  twenty: "20",
  thirty: "30",
  forty: "40",
  fifty: "50",
  sixty: "60",
  seventy: "70",
  eighty: "80",
  ninety: "90",
  hundred: "100",
  thousand: "1000",
};

/**
 * Every quantity a piece of text states, normalised so "six" and "6" match.
 *
 * PURE: No side effects.
 */
function quantitiesIn(
  text: string
): ReadonlySet<string> {
  const found = new Set<string>();

  for (const match of text.toLowerCase().matchAll(/\d[\d,]*|[a-z]+/g)) {
    const token =
      match[0].replace(/,/g, "");

    if (/^\d+$/.test(token)) {
      found.add(token);
      continue;
    }

    const asNumber =
      NUMBER_WORDS[token];

    if (asNumber) {
      found.add(asNumber);
    }
  }

  return found;
}

/**
 * Quantities the mission states that the operator never did.
 *
 * Rule 2 has forbidden invented detail since this prompt was written, and a
 * walkthrough still got "distributing donated food parcels, six days a week"
 * from an operator who said only that they hand out 200 parcels a week. The
 * mission is the context every later prompt reads, so an invented number
 * propagates into Function recommendations, staffing, and Worker instructions.
 *
 * Numbers are the part of this that can be checked rather than asked for.
 *
 * PURE: No side effects.
 */
export function findUnsupportedQuantities(
  mission: string,
  transcript: readonly MissionConversationTurn[]
): readonly string[] {
  const stated =
    quantitiesIn(
      transcript
        .filter((turn) => turn.role === "user")
        .map((turn) => turn.content)
        .join(" ")
    );

  return [
    ...quantitiesIn(mission),
  ].filter(
    (quantity) => !stated.has(quantity)
  );
}

/**
 * Parses and validates a synthesised mission.
 *
 * PURE: No side effects.
 */
export function parseSynthesisedMission(
  response: string,
  transcript: readonly MissionConversationTurn[] = []
): string {
  const parsed: unknown =
    JSON.parse(
      extractJsonObjectSubstring(
        stripNextStepMarkdownFences(
          response
        )
      )
    );

  if (!isUnknownRecord(parsed)) {
    throw new Error(
      "Mission response must be a JSON object."
    );
  }

  const mission =
    readRequiredString(
      parsed,
      "mission"
    )
      .replace(/\s+/g, " ")
      .trim();

  if (mission.length > MAX_MISSION_LENGTH) {
    throw new Error(
      `Mission is longer than ${MAX_MISSION_LENGTH} characters.`
    );
  }

  // A model that echoes the operator's phrasing has not synthesised anything,
  // and the first-person form reads wrongly everywhere the mission is shown.
  if (/^\s*(i|we)\s+(want|would like|plan|am|are)\b/i.test(mission)) {
    throw new Error(
      "Mission repeats the operator's first-person phrasing."
    );
  }

  const invented =
    findUnsupportedQuantities(
      mission,
      transcript
    );

  if (invented.length > 0) {
    throw new Error(
      `Mission states quantities the operator did not: ${invented.join(", ")}.`
    );
  }

  return mission;
}

/**
 * Returns the fallback mission used when synthesis is unavailable.
 *
 * This is the previous behaviour, kept deliberately: an imperfect mission is
 * better than a failed Enterprise creation, and it remains editable.
 *
 * PURE: No side effects.
 */
export function joinAnswersAsMission(
  transcript: readonly MissionConversationTurn[]
): string {
  return transcript
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content.trim())
    .filter(Boolean)
    .join(". ");
}
