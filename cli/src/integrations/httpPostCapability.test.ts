import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createHttpFetchOptions,
  createHttpPostRequest,
  executeHttpCapabilityRequest,
} from "./httpCapabilityAdapter";

describe("httpPostCapability", () => {
  it("creates POST request", () => {
    expect(
      createHttpPostRequest(
        "https://example.com/api",
        {
          name: "Kevin",
        },
        1000
      )
    ).toEqual({
      method: "POST",
      url: "https://example.com/api",
      body: {
        name: "Kevin",
      },
      timeoutMs: 1000,
    });
  });

  it("creates JSON fetch options for POST request", () => {
    expect(
      createHttpFetchOptions(
        createHttpPostRequest(
          "https://example.com/api",
          {
            name: "Kevin",
          },
          1000
        )
      )
    ).toEqual({
      method: "POST",
      body: "{\"name\":\"Kevin\"}",
      headers: {
        "content-type": "application/json",
      },
    });
  });

  it("executes POST request", async () => {
    const result =
      await executeHttpCapabilityRequest(
        createHttpPostRequest(
          "https://example.com/api",
          {
            name: "Kevin",
          },
          1000
        ),
        async (_url, options) => {
          expect(options).toEqual({
            method: "POST",
            body: "{\"name\":\"Kevin\"}",
            headers: {
              "content-type": "application/json",
            },
            redirect: "manual",
            signal: expect.any(AbortSignal),
          });

          return {
            status: 200,
            text: async () =>
              "{\"ok\":true}",
          };
        }
      );

    expect(result).toEqual({
      ok: true,
      status: 200,
      body: {
        ok: true,
      },
    });
  });

  it("creates POST request with auth reference", () => {
  expect(
    createHttpPostRequest(
      "https://example.com/api",
      {
        name: "Kevin",
      },
      1000,
      {
        bearerTokenSecretName:
          "openai",
      }
    )
  ).toEqual({
    method: "POST",
    url: "https://example.com/api",
    body: {
      name: "Kevin",
    },
    timeoutMs: 1000,
    auth: {
      bearerTokenSecretName:
        "openai",
    },
  });
});
});
