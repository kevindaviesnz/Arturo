import { afterEach, describe, expect, it } from "vitest";

import http from "node:http";

import { resetNetworkedRuntimeModeForTests } from "../runtime/runtimeSecrets";
import {
  SIGN_OFF_LISTENER_HOST,
  startSignOffListener,
  type SignOffListener,
} from "./startSignOffListener";

const VALID_SECRET = "inline-approval-secret-000000000000";

const listeners: SignOffListener[] = [];

async function start(env: NodeJS.ProcessEnv = { APPROVAL_SIGNING_SECRET: VALID_SECRET }) {
  const listener = await startSignOffListener({ env });
  listeners.push(listener);
  return listener;
}

afterEach(async () => {
  while (listeners.length > 0) {
    const listener = listeners.pop();
    if (listener) {
      await listener.close();
    }
  }
  resetNetworkedRuntimeModeForTests();
});

describe("startSignOffListener", () => {
  it("refuses to start without a configured approval signing secret", async () => {
    await expect(startSignOffListener({ env: {} })).rejects.toThrow(
      "APPROVAL_SIGNING_SECRET or APPROVAL_SIGNING_SECRET_FILE is required, must contain at least 32 characters, and must not be a placeholder"
    );
  });

  it("listens only on the host computer after the secret is checked", async () => {
    const listener = await start();
    expect(listener.host).toBe(SIGN_OFF_LISTENER_HOST);
    expect(listener.port).toBeGreaterThan(0);
    const address = listener.server.address();
    expect(address).toEqual(
      expect.objectContaining({ address: SIGN_OFF_LISTENER_HOST, port: listener.port })
    );

    const response = await new Promise<http.IncomingMessage>((resolve, reject) => {
      const request = http.get(
        `http://${SIGN_OFF_LISTENER_HOST}:${listener.port}/`,
        resolve
      );
      request.on("error", reject);
    });
    expect(response.statusCode).toBe(404);
  });

  it("checks Host and Origin, and does not serve the old company page", async () => {
    const env = {
      APPROVAL_SIGNING_SECRET: VALID_SECRET,
      PUBLIC_BASE_URL: "https://signoff.example.com",
    };
    const listener = await start(env);
    const token = "abcdefghijklmnopqrstuvwxyz012345";

    const withHeaders = (path: string, headers: http.OutgoingHttpHeaders) =>
      new Promise<http.IncomingMessage>((resolve, reject) => {
        const request = http.request(
          {
            host: SIGN_OFF_LISTENER_HOST,
            port: listener.port,
            path,
            method: "GET",
            headers,
          },
          resolve
        );
        request.on("error", reject);
        request.end();
      });

    const allowed = await withHeaders(`/sign-off/${token}`, {
      host: "signoff.example.com",
    });
    expect(allowed.statusCode).toBe(404);

    const wrongHost = await withHeaders(`/sign-off/${token}`, {
      host: `${SIGN_OFF_LISTENER_HOST}:${listener.port}`,
    });
    expect(wrongHost.statusCode).toBe(403);

    const company = await withHeaders("/company/index.html", {
      host: "signoff.example.com",
    });
    expect(company.statusCode).toBe(404);
  });
});
