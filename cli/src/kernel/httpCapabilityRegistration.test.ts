import {
  describe,
  expect,
  it,
} from "vitest";

import {
  builtInCapabilityRegistry,
} from "./builtInCapabilities";

describe(
  "http capability registration",
  () => {
    it(
      "registers http.get capability",
      () => {
        expect(
          builtInCapabilityRegistry[
            "http.get"
          ]
        ).toBeDefined();

        expect(
          builtInCapabilityRegistry[
            "http.get"
          ]?.riskLevel
        ).toBe("medium");
      }
    );
  }
);