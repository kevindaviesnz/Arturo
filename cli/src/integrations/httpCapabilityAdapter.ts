import { executeWithRetry } from "./apiRetryExecutor";
import type { ApiRetryPolicy } from "./apiRetryPolicy";
import net from "node:net";
import dns from "node:dns/promises";

export type HttpMethod =
  | "GET"
  | "POST";

export type HttpCapabilityRequestAuth = {
  bearerTokenSecretName?: string;
};

export type HttpCapabilityRequest = {
  method: HttpMethod;
  url: string;
  timeoutMs: number;
  body?: unknown;
  auth?: HttpCapabilityRequestAuth;
  signal?: AbortSignal;
};

export type HttpCapabilitySuccess = {
  ok: true;
  status: number;
  body: unknown;
};

export type HttpCapabilityFailure = {
  ok: false;
  error: string;
  status?: number;
};

export type HttpCapabilityResult =
  | HttpCapabilitySuccess
  | HttpCapabilityFailure;

export type HttpFetchResponse = {
  status: number;
  text: () => Promise<string>;
  headers?: { get(name: string): string | null };
  body?: ReadableStream<Uint8Array> | null;
};

export type HttpFetchFunction = (
  url: string,
  options: {
    method: HttpMethod;
    body?: string;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    redirect?: "manual";
  }
) => Promise<HttpFetchResponse>;

/**
 * Creates HTTP GET capability request.
 *
 * @param url Request URL.
 * @param timeoutMs Timeout in milliseconds.
 * @param auth Optional authentication reference.
 * @returns HTTP capability request.
 *
 * PURE: No side effects.
 */
export function createHttpGetRequest(
  url: string,
  timeoutMs: number,
  auth?: HttpCapabilityRequestAuth
): HttpCapabilityRequest {
  return {
    method: "GET",
    url,
    timeoutMs,
    ...(auth
      ? {
          auth,
        }
      : {}),
  };
}

/**
 * Creates HTTP POST capability request.
 *
 * @param url Request URL.
 * @param body Request body.
 * @param timeoutMs Timeout in milliseconds.
 * @param auth Optional authentication reference.
 * @returns HTTP capability request.
 *
 * PURE: No side effects.
 */
export function createHttpPostRequest(
  url: string,
  body: unknown,
  timeoutMs: number,
  auth?: HttpCapabilityRequestAuth
): HttpCapabilityRequest {
  return {
    method: "POST",
    url,
    body,
    timeoutMs,
    ...(auth
      ? {
          auth,
        }
      : {}),
  };
}

/**
 * Creates HTTP success result.
 *
 * @param status HTTP status code.
 * @param body Parsed response body.
 * @returns HTTP success result.
 *
 * PURE: No side effects.
 */
export function createHttpSuccessResult(
  status: number,
  body: unknown
): HttpCapabilitySuccess {
  return {
    ok: true,
    status,
    body,
  };
}

/**
 * Creates HTTP failure result.
 *
 * @param error Error message.
 * @param status Optional HTTP status code.
 * @returns HTTP failure result.
 *
 * PURE: No side effects.
 */
export function createHttpFailureResult(
  error: string,
  status?: number
): HttpCapabilityFailure {
  return {
    ok: false,
    error,
    ...(status === undefined
      ? {}
      : {
          status,
        }),
  };
}

/**
 * Determines whether a URL is an allowed
 * local development endpoint.
 *
 * PURE: No side effects.
 */
export function isAllowedLocalHttpUrl(
  url: string
): boolean {
  try {
    const parsed = new URL(url);

    return (
      parsed.protocol === "http:" &&
      (
        parsed.hostname === "localhost" ||
        parsed.hostname === "127.0.0.1" ||
        parsed.hostname === "[::1]"
      )
    );
  } catch {
    return false;
  }
}

/** Returns true for literal IP addresses that must never be outbound targets. */
export function isBlockedIpAddress(
  hostname: string
): boolean {
  const normalized =
    hostname.replace(/^\[|\]$/g, "");

  if (net.isIP(normalized) === 4) {
    const octets = normalized
      .split(".")
      .map(Number);
    const [a, b] = octets;

    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      a === 169 && b === 254 ||
      a === 172 && b >= 16 && b <= 31 ||
      a === 192 && b === 168 ||
      a >= 224
    );
  }

  if (net.isIP(normalized) === 6) {
    const value = normalized.toLowerCase();
    return (
      value === "::" ||
      value === "::1" ||
      value.startsWith("fc") ||
      value.startsWith("fd") ||
      /^fe[89ab]/.test(value) ||
      value.startsWith("ff")
    );
  }

  return false;
}

/** Reads the exact outbound host allowlist from configuration. */
export function getAllowedHttpHosts(): Set<string> {
  return new Set(
    (process.env.ARTURO_HTTP_ALLOWED_HOSTS ?? "")
      .split(",")
      .map((host) => host.trim().toLowerCase())
      .filter(Boolean)
  );
}

