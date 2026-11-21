import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createHttpPostRequest,
} from "./httpCapabilityAdapter";

describe(
  "http post request",
  () => {
    it(
      "creates POST request",
      () => {
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
          url:
            "https://example.com/api",
          body: {
            name: "Kevin",
          },
          timeoutMs: 1000,
        });
      }
    );
  }
);