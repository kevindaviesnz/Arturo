/**
 * Request gates for the off-terminal sign-off listener (off-terminal
 * sign-off brief). The socket check only rejects anything that is not
 * loopback. It never treats a request as "at the host computer".
 *
 * PURE: Decision helpers have no side effects. The rate limiter stores
 * counts in memory only.
 */

import net from "node:net";

import { parsePublicBaseUrl } from "./publicBaseUrl";

/** Global cap on requests to the sign-off listener in any rolling minute. */
export const OFF_TERMINAL_MAX_REQUESTS_PER_MINUTE = 60;

/** Cap on requests for one link token in any rolling minute. */
export const OFF_TERMINAL_MAX_REQUESTS_PER_TOKEN_PER_MINUTE = 20;

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;
const MINUTE_MS = 60 * 1000;
const SAFE_METHODS = new Set(["GET", "HEAD"]);

export type AllowedRouteKind = "pair" | "sign-off";

export type AllowedRoute = {
  readonly kind: AllowedRouteKind;
  readonly token: string;
  readonly action: string;
};

export type ListenerDecision =
  | { readonly kind: "reject-socket" }
  | { readonly kind: "reject-host" }
  | { readonly kind: "reject-origin" }
  | { readonly kind: "rate-limited"; readonly retryAfterSec: number }
  | { readonly kind: "not-found" }
  | { readonly kind: "route"; readonly route: AllowedRoute };

export type ListenerRequestInput = {
  readonly remoteAddress?: string;
  readonly method: string;
  readonly url: string;
  readonly headers: {
    readonly host?: string;
    readonly origin?: string;
  };
  readonly env?: NodeJS.ProcessEnv;
  readonly rateLimiter?: ListenerRateLimiter;
  readonly now?: number;
};

/** True only for IPv4 loopback or IPv6 loopback, including the IPv4-mapped form. */
export function isLoopbackAddress(address: string | undefined): boolean {
  if (!address) {
    return false;
  }
  let value = address.trim().toLowerCase();
  if (value.startsWith("::ffff:")) {
    value = value.slice("::ffff:".length);
  }
  if (value === "127.0.0.1" || value === "::1") {
    return true;
  }
  if (net.isIPv4(value)) {
    return value.startsWith("127.");
  }
  return net.isIP(value) === 6 && (value === "0:0:0:0:0:0:0:1" || value === "::1");
}

const PAIR_ACTIONS = new Set(["", "options", "verify"]);
const SIGN_OFF_ACTIONS = new Set(["", "options", "verify", "sign-off", "set-aside"]);

/**
 * Classifies a path as pairing or one-result sign-off / set-aside.
 * Host-only steps (starting enrolment, confirming a credential, naming
 * stand-ins, switching the path on) are not routes here.
 */