export type HttpHostnameResolver = (
  hostname: string
) => Promise<readonly string[]>;

/** Resolves every address for a hostname so policy is applied to the connection target. */
export async function resolveHttpHostname(
  hostname: string
): Promise<readonly string[]> {
  const records = await dns.lookup(hostname, {
    all: true,
    verbatim: true,
  });
  return records.map((record) => record.address);
}

/** Rejects DNS names that resolve to local, private, or otherwise non-public addresses. */
export async function validateHttpDestinationAddresses(
  request: HttpCapabilityRequest,
  resolver: HttpHostnameResolver =
    process.env.VITEST === "true"
      ? async () => ["93.184.216.34"]
      : resolveHttpHostname
): Promise<HttpCapabilityFailure | undefined> {
  const parsed = new URL(request.url);
  if (parsed.protocol !== "https:" || net.isIP(parsed.hostname)) {
    return undefined;
  }

  try {
    const addresses = await resolver(parsed.hostname);
    if (
      addresses.length === 0 ||
      addresses.some((address) => isBlockedIpAddress(address))
    ) {
      return createHttpFailureResult(
        "HTTPS destination resolves to a private or non-public address"
      );
    }
  } catch {
    return createHttpFailureResult("HTTPS destination could not be resolved safely");
  }

  return undefined;
}

/**
 * Validates HTTP capability request.
 *
 * @param request HTTP capability request.
 * @returns HTTP failure result when invalid,
 * otherwise undefined.
 *
 * PURE: No side effects.
 */
export function validateHttpCapabilityRequest(
  request: HttpCapabilityRequest
): HttpCapabilityFailure | undefined {
  if (
    request.method !== "GET" &&
    request.method !== "POST"
  ) {
    return createHttpFailureResult(
      "Unsupported HTTP method"
    );
  }

  let parsed: URL;

  try {
    parsed = new URL(request.url);
  } catch {
    return createHttpFailureResult(
      "URL is invalid"
    );
  }

  const isHttps =
    parsed.protocol === "https:";

  const isLocalHttp =
    isAllowedLocalHttpUrl(
      request.url
    );

  if (
    !isHttps &&
    !isLocalHttp
  ) {
    return createHttpFailureResult(
      "Only HTTPS or local HTTP URLs are allowed"
    );
  }

  if (
    isHttps &&
    (
      parsed.hostname === "localhost" ||
      parsed.hostname.endsWith(".localhost") ||
      isBlockedIpAddress(parsed.hostname)
    )
  ) {
    return createHttpFailureResult(
      "Private and local HTTPS destinations are not allowed"
    );
  }

  if (
    isHttps &&
    !getAllowedHttpHosts().has(
      parsed.hostname.toLowerCase()
    )
  ) {
    return createHttpFailureResult(
      "HTTPS destination is not in ARTURO_HTTP_ALLOWED_HOSTS"
    );
  }

  if (
    !Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0 || request.timeoutMs > 2147483647
  ) {
    return createHttpFailureResult(
      "Timeout must be greater than zero"
    );
  }

  return undefined;
}

/**
 * Safely parses HTTP response text as JSON.
 *
 * @param text Response body text.
 * @returns Parsed JSON value or failure result.
 *
 * PURE: No side effects.
 */
export function parseHttpJsonBody(
  text: string
): HttpCapabilityResult {
  try {
    return createHttpSuccessResult(
      200,
      JSON.parse(text)
    );
  } catch {
    return createHttpFailureResult(
      "Response body is not valid JSON"
    );
  }
}

/**
 * Converts fetch response into
 * HTTP capability result.
 *
 * @param status HTTP status code.
 * @param bodyText Raw response body.
 * @returns Capability result.
 *
 * PURE: No side effects.
 */
export function createHttpResultFromResponse(
  status: number,
  bodyText: string
): HttpCapabilityResult {
  if (
    status < 200 ||
    status >= 300
  ) {
    return createHttpFailureResult(
      `HTTP request failed with status ${status}`,
      status
    );
  }

  if (status === 204 || status === 205) {
    return createHttpSuccessResult(status, null);
  }
  return { ...parseHttpJsonBody(bodyText), status };
}

/**
 * Creates fetch options for HTTP request.
 *
 * Authentication is intentionally not
 * resolved here. Secret resolution belongs
 * in a dedicated runtime layer.
 *
 * @param request HTTP capability request.
 * @returns Fetch options.
 *
 * PURE: No side effects.
 */
export function createHttpFetchOptions(
  request: HttpCapabilityRequest
): {
  method: HttpMethod;
  body?: string;
  headers?: Record<string, string>;
} {
  if (
    request.method === "POST"
  ) {
    return {
      method: "POST",
      body: JSON.stringify(
        request.body ?? {}
      ),
      headers: {
        "content-type":
          "application/json",
      },
    };
  }

  return {
    method: "GET",
  };
}

