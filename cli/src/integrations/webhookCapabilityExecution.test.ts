import {
  describe,
  expect,
  it,
} from "vitest";

import {
  executeWebhookSendCapability,
} from "./capabilityExecutionAdapter";

describe("webhookCapabilityExecution", () => {
  it("executes webhook.send as POST request", async () => {
    const result =
      await executeWebhookSendCapability(
        {
          url: "https://example.com/webhook",
          payload: {
            event: "job.completed",
          },
          timeoutMs: 1000,
        },
        async (_url, options) => {
          expect(options).toEqual({
            method: "POST",
            body:
              "{\"event\":\"job.completed\"}",
            headers: {
              "content-type":
                "application/json",
            },
            redirect: "manual",
            signal: expect.any(AbortSignal),
          });

          return {
            status: 200,
            text: async () =>
              "{\"received\":true}",
          };
        }
      );

    expect(result).toEqual({
      ok: true,
      status: 200,
      body: {
        received: true,
      },
    });
  });
});
