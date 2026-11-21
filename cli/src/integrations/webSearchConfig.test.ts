import {
  describe,
  expect,
  it,
} from "vitest";

import {
  getWebSearchConfiguration,
} from "./webSearchConfig";

describe(
  "Web Search configuration",
  () => {
    it(
      "fails closed by default",
      () => {
        const configuration =
          getWebSearchConfiguration(
            {}
          );

        expect(
          configuration.ready
        ).toBe(
          false
        );
        expect(
          configuration.provider
        ).toBe(
          "disabled"
        );
        expect(
          configuration
            .maxCallsPerSession
        ).toBe(
          0
        );
      }
    );

    it(
      "requires a Brave key and positive call allowance",
      () => {
        expect(
          getWebSearchConfiguration({
            ARTURO_WEB_SEARCH_PROVIDER:
              "brave",
            ARTURO_WEB_SEARCH_MAX_CALLS_PER_SESSION:
              "4",
          }).ready
        ).toBe(
          false
        );

        const ready =
          getWebSearchConfiguration({
            ARTURO_WEB_SEARCH_PROVIDER:
              "brave",
            ARTURO_WEB_SEARCH_MAX_CALLS_PER_SESSION:
              "4",
            BRAVE_SEARCH_API_KEY:
              "secret",
            ARTURO_WEB_SEARCH_ALLOWED_DOMAINS:
              "vogue.com, example.com, VOGUE.COM",
          });

        expect(
          ready.ready
        ).toBe(
          true
        );
        expect(
          ready.allowedDomains
        ).toEqual([
          "vogue.com",
          "example.com",
        ]);
      }
    );

    it(
      "accepts HTTPS and loopback SearXNG endpoints but rejects ordinary cleartext hosts",
      () => {
        expect(
          getWebSearchConfiguration({
            ARTURO_WEB_SEARCH_PROVIDER:
              "searxng",
            ARTURO_WEB_SEARCH_MAX_CALLS_PER_SESSION:
              "3",
            ARTURO_SEARXNG_URL:
              "http://127.0.0.1:8080",
          }).ready
        ).toBe(
          true
        );
        expect(
          getWebSearchConfiguration({
            ARTURO_WEB_SEARCH_PROVIDER:
              "searxng",
            ARTURO_WEB_SEARCH_MAX_CALLS_PER_SESSION:
              "3",
            ARTURO_SEARXNG_URL:
              "http://search.example.com",
          }).ready
        ).toBe(
          false
        );
      }
    );
  }
);
