import { describe, expect, it } from "vitest";

import {
  LISTENER_FORBIDDEN_BODY,
  OFF_TERMINAL_MAX_REQUESTS_PER_MINUTE,
  OFF_TERMINAL_MAX_REQUESTS_PER_TOKEN_PER_MINUTE,
  ListenerRateLimiter,
  decideSignOffListenerRequest,
  isLoopbackAddress,
  parseAllowedRoute,
  responseForDecision,
} from "./listenerRequest";

const TOKEN = "abcdefghijklmnopqrstuvwxyz012345";
const ENV = { PUBLIC_BASE_URL: "https://signoff.example.com" };
const BASE = {
  remoteAddress: "127.0.0.1",
  method: "GET",
  url: `/sign-off/${TOKEN}`,
  headers: { host: "signoff.example.com" },
  env: ENV,
};

describe("isLoopbackAddress", () => {
  it("accepts only loopback addresses", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("127.0.0.2")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1".toUpperCase())).toBe(true);
    expect(isLoopbackAddress(undefined)).toBe(false);
    expect(isLoopbackAddress("")).toBe(false);
    expect(isLoopbackAddress("0.0.0.0")).toBe(false);
    expect(isLoopbackAddress("8.8.8.8")).toBe(false);
    expect(isLoopbackAddress("192.168.1.10")).toBe(false);
    expect(isLoopbackAddress("::2")).toBe(false);
  });
});

describe("parseAllowedRoute", () => {
  it("allows only pairing and one-result sign-off or set-aside", () => {
    expect(parseAllowedRoute("GET", `/pair/${TOKEN}`)).toEqual({
      kind: "pair",
      token: TOKEN,
      action: "page",
    });
    expect(parseAllowedRoute("POST", `/pair/${TOKEN}/verify`)).toEqual({
      kind: "pair",
      token: TOKEN,
      action: "verify",
    });
    expect(parseAllowedRoute("GET", `/sign-off/${TOKEN}`)).toEqual({
      kind: "sign-off",
      token: TOKEN,
      action: "page",
    });
    expect(parseAllowedRoute("POST", `/sign-off/${TOKEN}/set-aside`)).toEqual({
      kind: "sign-off",
      token: TOKEN,
      action: "set-aside",
    });
  });

  it("does not offer host-only steps, the old company page, or a short token", () => {
    expect(parseAllowedRoute("GET", "/switch-on")).toBeUndefined();
    expect(parseAllowedRoute("POST", "/enrol/start")).toBeUndefined();
    expect(parseAllowedRoute("POST", "/confirm")).toBeUndefined();
    expect(parseAllowedRoute("POST", "/stand-in")).toBeUndefined();
    expect(parseAllowedRoute("GET", "/company/index.html")).toBeUndefined();
    expect(parseAllowedRoute("GET", "/office")).toBeUndefined();
    expect(parseAllowedRoute("GET", `/sign-off/${TOKEN}/../../company`)).toBeUndefined();
    expect(parseAllowedRoute("GET", "/sign-off/short")).toBeUndefined();
    expect(parseAllowedRoute("PUT", `/sign-off/${TOKEN}`)).toBeUndefined();
  });
});

describe("decideSignOffListenerRequest", () => {
  it("rejects a non-loopback socket and never treats loopback as being at the host computer", () => {
    const rejected = decideSignOffListenerRequest({ ...BASE, remoteAddress: "8.8.8.8" });
    expect(rejected).toEqual({ kind: "reject-socket" });
    expect(JSON.stringify(responseForDecision(rejected))).not.toMatch(
      /at the host computer|this computer/i
    );
    expect(responseForDecision(rejected)).toEqual({
      status: 403,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: LISTENER_FORBIDDEN_BODY,
    });

    const allowed = decideSignOffListenerRequest(BASE);
    expect(allowed).toEqual({
      kind: "route",
      route: { kind: "sign-off", token: TOKEN, action: "page" },
    });
    expect(JSON.stringify(allowed)).not.toMatch(/at the host computer|this computer/i);
  });

  it("rejects a missing URL, a Host or Origin that does not match, and unknown paths", () => {
    expect(decideSignOffListenerRequest({ ...BASE, env: {} })).toEqual({ kind: "not-found" });
    expect(
      decideSignOffListenerRequest({ ...BASE, headers: { host: "127.0.0.1:3000" } })
    ).toEqual({ kind: "reject-host" });
    expect(
      decideSignOffListenerRequest({
        ...BASE,
        method: "POST",
        url: `/sign-off/${TOKEN}/set-aside`,
        headers: { host: "signoff.example.com", origin: "https://evil.example" },
      })
    ).toEqual({ kind: "reject-origin" });
    expect(
      decideSignOffListenerRequest({
        ...BASE,
        method: "POST",
        url: `/sign-off/${TOKEN}/set-aside`,
        headers: { host: "signoff.example.com" },
      })
    ).toEqual({ kind: "reject-origin" });
    expect(decideSignOffListenerRequest({ ...BASE, url: "/company/index.html" })).toEqual({
      kind: "not-found",
    });
  });

  it("allows a same-origin POST and a navigation GET with no Origin", () => {
    expect(
      decideSignOffListenerRequest({
        ...BASE,
        method: "POST",
        url: `/sign-off/${TOKEN}/sign-off`,
        headers: { host: "signoff.example.com", origin: "https://signoff.example.com" },
      })
    ).toEqual({
      kind: "route",
      route: { kind: "sign-off", token: TOKEN, action: "sign-off" },
    });
    expect(decideSignOffListenerRequest(BASE).kind).toBe("route");
  });

  it("limits request rates globally and per token", () => {
    const limiter = new ListenerRateLimiter(() => 1_000_000);
    for (let i = 0; i < OFF_TERMINAL_MAX_REQUESTS_PER_MINUTE; i += 1) {
      const decision = decideSignOffListenerRequest({
        ...BASE,
        url: `/sign-off/${TOKEN.slice(0, -2)}${String(i).padStart(2, "0")}`,
        rateLimiter: limiter,
        now: 1_000_000,
      });
      expect(decision.kind).toBe("route");
    }
    expect(
      decideSignOffListenerRequest({
        ...BASE,
        url: `/sign-off/${TOKEN}`,
        rateLimiter: limiter,
        now: 1_000_000,
      })
    ).toEqual({ kind: "rate-limited", retryAfterSec: 60 });

    const perToken = new ListenerRateLimiter(() => 2_000_000);
    for (let i = 0; i < OFF_TERMINAL_MAX_REQUESTS_PER_TOKEN_PER_MINUTE; i += 1) {
      expect(
        decideSignOffListenerRequest({
          ...BASE,
          rateLimiter: perToken,
          now: 2_000_000,
        }).kind
      ).toBe("route");
    }
    const limited = decideSignOffListenerRequest({
      ...BASE,
      rateLimiter: perToken,
      now: 2_000_000,
    });
    expect(limited).toEqual({ kind: "rate-limited", retryAfterSec: 60 });
    expect(responseForDecision(limited).status).toBe(429);
    expect(responseForDecision(limited).headers["Retry-After"]).toBe("60");
  });
});
