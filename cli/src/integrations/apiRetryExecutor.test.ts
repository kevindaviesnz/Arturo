import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createApiRetryPolicy,
} from "./apiRetryPolicy";

import {
  executeWithRetry,
} from "./apiRetryExecutor";

describe(
  "apiRetryExecutor",
  () => {
    it(
      "succeeds first attempt",
      async () => {
        const result =
          await executeWithRetry(
            async () => "ok",
            createApiRetryPolicy(
              3,
              0
            )
          );

        expect(
          result
        ).toBe("ok");
      }
    );

    it(
      "retries then succeeds",
      async () => {
        let attempts = 0;

        const result =
          await executeWithRetry(
            async () => {
              attempts += 1;

              if (
                attempts < 3
              ) {
                throw new Error(
                  "fail"
                );
              }

              return "ok";
            },
            createApiRetryPolicy(
              3,
              0
            )
          );

        expect(
          result
        ).toBe("ok");

        expect(
          attempts
        ).toBe(3);
      }
    );

    it(
      "fails after retries exhausted",
      async () => {
        await expect(
          executeWithRetry(
            async () => {
              throw new Error(
                "fail"
              );
            },
            createApiRetryPolicy(
              3,
              0
            )
          )
        ).rejects.toThrow(
          "fail"
        );
      }
    );
  }
);