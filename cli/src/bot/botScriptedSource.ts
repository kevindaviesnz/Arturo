import type { BotAction, BotInputSource, BotTurnContext } from "./botDriver";
import type { WorkStreamEntry } from "../ui/uiState";

import {
  captureFromEntries,
  substituteBotPlanVariables,
  type BotPlanDirective,
} from "./botPlanSource";

/**
 * Turns a parsed plan into the actions the driver performs.
 *
 * `@cap` is resolved against the previous turn's entries, which is why the
 * capture directive appears *before* the command it captures from in a plan:
 * the driver applies it to whatever the next submitted line returns.
 */
export function createBotScriptedSource(
  directives: readonly BotPlanDirective[],
  describe: string,
  render?: (entry: WorkStreamEntry) => string
): BotInputSource {
  let index = 0;
  const variables = new Map<string, string>();
  let pendingCapture: { name: string; pattern: string } | undefined;
  let announcedTimeout = false;

  return {
    describe,
    async next(context: BotTurnContext): Promise<BotAction | undefined> {
      // Apply a capture armed before the line that just ran.
      if (pendingCapture && context.last) {
        const captured = captureFromEntries(
          context.last.entries,
          pendingCapture.pattern,
          render
        );
        if (captured) variables.set(pendingCapture.name, captured);
        pendingCapture = undefined;
      }

      while (index < directives.length) {
        const directive = directives[index];
        index += 1;

        if (directive.kind === "note") {
          return { kind: "note", text: directive.text };
        }
        if (directive.kind === "wait") {
          return { kind: "wait", seconds: directive.seconds };
        }
        if (directive.kind === "capture") {
          pendingCapture = {
            name: directive.name,
            pattern: directive.pattern,
          };
          continue;
        }
        if (directive.kind === "timeout") {
          // Skipped in silence. @timeout is a harness instruction that belongs
          // to the plan, not something the operator typed, and bot mode's
          // handling of it — wait for the command to finish — is what anyone
          // would expect anyway. Announcing it put the word "Bot" on screen
          // to explain a non-event, which is noise in a session being watched
          // and worse in one being filmed.
          continue;
        }
        if (directive.kind === "unsupported") {
          return {
            kind: "note",
            text: `Skipping ${directive.directive} — bot mode does not understand that instruction.`,
          };
        }
        if (directive.kind === "staff") {
          return {
            kind: "staff",
            line: substituteBotPlanVariables(directive.line, variables),
          };
        }
        return {
          kind: "line",
          line: substituteBotPlanVariables(directive.line, variables),
        };
      }

      return undefined;
    },
  };
}
