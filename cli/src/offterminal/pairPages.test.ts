import { describe, expect, it } from "vitest";

import { handlePairRoute, escapeHtml } from "./pairPages";

describe("pairing pages", () => {
  it("shows only the ended wording for a bad link, and never says passkey, approve, phone or desk", async () => {
    const ended = await handlePairRoute({
      action: "page",
      token: "not-a-real-token-xxxxx",
      method: "GET",
      body: "",
    });
    expect(ended.status).toBe(404);
    expect(ended.body).toContain("This link no longer works");
    expect(ended.body).not.toMatch(/passkey|approve|phone|desk/i);
    expect(ended.body).not.toMatch(/Priya|Kevin|Harbour/i);
  });

  it("escapes draft text so it cannot inject a link or markup", () => {
    expect(escapeHtml('<a href="https://evil.example">x</a>')).toBe(
      "&lt;a href=&quot;https://evil.example&quot;&gt;x&lt;/a&gt;"
    );
  });
});
