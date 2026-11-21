import { describe, expect, it } from "vitest";
import { formatUiTable } from "./uiTable";

describe("formatUiTable", () => {
  it("aligns every column to its widest cell", () => {
    const lines = formatUiTable(
      ["ID", "Name", "Status"],
      [
        ["enterprise-1", "Koru Toys", "active"],
        ["enterprise-22", "A Much Longer Enterprise Name", "paused"],
      ]
    ).split("\n");

    const statusColumns = lines.map((line) => line.indexOf("active") >= 0
      ? line.indexOf("active")
      : line.indexOf("paused") >= 0
        ? line.indexOf("paused")
        : line.indexOf("Status"));

    expect(new Set(statusColumns).size).toBe(1);
  });

  it("keeps the header aligned with the rows", () => {
    const [header, row] = formatUiTable(
      ["ID", "Name"],
      [["enterprise-1", "Koru Toys"]]
    ).split("\n");

    expect(header.indexOf("Name")).toBe(row.indexOf("Koru Toys"));
  });

  it("does not leave trailing whitespace", () => {
    const lines = formatUiTable(
      ["ID", "Name"],
      [["a", "short"], ["bbbb", "much longer value"]]
    ).split("\n");

    lines.forEach((line) => expect(line).toBe(line.trimEnd()));
  });

  it("indents the table under its heading", () => {
    const [header] = formatUiTable(["ID"], [["a"]]).split("\n");

    expect(header.startsWith("  ")).toBe(true);
  });

  it("tolerates rows with missing trailing cells", () => {
    expect(() =>
      formatUiTable(["ID", "Name", "Status"], [["a", "b"]])
    ).not.toThrow();
  });
});
