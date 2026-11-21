import {
  getOllamaGenerateUrl,
} from "./ollamaClient";

/**
 * Answers two questions the /model command needs before anything else:
 * is the local model server there at all, and which models does it have?
 * Also downloads a model on the operator's explicit say-so.
 *
 * Everything here speaks plainly in its results — the reader may be a
 * first-time user whose only mistake was not having Ollama running.
 */

export type OllamaAvailability =
  | {
      readonly reachable: true;
      readonly models: readonly string[];
    }
  | {
      readonly reachable: false;
    };

/** The server base URL, derived from the configured generate endpoint. */
export function getOllamaBaseUrl(): string {
  try {
    const url = new URL(getOllamaGenerateUrl());
    return `${url.protocol}//${url.host}`;
  } catch {
    return "http://127.0.0.1:11434";
  }
}

/**
 * Asks the local model server what models it has installed.
 *
 * SIDE EFFECT: One HTTP request to the local Ollama server.
 */
export async function checkOllamaAvailability(): Promise<OllamaAvailability> {
  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/tags`);
    if (!response.ok) {
      return { reachable: false };
    }
    const json = await response.json() as {
      readonly models?: readonly { readonly name?: unknown }[];
    };
    return {
      reachable: true,
      models: (json.models ?? [])
        .map((model) => String(model.name ?? ""))
        .filter(Boolean),
    };
  } catch {
    return { reachable: false };
  }
}

export type OllamaPullResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string };

/**
 * Downloads a model through the local Ollama server, reporting progress.
 *
 * Only ever called after the operator answered yes to a download they were
 * told the name of. Progress goes through the callback so the caller decides
 * how to show it.
 *
 * SIDE EFFECT: Streams one HTTP request to the local Ollama server, which
 * downloads the model to local disk.
 */
export async function pullOllamaModel(
  model: string,
  onProgress: (line: string) => void
): Promise<OllamaPullResult> {
  let response: Response;
  try {
    response = await fetch(`${getOllamaBaseUrl()}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, stream: true }),
    });
  } catch {
    return {
      ok: false,
      reason: "The local model server could not be reached, so nothing was downloaded.",
    };
  }

  if (!response.ok || !response.body) {
    return {
      ok: false,
      reason: `The local model server refused the download (HTTP ${response.status}).`,
    };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffered = "";
  let lastShownPercent = -1;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffered += decoder.decode(value, { stream: true });

    let newline = buffered.indexOf("\n");
    while (newline >= 0) {
      const line = buffered.slice(0, newline).trim();
      buffered = buffered.slice(newline + 1);
      newline = buffered.indexOf("\n");
      if (!line) continue;

      let parsed: {
        readonly status?: unknown;
        readonly error?: unknown;
        readonly total?: unknown;
        readonly completed?: unknown;
      };
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      if (parsed.error) {
        return {
          ok: false,
          reason: String(parsed.error),
        };
      }

      const total = Number(parsed.total ?? 0);
      const completed = Number(parsed.completed ?? 0);
      if (total > 0) {
        const percent = Math.floor((completed / total) * 100);
        // Only report meaningful movement, not every chunk.
        if (percent >= lastShownPercent + 10) {
          lastShownPercent = percent;
          onProgress(`Downloading ${model}… ${percent}%`);
        }
      } else if (typeof parsed.status === "string" && parsed.status) {
        onProgress(String(parsed.status));
      }
    }
  }

  return { ok: true };
}
