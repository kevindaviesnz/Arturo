import {
  describe,
  expect,
  it,
} from "vitest";

import {
  createApiSecret,
  maskApiSecret,
  validateApiSecret,
} from "./apiSecret";

describe("apiSecret", () => {
  it("creates secret", () => {
    expect(
      createApiSecret(
        "openai",
        "sk-123456789"
      )
    ).toEqual({
      name: "openai",
      value: "sk-123456789",
    });
  });

  it("rejects empty name", () => {
    expect(
      validateApiSecret(
        createApiSecret(
          "",
          "secret"
        )
      )
    ).toEqual({
      ok: false,
      error: "Secret name is required",
    });
  });

  it("rejects empty value", () => {
    expect(
      validateApiSecret(
        createApiSecret(
          "openai",
          ""
        )
      )
    ).toEqual({
      ok: false,
      error: "Secret value is required",
    });
  });

  it("accepts valid secret", () => {
    expect(
      validateApiSecret(
        createApiSecret(
          "openai",
          "sk-123456789"
        )
      )
    ).toEqual({
      ok: true,
    });
  });

it("masks secret", () => {
  expect(
    maskApiSecret(
      "sk-123456789"
    )
  ).toBe(
    "********6789"
  );
});

  it("masks short secret", () => {
    expect(
      maskApiSecret(
        "123"
      )
    ).toBe("****");
  });
});