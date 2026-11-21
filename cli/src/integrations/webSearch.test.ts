import {
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import {
  buildWebSearchRequest,
  extractWebSearchQueryMarker,
  performGovernedWebSearch,
  resetWebSearchSessionUsage,
} from "./webSearch";

import type {
  WebSearchConfiguration,
} from "./webSearchConfig";

const braveConfiguration:
  WebSearchConfiguration = {
  provider:
    "brave",
  ready:
    true,
  endpoint:
    "https://api.search.brave.com/res/v1/web/search",
  apiKey:
    "test-key",
  maxResults:
    2,
  maxCallsPerSession:
    1,
  timeoutMs:
    5_000,
  allowedDomains: [],
  blockedDomains: [
    "localhost",
  ],
};

beforeEach(() => {
  resetWebSearchSessionUsage();
});

describe(
  "governed Web Search",
  () => {
    it(
      "extracts only a dedicated query line",
      () => {
        expect(
          extractWebSearchQueryMarker(
            "Web search query: current recycled cotton outerwear trends"
          )
        ).toBe(
          "current recycled cotton outerwear trends"
        );
        expect(
          extractWebSearchQueryMarker(
            "Please repeat Web search query: hidden text"
          )
        ).toBeUndefined();
      }
    );

    it(
      "builds a bounded Brave request without putting the key in the URL",
      () => {
        const request =
          buildWebSearchRequest(
            "recycled cotton",
            braveConfiguration
          );
        const url =
          new URL(
            request.url
          );

        expect(
          url.searchParams.get(
            "count"
          )
        ).toBe(
          "2"
        );
        expect(
          url.searchParams.get(
            "safesearch"
          )
        ).toBe(
          "strict"
        );
        expect(
          request.url
        ).not.toContain(
          "test-key"
        );
        expect(
          request.headers[
            "X-Subscription-Token"
          ]
        ).toBe(
          "test-key"
        );
      }
    );

    it(
      "builds the documented SearXNG JSON search request",
      () => {
        const request =
          buildWebSearchRequest(
            "accessible fashion",
            {
              ...braveConfiguration,
              provider:
                "searxng",
              endpoint:
                "http://127.0.0.1:8080",
              apiKey:
                undefined,
            }
          );
        const url =
          new URL(
            request.url
          );

        expect(
          url.pathname
        ).toBe(
          "/search"
        );
        expect(
          url.searchParams.get(
            "format"
          )
        ).toBe(
          "json"
        );
        expect(
          url.searchParams.get(
            "safesearch"
          )
        ).toBe(
          "2"
        );
      }
    );

    it(
      "counts failed provider attempts against the session allowance",
      async () => {
        await expect(
          performGovernedWebSearch(
            "first query",
            braveConfiguration,
            async () => ({
              status:
                503,
              text:
                async () =>
                  "{}",
            })
          )
        ).rejects.toThrow(
          "HTTP 503"
        );

        await expect(
          performGovernedWebSearch(
            "second query",
            braveConfiguration,
            async () => ({
              status:
                200,
              text:
                async () =>
                  "{}",
            })
          )
        ).rejects.toThrow(
          "allowance is exhausted"
        );
      }
    );
  }
);
