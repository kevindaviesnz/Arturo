import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  checkOllamaAvailability,
  getOllamaBaseUrl,
  pullOllamaModel,
} from "./ollamaStatus";

function streamOfLines(lines: readonly string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(encoder.encode(`${line}\n`));
      }
      controller.close();
    },
  });
}

describe("getOllamaBaseUrl", () => {
  it("derives the server root from the generate endpoint", () => {
    expect(getOllamaBaseUrl()).toBe("http://127.0.0.1:11434");
  });
});

describe("checkOllamaAvailability", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("lists installed models when the server answers", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({
        models: [{ name: "llama3.2:latest" }, { name: "qwen2.5:14b" }],
      }))
    ));

    expect(await checkOllamaAvailability()).toEqual({
      reachable: true,
      models: ["llama3.2:latest", "qwen2.5:14b"],
    });
  });

  it("reports unreachable instead of throwing when the server is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }));

    expect(await checkOllamaAvailability()).toEqual({ reachable: false });
  });
});

describe("pullOllamaModel", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("streams progress and succeeds", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(streamOfLines([
        JSON.stringify({ status: "pulling manifest" }),
        JSON.stringify({ status: "downloading", total: 100, completed: 50 }),
        JSON.stringify({ status: "downloading", total: 100, completed: 100 }),
        JSON.stringify({ status: "success" }),
      ]))
    ));

    const progress: string[] = [];
    const result = await pullOllamaModel("llama3.2", (line) => progress.push(line));

    expect(result).toEqual({ ok: true });
    expect(progress.some((line) => line.includes("%"))).toBe(true);
  });

  it("fails closed with the server's own error message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(streamOfLines([
        JSON.stringify({ error: "pull model manifest: file does not exist" }),
      ]))
    ));

    const result = await pullOllamaModel("no-such-model", () => undefined);
    expect(result).toEqual({
      ok: false,
      reason: "pull model manifest: file does not exist",
    });
  });

  it("explains an unreachable server in plain words", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }));

    const result = await pullOllamaModel("llama3.2", () => undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).not.toContain("ECONNREFUSED");
      expect(result.reason).toContain("nothing was downloaded");
    }
  });
});
