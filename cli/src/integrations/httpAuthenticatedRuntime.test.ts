import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createApiSecret,
} from "./apiSecret";

import {
  addApiSecret,
  createApiSecretStore,
} from "./apiSecretStore";

import {
  createHttpGetRequest,
} from "./httpCapabilityAdapter";

import {
  executeAuthenticatedHttpRequest,
} from "./httpAuthenticatedRuntime";

describe(
  "httpAuthenticatedRuntime",
  () => {
    it(
      "injects bearer token into request",
      async () => {
        const store =
          addApiSecret(
            createApiSecretStore(),
            createApiSecret(
              "openai",
              "secret-token"
            )
          );

        let captured:
          | Record<string, string>
          | undefined;

        await executeAuthenticatedHttpRequest(
          store,
          createHttpGetRequest(
            "https://example.com",
            1000,
            {
              bearerTokenSecretName:
                "openai",
            }
          ),
          async (
            _url,
            options
          ) => {
            captured =
              options.headers;

            return {
              status: 200,
              text:
                async () =>
                  "{}",
            };
          }
        );

        expect(
          captured
        ).toEqual({
          authorization:
            "Bearer secret-token",
        });
      }
    );
  }
);