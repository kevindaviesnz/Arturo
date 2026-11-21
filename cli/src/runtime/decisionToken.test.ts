import {
  createDecisionToken,
  hashDecisionToken,
  verifyDecisionToken,
} from "./decisionToken";

import {
  describe,
  expect,
  it,
} from "vitest";

describe(
  "decisionToken",
  () => {
    it(
      "creates a non-empty token",
      () => {
        const token =
          createDecisionToken();

        expect(
          token.length
        ).toBeGreaterThan(0);
      }
    );

    it(
      "creates unique tokens",
      () => {
        const tokenA =
          createDecisionToken();

        const tokenB =
          createDecisionToken();

        expect(tokenA)
          .not.toBe(tokenB);
      }
    );

    it(
      "hashes deterministically",
      () => {
        const token =
          "test-token";

        const hashA =
          hashDecisionToken(
            token
          );

        const hashB =
          hashDecisionToken(
            token
          );

        expect(hashA)
          .toBe(hashB);
      }
    );

    it(
      "produces different hashes for different tokens",
      () => {
        const hashA =
          hashDecisionToken(
            "token-a"
          );

        const hashB =
          hashDecisionToken(
            "token-b"
          );

        expect(hashA)
          .not.toBe(hashB);
      }
    );

    it(
      "returns a 64 character sha256 hash",
      () => {
        const hash =
          hashDecisionToken(
            "test-token"
          );

        expect(
          hash.length
        ).toBe(64);
      }
    );

    it(
      "verifies a valid token",
      () => {
        const token =
          createDecisionToken();

        const hash =
          hashDecisionToken(
            token
          );

        expect(
          verifyDecisionToken(
            token,
            hash
          )
        ).toBe(true);
      }
    );

    it(
      "rejects an invalid token",
      () => {
        const token =
          createDecisionToken();

        const hash =
          hashDecisionToken(
            token
          );

        expect(
          verifyDecisionToken(
            "wrong-token",
            hash
          )
        ).toBe(false);
      }
    );

    it(
      "rejects an empty token",
      () => {
        const hash =
          hashDecisionToken(
            "valid-token"
          );

        expect(
          verifyDecisionToken(
            "",
            hash
          )
        ).toBe(false);
      }
    );

    it(
      "rejects an empty hash",
      () => {
        expect(
          verifyDecisionToken(
            "valid-token",
            ""
          )
        ).toBe(false);
      }
    );

    it(
      "verifies multiple generated tokens independently",
      () => {
        const tokenA =
          createDecisionToken();

        const tokenB =
          createDecisionToken();

        const hashA =
          hashDecisionToken(
            tokenA
          );

        const hashB =
          hashDecisionToken(
            tokenB
          );

        expect(
          verifyDecisionToken(
            tokenA,
            hashA
          )
        ).toBe(true);

        expect(
          verifyDecisionToken(
            tokenB,
            hashB
          )
        ).toBe(true);

        expect(
          verifyDecisionToken(
            tokenA,
            hashB
          )
        ).toBe(false);

        expect(
          verifyDecisionToken(
            tokenB,
            hashA
          )
        ).toBe(false);
      }
    );
  }
);