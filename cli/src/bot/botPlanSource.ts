import type { WorkStreamEntry } from "../ui/uiState";

/**
 * A line of a scenario plan.
 *
 * The plan format is the expect harness's, unchanged, so the 50+ files in
 * scenario_harness/plans work as they are. `staff` is genuinely better
 * in-process — the reply count is a fact rather than a guess — while `capture`
 * has to match the *rendered* text, because that is what the patterns were
 * written against. See `captureFromEntries`.
 */
export type BotPlanDirective =
  | { readonly kind: "line"; readonly line: string }
  | { readonly kind: "wait"; readonly seconds: number }
  | { readonly kind: "note"; readonly text: string }
  | { readonly kind: "staff"; readonly line: string }
  | { readonly kind: "capture"; readonly name: string; readonly pattern: string }
  | { readonly kind: "timeout" }
  | { readonly kind: "unsupported"; readonly directive: string };

/**
 * Parses a plan file.
 *
 * PURE: No side effects.
 */
export function parseBotPlan(
  text: string
): readonly BotPlanDirective[] {
  const directives: BotPlanDirective[] = [];

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;

    if (!line.startsWith("@")) {
      directives.push({ kind: "line", line });
      continue;
    }

    const [directive, ...rest] = line.split(/\s+/);
    const remainder = line.slice(directive.length).trim();

    if (directive === "@blank") {
      // Enter on its own. A blank line in the file is formatting, skipped
      // above, so an empty answer needs a directive of its own — and every
      // optional prompt now depends on one behaving properly.
      directives.push({ kind: "line", line: "" });
      continue;
    }

    if (directive === "@note") {
      directives.push({ kind: "note", text: remainder });
      continue;
    }
    if (directive === "@wait") {
      const seconds = Number(rest[0]);
      directives.push({
        kind: "wait",
        seconds: Number.isFinite(seconds) ? seconds : 0,
      });
      continue;
    }
    if (directive === "@staff") {
      directives.push({ kind: "staff", line: remainder });
      continue;
    }

    // /next reviews its recommendations one at a time, like /staff, and the
    // model decides how many there are.
    if (directive === "@next") {
      directives.push({ kind: "staff", line: remainder });
      continue;
    }
    if (directive === "@cap") {
      const name = rest[0] ?? "";
      const pattern = remainder.slice(name.length).trim();
      directives.push({
        kind: "capture",
        name,
        pattern: stripSurroundingBraces(pattern),
      });
      continue;
    }
    if (directive === "@timeout") {
      // There is no pty and no expect timeout here: the driver awaits each
      // command for as long as it takes. Kept as a directive so the plans parse
      // unchanged, and announced once per run rather than silently dropped.
      directives.push({ kind: "timeout" });
      continue;
    }

    directives.push({ kind: "unsupported", directive });
  }

  return directives;
}

/** Removes one wrapping `{}` pair, as the expect driver's regex syntax uses. PURE. */
export function stripSurroundingBraces(
  value: string
): string {
  const trimmed = value.trim();
  return trimmed.startsWith("{") && trimmed.endsWith("}")
    ? trimmed.slice(1, -1)
    : trimmed;
}

/**
 * Renders `{{VAR}}` placeholders.
 *
 * An uncaptured variable falls back to the doc-style placeholder — TASK_ID
 * becomes `<task-id>` — so a step that failed to capture reads exactly like
 * following the written scenario literally, and fails the same way.
 *
 * PURE: No side effects.
 */
export function substituteBotPlanVariables(
  line: string,
  variables: ReadonlyMap<string, string>
): string {
  return line.replace(
    /\{\{([A-Za-z0-9_]+)\}\}/g,
    (_match, name: string) =>
      variables.get(name) ?? `<${name.toLowerCase().replace(/_/g, "-")}>`
  );
}

/**
 * Applies an `@cap` pattern to the entries a command produced.
 *
 * Matched against the *rendered* text, not the raw entry bodies. That
 * distinction is not cosmetic: a raw body reads `Worker: Publication
 * Researcher`, and the display formatter turns it into the aligned
 * `Worker                 Publication Researcher` columns. Every pattern in the
 * existing plans was written against what the operator sees, so a pattern like
 * `Worker\s+(...)` matches the rendered form and silently fails on the raw one.
 *
 * The bot still avoids the expect driver's real problem — ANSI escapes and
 * spinner frames interleaved into a pty stream — because it renders the entries
 * itself and strips the colour deterministically.
 *
 * PURE: No side effects.
 */
export function captureFromEntries(
  entries: readonly WorkStreamEntry[],
  pattern: string,
  render: (entry: WorkStreamEntry) => string = (entry) =>
    `${entry.label}\n${entry.body}`
): string | undefined {
  const text = entries.map(render).map(stripAnsi).join("\n");
  const match = new RegExp(pattern).exec(text);
  return match?.[1] ?? match?.[0];
}

/** Removes colour codes so a pattern matches the words, not the escapes. PURE. */
export function stripAnsi(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/\u001b\[[0-9;]*[A-Za-z]/g, "");
}

/** Whether a plan starts by erasing the installation. PURE. */
export function planResetsState(
  directives: readonly BotPlanDirective[]
): boolean {
  return directives
    .slice(0, 4)
    .some(
      (directive) =>
        directive.kind === "line" &&
        directive.line.trim().toLowerCase().startsWith("/reset")
    );
}
