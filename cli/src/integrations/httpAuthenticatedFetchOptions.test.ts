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
  createAuthenticatedFetchOptions,
} from "./httpAuthenticatedFetchOptions";

describe(
  "httpAuthenticatedFetchOptions",
  () => {
    it(
      "creates unauthenticated options",
      () => {
        expect(
          createAuthenticatedFetchOptions(
            createApiSecretStore(),
            createHttpGetRequest(
              "https://example.com",
              1000
            )
          )
        ).toEqual({
          ok: true,
          options: {
            method: "GET",
            headers: {},
          },
        });
      }
    );

    it(
      "injects bearer token",
      () => {
        const store =
          addApiSecret(
            createApiSecretStore(),
            createApiSecret(
              "openai",
              "abc123"
            )
          );

        expect(
          createAuthenticatedFetchOptions(
            store,
            createHttpGetRequest(
              "https://example.com",
              1000,
              {
                bearerTokenSecretName:
                  "openai",
              }
            )
          )
        ).toEqual({
          ok: true,
          options: {
            method: "GET",
            headers: {
              authorization:
                "Bearer abc123",
            },
          },
        });
      }
    );
  }
);