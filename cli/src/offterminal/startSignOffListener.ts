/**
 * Starts the off-terminal sign-off listener. It listens only on the host
 * computer and, at start, requires a configured approval signing secret
 * (off-terminal sign-off brief). It serves only pairing and the sign-off
 * or set-aside of one result. It never treats a request as "at the host
 * computer".
 *
 * SIDE EFFECT: Marks the process networked and opens a loopback socket.
 */

import http from "node:http";

import { requireNetworkedApprovalSigningSecret } from "../runtime/runtimeSecrets";
import {
  decideSignOffListenerRequest,
  ListenerRateLimiter,
  responseForDecision,
  type ListenerHttpResult,
} from "./listenerRequest";
import { handlePairRoute } from "./pairPages";
import { handleSignOffRoute } from "./signOffPages";

export const SIGN_OFF_LISTENER_HOST = "127.0.0.1" as const;

export type SignOffListener = {
  readonly host: typeof SIGN_OFF_LISTENER_HOST;
  readonly port: number;
  readonly server: http.Server;
  close(): Promise<void>;
};

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function readHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}


const MAX_BODY_BYTES = 64 * 1024;

function readRequestBody(request: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error("body too large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
}

function writeResult(response: http.ServerResponse, result: ListenerHttpResult): void {
  response.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) {
    response.setHeader(name, value);
  }
  response.end(result.body);
}

/**
 * Validates the approval signing secret first, then listens only on
 * 127.0.0.1. The Host-header "this computer" check is not used.
 */
export async function startSignOffListener(options: {
  env?: NodeJS.ProcessEnv;
  port?: number;
  rateLimiter?: ListenerRateLimiter;
} = {}): Promise<SignOffListener> {
  const env = options.env ?? process.env;
  requireNetworkedApprovalSigningSecret(env);
  const rateLimiter = options.rateLimiter ?? new ListenerRateLimiter();

  const server = http.createServer((request, response) => {
    void (async () => {
      const decision = decideSignOffListenerRequest({
        remoteAddress: request.socket.remoteAddress,
        method: request.method ?? "GET",
        url: request.url ?? "/",
        headers: {
          host: readHeader(request.headers.host),
          origin: readHeader(request.headers.origin),
        },
        env,
        rateLimiter,
      });
      if (decision.kind !== "route") {
        writeResult(response, responseForDecision(decision));
        return;
      }
      let body = "";
      if ((request.method ?? "GET") === "POST") {
        try {
          body = await readRequestBody(request);
        } catch {
          writeResult(response, {
            status: 413,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            body: "Forbidden",
          });
          return;
        }
      }
      if (decision.route.kind === "pair") {
        const result = await handlePairRoute({
          action: decision.route.action,
          token: decision.route.token,
          method: request.method ?? "GET",
          body,
          env,
        });
        writeResult(response, result);
        return;
      }
      if (decision.route.kind === "sign-off") {
        const result = await handleSignOffRoute({
          action: decision.route.action,
          token: decision.route.token,
          method: request.method ?? "GET",
          body,
          env,
        });
        writeResult(response, result);
        return;
      }
      writeResult(response, responseForDecision(decision));
    })().catch(() => {
      if (!response.headersSent) {
        writeResult(response, {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
          body: "Forbidden",
        });
      }
    });
  });

  await new Promise<void>((resolve, reject) => {
    const onError = (error: Error) => {
      reject(error);
    };
    server.once("error", onError);
    server.listen(options.port ?? 0, SIGN_OFF_LISTENER_HOST, () => {
      server.off("error", onError);
      resolve();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string" || address.address !== SIGN_OFF_LISTENER_HOST) {
    await closeServer(server).catch(() => undefined);
    throw new Error("The sign-off listener must listen only on the host computer.");
  }

  return {
    host: SIGN_OFF_LISTENER_HOST,
    port: address.port,
    server,
    close: () => closeServer(server),
  };
}
