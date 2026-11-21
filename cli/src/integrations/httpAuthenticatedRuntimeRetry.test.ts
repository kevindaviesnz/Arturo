import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createApiSecretStore,
} from "./apiSecretStore";

import {
  createHttpGetRequest,
} from "./httpCapabilityAdapter";

import {
  createApiRetryPolicy,
} from "./apiRetryPolicy";

import {
  executeAuthenticatedHttpRequest,
} from "./httpAuthenticatedRuntime";

describe(
  "httpAuthenticatedRuntime retry",
  () => {
    it(
      "retries failed requests",
      async () => {
        let attempts = 0;

        const result =
          await executeAuthenticatedHttpRequest(
            createApiSecretStore(),
            createHttpGetRequest(
              "https://example.com",
              1000
            ),
            async () => {
              attempts += 1;

              if (
                attempts < 3
              ) {
                throw new Error(
                  "temporary"
                );
              }

              return {
                status: 200,
                text:
                  async () =>
                    "{}",
              };
            },
            createApiRetryPolicy(
              3,
              0
            )
          );

        expect(
          attempts
        ).toBe(3);

        expect(
          result
        ).toEqual({
          ok: true,
          status: 200,
          body: {},
        });
      }
    );
  }
);