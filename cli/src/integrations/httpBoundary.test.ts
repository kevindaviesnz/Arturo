import { afterEach, describe, expect, it, vi } from "vitest";
import { executeHttpCapabilityRequest, type HttpCapabilityRequest, type HttpFetchFunction } from "./httpCapabilityAdapter";
import { executeAuthenticatedHttpRequest } from "./httpAuthenticatedRuntime";
import { createApiSecretStore } from "./apiSecretStore";

const limit = 1024 * 1024;
const request: HttpCapabilityRequest = { method: "GET", url: "https://example.com/api", timeoutMs: 100 };
const publicAddress = async () => ["93.184.216.34"];
afterEach(() => { vi.useRealTimers(); });

for (const mode of ["plain", "authenticated"] as const) {
  const run = (fetchFn: HttpFetchFunction, input = request, resolver = publicAddress) => mode === "plain"
    ? executeHttpCapabilityRequest(input, fetchFn, resolver)
    : executeAuthenticatedHttpRequest(createApiSecretStore(), input, fetchFn, undefined, resolver);

  describe(`${mode} HTTP boundary`, () => {
    it.each([201, 202, 206])("preserves real success status %s", async status => {
      expect(await run(async () => new Response('{"created":true}', { status }))).toEqual({ ok: true, status, body: { created: true } });
    });
    it("accepts 204 with no body", async () => {
      expect(await run(async () => new Response(null, { status: 204 }))).toEqual({ ok: true, status: 204, body: null });
    });
    it("retains status for malformed success bodies", async () => {
      expect(await run(async () => new Response('invalid', { status: 202 }))).toEqual({ ok: false, status: 202, error: "Response body is not valid JSON" });
    });
    it("rejects an oversized streamed body and cancels reading", async () => {
      const cancel = vi.fn();
      const body = new ReadableStream<Uint8Array>({
        start(controller) { controller.enqueue(new Uint8Array(limit)); controller.enqueue(new Uint8Array(1)); }, cancel,
      });
      expect(await run(async () => new Response(body))).toMatchObject({ ok: false, error: "HTTP response exceeds 1048576 bytes", status: 200 });
      expect(cancel).toHaveBeenCalledOnce();
    });
    it("rejects an oversized content length before reading", async () => {
      const text = vi.fn(async () => '{}');
      const cancel = vi.fn(async () => undefined);
      expect(await run(async () => ({ status: 200, text, headers: new Headers({ 'content-length': String(limit + 1) }), body: { cancel } } as any))).toMatchObject({ ok: false, error: "HTTP response exceeds 1048576 bytes" });
      expect(text).not.toHaveBeenCalled();
      expect(cancel).toHaveBeenCalled();
    });
    it("bounds UTF-8 bytes for text-only adapters", async () => {
      expect(await run(async () => ({ status: 200, text: async () => 'é'.repeat(limit / 2 + 1) }))).toMatchObject({ ok: false, error: "HTTP response exceeds 1048576 bytes" });
    });
    it("returns an HTTP error without reading an unbounded error body", async () => {
      const text = vi.fn(async () => { throw new Error('must not read'); });
      expect(await run(async () => ({ status: 503, text }))).toEqual({ ok: false, status: 503, error: "HTTP request failed with status 503" });
      expect(text).not.toHaveBeenCalled();
    });
    it.each([NaN, Infinity, 2147483648])("rejects invalid deadline %s without fetching", async timeoutMs => {
      const fetchFn = vi.fn(async () => new Response('{}'));
      expect(await run(fetchFn, { ...request, timeoutMs })).toMatchObject({ ok: false });
      expect(fetchFn).not.toHaveBeenCalled();
    });
    it("aborts a stalled fetch even when the adapter ignores cancellation", async () => {
      vi.useFakeTimers();
      let signal: AbortSignal | undefined;
      const pending = run(async (_, options) => { signal = options.signal; return new Promise(() => {}); });
      await vi.advanceTimersByTimeAsync(101);
      expect(await pending).toEqual({ ok: false, error: "HTTP request timed out after 100ms" });
      expect(signal?.aborted).toBe(true);
      expect(vi.getTimerCount()).toBe(0);
    });
    it("bounds DNS time and never fetches after a late resolution", async () => {
      vi.useFakeTimers();
      let resolve!: (addresses: string[]) => void;
      const fetchFn = vi.fn(async () => new Response('{}'));
      const pending = run(fetchFn, request, () => new Promise(r => { resolve = r; }));
      await vi.advanceTimersByTimeAsync(101);
      expect(await pending).toMatchObject({ ok: false, error: "HTTP request timed out after 100ms" });
      resolve(['93.184.216.34']);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchFn).not.toHaveBeenCalled();
    });
    it("aborts and cancels a stalled response stream", async () => {
      vi.useFakeTimers();
      const cancel = vi.fn();
      const pending = run(async () => new Response(new ReadableStream({ cancel })));
      await vi.advanceTimersByTimeAsync(101);
      expect(await pending).toMatchObject({ ok: false, error: "HTTP request timed out after 100ms" });
      expect(cancel).toHaveBeenCalledOnce();
    });
    it("honors caller cancellation without leaking a deadline timer", async () => {
      vi.useFakeTimers();
      const controller = new AbortController();
      const pending = run(async () => new Promise(() => {}), { ...request, signal: controller.signal } as HttpCapabilityRequest);
      controller.abort();
      expect(await pending).toEqual({ ok: false, error: "HTTP request aborted" });
      expect(vi.getTimerCount()).toBe(0);
    });
    it("returns transport rejection as a failure", async () => {
      expect(await run(async () => { throw new Error('private transport details'); })).toEqual({ ok: false, error: "HTTP request failed" });
    });
  });
}

it("uses one deadline for authenticated retries and stops retrying after timeout", async () => {
  vi.useFakeTimers();
  const fetchFn = vi.fn(async () => { throw new Error('temporary'); });
  const pending = executeAuthenticatedHttpRequest(createApiSecretStore(), request, fetchFn, { maxAttempts: 3, delayMs: 200 }, publicAddress);
  await vi.advanceTimersByTimeAsync(101);
  expect(await pending).toEqual({ ok: false, error: "HTTP request timed out after 100ms" });
  await vi.advanceTimersByTimeAsync(1000);
  expect(fetchFn).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});

it("does not report a previous attempt's HTTP status when a retry never receives a response", async () => {
  let attempt = 0;
  const result = await executeAuthenticatedHttpRequest(createApiSecretStore(), request, async () => {
    if (++attempt === 1) return { status: 200, text: async () => { throw new Error('interrupted body'); } };
    throw new Error('connection refused');
  }, { maxAttempts: 2, delayMs: 0 }, publicAddress);
  expect(result).toEqual({ ok: false, error: 'HTTP request failed' });
});
