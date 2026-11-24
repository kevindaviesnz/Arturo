import { describe, expect, it } from "vitest";

import {
  PUBLIC_BASE_URL_REFUSAL,
  mayIssueOffTerminalLink,
  parsePublicBaseUrl,
  requirePublicBaseUrl,
} from "./publicBaseUrl";

describe("PUBLIC_BASE_URL", () => {
  it("accepts https:// plus a hostname, as the origin with no trailing slash", () => {
    expect(parsePublicBaseUrl("https://signoff.example.com")).toEqual({
      ok: true,
      baseUrl: "https://signoff.example.com",
    });
    expect(parsePublicBaseUrl("https://signoff.example.com/")).toEqual({
      ok: true,
      baseUrl: "https://signoff.example.com",
    });
    expect(parsePublicBaseUrl("https://signoff.example.com:8443")).toEqual({
      ok: true,
      baseUrl: "https://signoff.example.com:8443",
    });
    expect(parsePublicBaseUrl("https://signoff.example.test")).toEqual({
      ok: true,
      baseUrl: "https://signoff.example.test",
    });
  });

  it("refuses missing, http, an IP, localhost, credentials, a path, or a query", () => {
    const refused = { ok: false, refused: PUBLIC_BASE_URL_REFUSAL };
    expect(parsePublicBaseUrl(undefined)).toEqual(refused);
    expect(parsePublicBaseUrl("")).toEqual(refused);
    expect(parsePublicBaseUrl("http://signoff.example.com")).toEqual(refused);
    expect(parsePublicBaseUrl("https://127.0.0.1")).toEqual(refused);
    expect(parsePublicBaseUrl("https://192.168.1.10")).toEqual(refused);
    expect(parsePublicBaseUrl("https://[::1]")).toEqual(refused);
    expect(parsePublicBaseUrl("https://8.8.8.8")).toEqual(refused);
    expect(parsePublicBaseUrl("https://localhost")).toEqual(refused);
    expect(parsePublicBaseUrl("https://app.localhost")).toEqual(refused);
    expect(parsePublicBaseUrl("https://user:pass@signoff.example.com")).toEqual(refused);
    expect(parsePublicBaseUrl("https://signoff.example.com/sign-off")).toEqual(refused);
    expect(parsePublicBaseUrl("https://signoff.example.com/?q=1")).toEqual(refused);
    expect(parsePublicBaseUrl("https://signoff.example.com/#x")).toEqual(refused);
    expect(parsePublicBaseUrl("not a url")).toEqual(refused);
  });

  it("throws the same refusal when a link would be issued without a valid URL", () => {
    expect(() => requirePublicBaseUrl({})).toThrow(PUBLIC_BASE_URL_REFUSAL);
    expect(mayIssueOffTerminalLink({})).toEqual({
      ok: false,
      refused: PUBLIC_BASE_URL_REFUSAL,
    });
    expect(
      mayIssueOffTerminalLink({ PUBLIC_BASE_URL: "https://signoff.example.com" })
    ).toEqual({ ok: true, baseUrl: "https://signoff.example.com" });
    expect(
      requirePublicBaseUrl({ PUBLIC_BASE_URL: "https://signoff.example.com/" })
    ).toBe("https://signoff.example.com");
  });
});
