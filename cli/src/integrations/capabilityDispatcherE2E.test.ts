import {
  describe,
  expect,
  it,
} from "vitest";

import type {
  Worker,
} from "../control/workers";

import {
  dispatchCapabilityExecution,
  dispatchCapabilityExecutionForWorker,
  getRequiredWorkerCapabilityForExecution,
} from "./capabilityDispatcher";

describe(
  "capabilityDispatcher",
  () => {
    it(
      "maps external capabilities to required worker capabilities",
      () => {
        expect(
          getRequiredWorkerCapabilityForExecution(
            "http.get"
          )
        ).toBe(
          "web"
        );

        expect(
          getRequiredWorkerCapabilityForExecution(
            "email.send"
          )
        ).toBe(
          "email-send"
        );
      }
    );

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
      "dispatches capability execution for an authorised worker",
      async () => {
        const worker:
          Worker<any, any> = {
            name: "web-worker",
            kind: "ai",
            capabilities: [
              "web",
            ],
            run: function* () {
              return {};
            },
          };

        const result =
          await dispatchCapabilityExecutionForWorker(
            worker,
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
      "rejects capability execution for an unauthorised worker",
      async () => {
        const worker:
          Worker<any, any> = {
            name: "researcher",
            kind: "ai",
            capabilities: [
              "llm",
              "research",
            ],
            run: function* () {
              return {};
            },
          };

        await expect(
          dispatchCapabilityExecutionForWorker(
            worker,
            "email.send",
            {},
            async () => ({
              status: 200,
              text: async () =>
                "{}",
            })
          )
        ).rejects.toThrow(
          "lacks required capability: email-send"
        );
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

    it(
      "rejects worker-dispatched capabilities without a worker capability mapping",
      async () => {
        const worker:
          Worker<any, any> = {
            name: "operator",
            kind: "ai",
            capabilities: [
              "llm",
            ],
            run: function* () {
              return {};
            },
          };

        await expect(
          dispatchCapabilityExecutionForWorker(
            worker,
            "unknown.capability",
            {},
            async () => ({
              status: 200,
              text: async () =>
                "{}",
            })
          )
        ).rejects.toThrow(
          "No worker capability mapping registered"
        );
      }
    );
  }
);