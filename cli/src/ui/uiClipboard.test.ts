import {
  sanitizeClipboardText,
} from "./uiClipboard";

import {
  describe,
  expect,
  it,
} from "vitest";

describe(
  "uiClipboard",
  () => {
    it(
      "normalizes CRLF line endings",
      () => {
        expect(
          sanitizeClipboardText(
            "one\r\ntwo\r\n"
          )
        ).toBe(
          "one\ntwo"
        );
      }
    );

    it(
      "normalizes CR line endings",
      () => {
        expect(
          sanitizeClipboardText(
            "one\rtwo\r"
          )
        ).toBe(
          "one\ntwo"
        );
      }
    );
  }
);