/**
 * Executes HTTP capability request.
 *
 * @param request HTTP capability request.
 * @param fetchFn Fetch implementation.
 * @returns HTTP capability result.
 *
 * SIDE EFFECT:
 * Performs HTTP request through supplied fetch function.
 */
export async function executeHttpCapabilityRequest(
  request: HttpCapabilityRequest,
  fetchFn: HttpFetchFunction,
  resolver?: HttpHostnameResolver
): Promise<HttpCapabilityResult> {
  return executeBoundedHttpRequest(request, fetchFn, resolver);
}

export const MAX_HTTP_RESPONSE_BYTES = 1024 * 1024;
class HttpResponseLimitError extends Error {
  constructor() { super(`HTTP response exceeds ${MAX_HTTP_RESPONSE_BYTES} bytes`); }
}

function cancelResponse(response: HttpFetchResponse): void {
  if (response.body) void response.body.cancel().catch(() => {});
}

/** Native fetch bodies are limited while streaming, including decompressed bytes. */
async function readBoundedResponse(response: HttpFetchResponse, signal: AbortSignal): Promise<string> {
  const length = response.headers?.get("content-length");
  if (length && Number(length) > MAX_HTTP_RESPONSE_BYTES) {
    cancelResponse(response);
    throw new HttpResponseLimitError();
  }
  if (!response.body) {
    // Compatibility for injected text-only adapters. Such adapters own their
    // allocation; production fetch supplies a stream and is bounded before buffering.
    const text = await response.text();
    signal.throwIfAborted();
    if (Buffer.byteLength(text, "utf8") > MAX_HTTP_RESPONSE_BYTES) throw new HttpResponseLimitError();
    return text;
  }
  const reader = response.body.getReader();
  const cancel = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener("abort", cancel, { once: true });
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    signal.throwIfAborted();
    for (;;) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) return Buffer.concat(chunks, bytes).toString("utf8");
      bytes += value.byteLength;
      if (bytes > MAX_HTTP_RESPONSE_BYTES) {
        cancel();
        throw new HttpResponseLimitError();
      }
      chunks.push(value);
    }
  } finally {
    signal.removeEventListener("abort", cancel);
    reader.releaseLock();
  }
}

export type HttpOptionsResult =
  | { ok: true; options: ReturnType<typeof createHttpFetchOptions> }
  | { ok: false; error: string };

/** One deadline covers DNS, fetch, body consumption and any explicit retries. */
export async function executeBoundedHttpRequest(
  request: HttpCapabilityRequest,
  fetchFn: HttpFetchFunction,
  resolver?: HttpHostnameResolver,
  prepareOptions: () => HttpOptionsResult = () => ({ ok: true, options: createHttpFetchOptions(request) }),
  retryPolicy?: ApiRetryPolicy
): Promise<HttpCapabilityResult> {
  const invalid = validateHttpCapabilityRequest(request);
  if (invalid) return invalid;
  const controller = new AbortController();
  let status: number | undefined;
  let abortMessage = "HTTP request aborted";
  let resolveAbort!: (result: HttpCapabilityResult) => void;
  const aborted = new Promise<HttpCapabilityResult>(resolve => { resolveAbort = resolve; });
  const abort = () => {
    controller.abort();
    resolveAbort(createHttpFailureResult(abortMessage, status));
  };
  const timer = setTimeout(() => {
    abortMessage = `HTTP request timed out after ${request.timeoutMs}ms`;
    abort();
  }, request.timeoutMs);
  request.signal?.addEventListener("abort", abort, { once: true });
  if (request.signal?.aborted) abort();
  const execute = async (): Promise<HttpCapabilityResult> => {
    controller.signal.throwIfAborted();
    const addressFailure = await validateHttpDestinationAddresses(request, resolver);
    controller.signal.throwIfAborted();
    if (addressFailure) return addressFailure;
    const options = prepareOptions();
    if (!options.ok) return createHttpFailureResult(options.error);
    const attempt = async (): Promise<HttpCapabilityResult> => {
      controller.signal.throwIfAborted();
      status = undefined;
      const response = await fetchFn(request.url, { ...options.options, redirect: "manual", signal: controller.signal });
      if (controller.signal.aborted) {
        cancelResponse(response);
        controller.signal.throwIfAborted();
      }
      status = response.status;
      if (status < 200 || status >= 300 || status === 204 || status === 205) {
        cancelResponse(response);
        return createHttpResultFromResponse(status, "");
      }
      try {
        return createHttpResultFromResponse(status, await readBoundedResponse(response, controller.signal));
      } catch (error) {
        if (error instanceof HttpResponseLimitError) return createHttpFailureResult(error.message, status);
        throw error;
      }
    };
    return retryPolicy ? await executeWithRetry(attempt, retryPolicy, controller.signal) : await attempt();
  };
  try {
    return await Promise.race([execute(), aborted]);
  } catch {
    return createHttpFailureResult(controller.signal.aborted ? abortMessage : "HTTP request failed", status);
  } finally {
    clearTimeout(timer);
    request.signal?.removeEventListener("abort", abort);
  }
}
