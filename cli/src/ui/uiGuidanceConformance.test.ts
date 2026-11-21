import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guidance a primary command prints to the operator must not teach a
 * deprecated alias or a command Arturo does not implement.
 *
 * Three separate walkthroughs found the same class of defect in three
 * different files: `/job start` in the post-staffing hint, then in the
 * `/overview` next-move line, then in the `/overview` empty-state welcome.
 * Fixing them one at a time did not stop the next one appearing, because each
 * lives in its own file and each looks correct in isolation.
 */

const uiDirectory = join(process.cwd(), "src", "ui");

/** Files that legitimately document the deprecated commands themselves. */
const catalogFiles: ReadonlySet<string> = new Set([
  "uiCommandHelp.ts",
  "uiCommandLongHelp.ts",
  "uiRuntimeCommandHandlers.ts",
]);

/** Commands Arturo does not implement, or implements only as a legacy alias. */
const forbiddenGuidance: readonly { readonly pattern: RegExp; readonly why: string }[] = [
  { pattern: /\/job\s+(?:start|create|inspect|update|list)\b/, why: "/job is a deprecated alias for /function" },
  { pattern: /\/jobs\b/, why: "/jobs is a deprecated alias for /functions" },
  { pattern: /\/runtime\s+(?:start|inspect)\b/, why: "/runtime is a deprecated alias for /function" },
  { pattern: /\/task-cap\b/, why: "/task-cap is a deprecated alias for /task create" },
  { pattern: /\/refine-task\b/, why: "/refine-task has no handler at all" },
  { pattern: /\/task-detail\b/, why: "/task-detail is absent from /help; use /task inspect" },
];

function readGuidanceFiles(): readonly { readonly name: string; readonly body: string }[] {
  return readdirSync(uiDirectory)
    .filter(
      (name) =>
        name.endsWith(".ts") &&
        !name.endsWith(".test.ts") &&
        !catalogFiles.has(name)
    )
    .sort()
    .map((name) => ({
      name,
      body: readFileSync(join(uiDirectory, name), "utf8"),
    }));
}

describe("operator-facing guidance", () => {
  it.each(forbiddenGuidance)(
    "never recommends $why",
    ({ pattern, why }) => {
      for (const file of readGuidanceFiles()) {
        for (const [index, line] of file.body.split("\n").entries()) {
          // Only string literals reach the operator. A command name used as a
          // dispatch condition, an object key in a lookup table, a comment, or
          // a deprecated command documenting its own syntax is not guidance.
          const isComment = /^\s*(?:\/\/|\*)/.test(line);
          const isLookupKey = /^\s*"\/[a-z-]+":/.test(line);
          const isMarkedLegacyUsage =
            file.body
              .split("\n")
              .slice(Math.max(0, index - 8), index)
              .some((previous) => previous.includes("legacy-usage:"));

          if (
            !/["'`]/.test(line) ||
            isComment ||
            isLookupKey ||
            isMarkedLegacyUsage
          ) {
            continue;
          }

          if (
            pattern.test(line) &&
            !/command ===|=== "\//.test(line)
          ) {
            expect.fail(
              `${file.name}:${index + 1} recommends a command it should not — ${why}\n  ${line.trim()}`
            );
          }
        }
      }
    }
  );
});
