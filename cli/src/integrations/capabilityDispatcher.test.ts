import {
  describe,
  expect,
  it,
} from "vitest";

import {
  dispatchCapabilityExecution,
} from "./capabilityDispatcher";

describe(
  "capabilityDispatcher",
  () => {
    it(
      "dispatches http.get capability",
      async () => {
        const result =
          await dispatchCapabilityExecution(
            "http.get",
            {
              url:
                "https://example.com/api",
              timeoutMs: 1000,
            },
            async () => ({
              status: 200,
              text: async () =>
                "{\"ok\":true}",
            })
          );

        expect(
          result
        ).toEqual({
          ok: true,
          status: 200,
          body: {
            ok: true,
          },
        });
      }
    );

    it(
      "rejects unknown capability",
      async () => {
        await expect(
          dispatchCapabilityExecution(
            "unknown.capability",
            {},
            async () => ({
              status: 200,
              text: async () =>
                "{}",
            })
          )
        ).rejects.toThrow(
          "No execution adapter registered"
        );
      }
    );
  }
);