export function parseAllowedRoute(method: string, requestUrl: string): AllowedRoute | undefined {
  const verb = method.toUpperCase();
  if (verb !== "GET" && verb !== "HEAD" && verb !== "POST") {
    return undefined;
  }

  let pathname: string;
  try {
    pathname = new URL(requestUrl, "http://127.0.0.1").pathname;
  } catch {
    return undefined;
  }

  const parts = pathname.split("/").filter((part) => part.length > 0);
  if (parts.length < 2 || parts.length > 3) {
    return undefined;
  }
  if (parts.some((part) => part === "." || part === ".." || part.includes("\\"))) {
    return undefined;
  }

  const [family, token, action = ""] = parts;
  if (!TOKEN_PATTERN.test(token)) {
    return undefined;
  }

  if (family === "pair" && PAIR_ACTIONS.has(action)) {
    if (action === "" || verb === "POST") {
      return { kind: "pair", token, action: action === "" ? "page" : action };
    }
    return undefined;
  }

  if (family === "sign-off" && SIGN_OFF_ACTIONS.has(action)) {
    if (action === "" || verb === "POST") {
      return { kind: "sign-off", token, action: action === "" ? "page" : action };
    }
    return undefined;
  }

  return undefined;
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function publicOrigin(env: NodeJS.ProcessEnv | undefined): string | undefined {
  const parsed = parsePublicBaseUrl(env?.PUBLIC_BASE_URL);
  return parsed.ok ? parsed.baseUrl : undefined;
}

function hostMatches(hostHeader: string | undefined, origin: string): boolean {
  if (!hostHeader) {
    return false;
  }
  let expected: URL;
  try {
    expected = new URL(origin);
  } catch {
    return false;
  }
  const expectedHost =
    (expected.port && expected.port !== "443" && expected.port !== "80")
      ? `${expected.hostname}:${expected.port}`
      : expected.hostname;
  return hostHeader.trim().toLowerCase() === expectedHost.toLowerCase();
}

function originAllowed(method: string, originHeader: string | undefined, origin: string): boolean {
  if (originHeader === undefined || originHeader === "") {
    return SAFE_METHODS.has(method.toUpperCase());
  }
  return originHeader.trim() === origin;
}

export class ListenerRateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(private readonly clock: () => number = () => Date.now()) {}

  allow(key: string, limit: number, now = this.clock()): boolean {
    const windowStart = now - MINUTE_MS;
    const recent = (this.hits.get(key) ?? []).filter((time) => time > windowStart);
    if (recent.length >= limit) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }
}

function tokenFromUrl(requestUrl: string): string | undefined {
  try {
    const pathname = new URL(requestUrl, "http://127.0.0.1").pathname;
    const parts = pathname.split("/").filter((part) => part.length > 0);
    if (parts.length >= 2 && TOKEN_PATTERN.test(parts[1])) {
      return parts[1];
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Decides whether a request may be handled. A loopback address is never
 * taken as proof that the person is at the host computer.
 */
export function decideSignOffListenerRequest(input: ListenerRequestInput): ListenerDecision {
  if (!isLoopbackAddress(input.remoteAddress)) {
    return { kind: "reject-socket" };
  }

  const now = input.now ?? Date.now();
  const limiter = input.rateLimiter;
  if (limiter) {
    if (!limiter.allow("global", OFF_TERMINAL_MAX_REQUESTS_PER_MINUTE, now)) {
      return { kind: "rate-limited", retryAfterSec: 60 };
    }
    const token = tokenFromUrl(input.url);
    if (
      token &&
      !limiter.allow(`token:${token}`, OFF_TERMINAL_MAX_REQUESTS_PER_TOKEN_PER_MINUTE, now)
    ) {
      return { kind: "rate-limited", retryAfterSec: 60 };
    }
  }

  const origin = publicOrigin(input.env);
  if (!origin) {
    return { kind: "not-found" };
  }

  if (!hostMatches(headerValue(input.headers.host), origin)) {
    return { kind: "reject-host" };
  }

  if (!originAllowed(input.method, headerValue(input.headers.origin), origin)) {
    return { kind: "reject-origin" };
  }

  const route = parseAllowedRoute(input.method, input.url);
  if (!route) {
    return { kind: "not-found" };
  }
  return { kind: "route", route };
}

export const LISTENER_FORBIDDEN_BODY = "Forbidden";
export const LISTENER_NOT_FOUND_BODY = "Not found";

export type ListenerHttpResult = {
  readonly status: number;
  readonly headers: Record<string, string>;
  readonly body: string;
};

export function responseForDecision(decision: ListenerDecision): ListenerHttpResult {
  switch (decision.kind) {
    case "reject-socket":
    case "reject-host":
    case "reject-origin":
      return {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: LISTENER_FORBIDDEN_BODY,
      };
    case "rate-limited":
      return {
        status: 429,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Retry-After": String(decision.retryAfterSec),
        },
        body: LISTENER_FORBIDDEN_BODY,
      };
    case "not-found":
      return {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: LISTENER_NOT_FOUND_BODY,
      };
    case "route":
      // Pages for pairing and sign-off are added in later sub-stages.
      return {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: LISTENER_NOT_FOUND_BODY,
      };
  }
}
