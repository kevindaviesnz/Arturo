import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createCanonicalJson,
  normalizeForStableSerialization,
} from "./stableSerialization";

describe(
  "stableSerialization",
  () => {
    it(
      "sorts top-level object keys",
      () => {
        expect(
          createCanonicalJson({
            b: 2,
            a: 1,
          })
        ).toBe(
          "{\"a\":1,\"b\":2}"
        );
      }
    );

    it(
      "sorts nested object keys recursively",
      () => {
        const first = {
          z: 1,
          nested: {
            b: 2,
            a: 1,
          },
        };

        const second = {
          nested: {
            a: 1,
            b: 2,
          },
          z: 1,
        };

        expect(
          createCanonicalJson(
            first
          )
        ).toBe(
          createCanonicalJson(
            second
          )
        );
      }
    );

    it(
      "preserves array order",
      () => {
        expect(
          createCanonicalJson([
            3,
            2,
            1,
          ])
        ).toBe(
          "[3,2,1]"
        );
      }
    );

    it(
      "sorts object keys inside arrays",
      () => {
        const first = [
          {
            b: 2,
            a: 1,
          },
        ];

        const second = [
          {
            a: 1,
            b: 2,
          },
        ];

        expect(
          createCanonicalJson(
            first
          )
        ).toBe(
          createCanonicalJson(
            second
          )
        );
      }
    );

    it(
      "leaves primitive values unchanged during normalization",
      () => {
        expect(
          normalizeForStableSerialization(
            null
          )
        ).toBeNull();

        expect(
          normalizeForStableSerialization(
            "alpha"
          )
        ).toBe(
          "alpha"
        );

        expect(
          normalizeForStableSerialization(
            123
          )
        ).toBe(
          123
        );

        expect(
          normalizeForStableSerialization(
            true
          )
        ).toBe(
          true
        );
      }
    );
  }
);