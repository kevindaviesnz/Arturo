/**
 * Formats aligned, fixed-width tables for terminal output.
 *
 * Ad-hoc `padEnd(14)`-style formatting silently breaks alignment as soon as a
 * value is longer than the guessed width, which is what made listings such as
 * `/enterprise list` look ragged. Column widths here are derived from the
 * content actually being printed, so every row lines up regardless of the data.
 */

/** Two spaces read as a column break without wasting terminal width. */
const COLUMN_GAP = "  ";

/** Indent applied to every table line so it sits under its entry heading. */
const TABLE_INDENT = "  ";

/**
 * Formats a header row and body rows as an aligned table.
 *
 * Trailing whitespace is trimmed from each line so copied output stays clean
 * and the renderer does not treat padding as meaningful.
 *
 * PURE: No side effects.
 */
export function formatUiTable(
  headers: readonly string[],
  rows: readonly (readonly string[])[]
): string {
  const widths =
    headers.map(
      (header, column) =>
        Math.max(
          header.length,
          ...rows.map(
            (row) => (row[column] ?? "").length
          )
        )
    );

  return [
    headers,
    ...rows,
  ]
    .map(
      (row) =>
        `${TABLE_INDENT}${row
          .map(
            (cell, column) =>
              column === row.length - 1
                ? cell
                : (cell ?? "").padEnd(widths[column])
          )
          .join(COLUMN_GAP)
          .trimEnd()}`
    )
    .join("\n");
}
