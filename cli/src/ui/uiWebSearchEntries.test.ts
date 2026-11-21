import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  resetWebSearchSessionUsage,
} from "../integrations/webSearch";

import {
  readWebSearchEntry,
} from "./uiWebSearchEntries";

beforeEach(
  () => {
    resetWebSearchSessionUsage();
  }
);

describe(
  "Web Search UI",
  () => {
    it(
      "shows fail-closed status without exposing credentials",
      () => {
        const entry =
          readWebSearchEntry({
            ARTURO_WEB_SEARCH_PROVIDER:
              "brave",
            ARTURO_WEB_SEARCH_MAX_CALLS_PER_SESSION:
              "3",
            BRAVE_SEARCH_API_KEY:
              "top-secret-value",
          });

        expect(
          entry.body
        ).toContain(
          "Ready:                yes"
        );
        expect(
          entry.body
        ).toContain(
          "Calls remaining:      3"
        );
        expect(
          entry.body
        ).not.toContain(
          "top-secret-value"
        );
      }
    );
  }
);
