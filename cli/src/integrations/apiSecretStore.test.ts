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
  getApiSecret,
  listApiSecretNames,
  removeApiSecret,
} from "./apiSecretStore";

describe(
  "apiSecretStore",
  () => {
    it(
      "creates empty store",
      () => {
        expect(
          createApiSecretStore()
        ).toEqual({});
      }
    );

    it(
      "adds secret",
      () => {
        const store =
          addApiSecret(
            createApiSecretStore(),
            createApiSecret(
              "openai",
              "secret"
            )
          );

        expect(
          getApiSecret(
            store,
            "openai"
          )
        ).toEqual({
          name: "openai",
          value: "secret",
        });
      }
    );

    it(
      "returns undefined for missing secret",
      () => {
        expect(
          getApiSecret(
            createApiSecretStore(),
            "missing"
          )
        ).toBeUndefined();
      }
    );

    it(
      "removes secret",
      () => {
        const store =
          addApiSecret(
            createApiSecretStore(),
            createApiSecret(
              "openai",
              "secret"
            )
          );

        const updated =
          removeApiSecret(
            store,
            "openai"
          );

        expect(
          getApiSecret(
            updated,
            "openai"
          )
        ).toBeUndefined();
      }
    );

    it(
      "returns immutable store",
      () => {
        const original =
          createApiSecretStore();

        const updated =
          addApiSecret(
            original,
            createApiSecret(
              "openai",
              "secret"
            )
          );

        expect(
          original
        ).toEqual({});

        expect(
          updated
        ).not.toBe(
          original
        );
      }
    );

    it(
      "lists secret names only",
      () => {
        const store =
          addApiSecret(
            createApiSecretStore(),
            createApiSecret(
              "openai",
              "secret"
            )
          );

        expect(
          listApiSecretNames(
            store
          )
        ).toEqual([
          "openai",
        ]);
      }
    );
  }
);