import { describe, expect, it } from "vitest";
import {
  createLineInterfacePalette,
  formatLineInterfaceBanner,
  formatLineInterfaceDisplayEntry,
  formatLineInterfaceEntry,
  formatLineInterfaceText,
  resolveLineInterfaceTheme,
} from "./lineInterface";

describe("lineInterface", () => {
  it("removes Blessed markup without changing copyable content", () => {
    expect(formatLineInterfaceText('{cyan-fg}Function {bold}job-1{/bold}{/cyan-fg}')).toBe("Function job-1");
    // A supplied JSON document is not markup. Its objects were being deleted.
    const json = '{ "popularity": {"metric": "youtube_views", "value": 484000}, "examples": [{"url": "https://www.youtube.com/watch?v=yv1"}] }';
    expect(formatLineInterfaceText(`{gray-fg}${json}{/gray-fg}`)).toBe(json);
  });

  it("formats scrollback-friendly success and failure entries", () => {
    expect(formatLineInterfaceEntry({ actor: "Arturo", label: "Function created", body: "ID: job-1" }))
      .toBe("◆ Function created\nID: job-1");
    expect(formatLineInterfaceEntry({ actor: "Arturo", label: "Staffing plan failed", body: "Invalid plan" }))
      .toBe("× Staffing plan failed\nInvalid plan");
    expect(formatLineInterfaceEntry({ actor: "", label: "", body: "ID: job-1" }))
      .toBe("◆ Task detail\nID: job-1");
  });

  it("formats a borderless Arturo header", () => {
    const banner =
      formatLineInterfaceBanner(
        80
      );

    expect(banner).toContain("◆  A  R  T  U  R  O");
    expect(banner).toContain("THE OPERATING SYSTEM FOR AI-NATIVE COMPANIES");
    expect(banner).toContain("/overview to begin");
    expect(banner).not.toMatch(/[╭╮╰╯│├┤]/);
  });

  it("keeps the header inside a narrow terminal", () => {
    const lines =
      formatLineInterfaceBanner(
        40
      ).split("\n");

    expect(lines.every((line) => line.length <= 40)).toBe(true);
    expect(lines.some((line) => line.includes("A  R  T  U  R  O"))).toBe(true);
    expect(lines.some((line) => line.includes("AI-NATIVE COMPANY OS"))).toBe(true);
  });

  it("formats the complete command output hierarchy", () => {
    expect(
      formatLineInterfaceDisplayEntry({
        actor: "Arturo",
        label: "Enterprise created",
        body: [
          "Enterprise created.",
          "",
          "  Name:        Koru Toys",
          "  Status:      active",
        ].join("\n"),
      })
    ).toBe([
      "◆ Enterprise created",
      "Name          Koru Toys",
      "Status        active",
    ].join("\n"));
  });

  it("keeps values in one column when labels differ in length", () => {
    const lines = formatLineInterfaceDisplayEntry({
      actor: "Arturo",
      label: "Function",
      body: [
        "  Name:                     Curriculum Development",
        "  Objective:                Teach through play",
        "  Staffed Worker capability: analysis",
      ].join("\n"),
    }).split("\n");

    const valueColumns = [
      lines[1].indexOf("Curriculum Development"),
      lines[2].indexOf("Teach through play"),
      lines[3].indexOf("analysis"),
    ];

    expect(new Set(valueColumns).size).toBe(1);
  });

  it("formats numbered rows and Markdown without visible markup", () => {
    expect(
      formatLineInterfaceDisplayEntry({
        actor: "Arturo",
        label: "Business Functions",
        body: [
          "Business Functions",
          "",
          "1. Resource Development",
          "2. **Curriculum Development**",
        ].join("\n"),
      })
    ).toBe([
      "◆ Business Functions",
      "1. Resource Development",
      "2. Curriculum Development",
    ].join("\n"));
  });

  it("selects light and dark palettes from terminal settings", () => {
    expect(
      resolveLineInterfaceTheme({
        ARTURO_TERMINAL_THEME: "light",
      })
    ).toBe("light");
    expect(
      resolveLineInterfaceTheme({
        ARTURO_TERMINAL_THEME: "dark",
      })
    ).toBe("dark");
    expect(
      resolveLineInterfaceTheme({
        COLORFGBG: "0;15",
      })
    ).toBe("light");
    expect(
      resolveLineInterfaceTheme({
        COLORFGBG: "15;0",
      })
    ).toBe("dark");
    expect(
      resolveLineInterfaceTheme({})
    ).toBe("adaptive");
  });

  it("uses the terminal foreground for body text in every theme", () => {
    expect(
      createLineInterfacePalette(
        "dark"
      ).text
    ).toBe("\u001b[39m");
    expect(
      createLineInterfacePalette(
        "light"
      ).text
    ).toBe("\u001b[39m");
    expect(
      createLineInterfacePalette(
        "adaptive"
      ).text
    ).toBe("\u001b[39m");
  });
});
