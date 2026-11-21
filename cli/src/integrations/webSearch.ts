import fs from "node:fs";
import path from "node:path";

import type {
  Worker,
} from "../control/workers";

import {
  assertWorkerCapability,
} from "../control/workers";

import type {
  Enterprise,
} from "../enterprise/enterprise";

import {
  getEnterprise,
  listEnterprises,
} from "../enterprise/enterpriseStore";

import type {
  Job,
} from "../runtime/jobQueue";

import {
  createArtefact,
  getArtefact,
} from "../artefacts/artefactStore";

import {
  formatArtefactReference,
  parseArtefactReference,
} from "../artefacts/artefact";

import {
  resolveRuntimeDataDirectory,
} from "../storage/runtimeStoragePaths";

import {
  getWebSearchConfiguration,
  type WebSearchConfiguration,
} from "./webSearchConfig";

export type WebSearchResult = {
  readonly title: string;
  readonly url: string;
  readonly sourceDomain: string;
  readonly snippet: string;
  readonly publishedAt?: string;
  readonly providerEngine?: string;
};

export type WebSearchResponse = {
  readonly provider:
    "brave" |
    "searxng";
  readonly query: string;
  readonly retrievedAt: string;
  readonly results:
    readonly WebSearchResult[];
};

export type WebSearchFetchResponse = {
  readonly status: number;
  readonly text:
    () =>
      Promise<string>;
};

export type WebSearchFetch = (
  input:
    string,
  init: {
    readonly method:
      "GET";
    readonly headers:
      Readonly<
        Record<
          string,
          string
        >
      >;
    readonly signal:
      AbortSignal;
    readonly redirect:
      "manual";
  }
) => Promise<WebSearchFetchResponse>;

export type CapturedWebSearchEvidence = {
  readonly response:
    WebSearchResponse;
  readonly artefactReference:
    string;
  readonly evidencePath:
    string;
};

let webSearchCallsUsed =
  0;

/** Returns current process-local Web Search usage. */
export function getWebSearchSessionUsage(): {
  readonly used: number;
} {
  return {
    used:
      webSearchCallsUsed,
  };
}

/** Resets process-local Web Search usage without changing configuration. */
export function resetWebSearchSessionUsage(): void {
  webSearchCallsUsed =
    0;
}

/** Returns true when a hostname matches a domain or one of its subdomains. */
export function hostnameMatchesDomain(
  hostname: string,
  domain: string
): boolean {
  const normalizedHostname =
    hostname
      .trim()
      .toLowerCase()
      .replace(
        /\.$/,
        ""
      );
  const normalizedDomain =
    domain
      .trim()
      .toLowerCase()
      .replace(
        /^\.+|\.$/g,
        ""
      );

  return (
    normalizedHostname ===
      normalizedDomain ||
    normalizedHostname.endsWith(
      `.${normalizedDomain}`
    )
  );
}

/** Applies source URL and configured domain policy to one normalized result. */
export function isAllowedWebSearchResult(
  result: WebSearchResult,
  configuration:
    WebSearchConfiguration
): boolean {
  let url:
    URL;
  try {
    url =
      new URL(
        result.url
      );
  } catch {
    return false;
  }

  if (
    url.protocol !==
    "https:"
  ) {
    return false;
  }

  const hostname =
    url.hostname.toLowerCase();
  if (
    configuration
      .blockedDomains
      .some(
        (domain) =>
          hostnameMatchesDomain(
            hostname,
            domain
          )
      )
  ) {
    return false;
  }

  return (
    configuration
      .allowedDomains
      .length ===
      0 ||
    configuration
      .allowedDomains
      .some(
        (domain) =>
          hostnameMatchesDomain(
            hostname,
            domain
          )
      )
  );
}

/** Converts untrusted provider text into bounded plain text. */
export function normalizeWebSearchText(
  value: unknown,
  maximumLength =
    2_000
): string {
  return String(
    value ??
    ""
  )
    .replace(
      /\u0000/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .slice(
      0,
      maximumLength
    );
}

/** Extracts a Web Search query only from an exact Workflow instruction line. */
export function extractWebSearchQueryMarker(
  instruction: string
): string | undefined {
  const marker =
    /^Web search query:\s*(\S.*)$/im.exec(
      instruction
    );
  const query =
    normalizeWebSearchText(
      marker?.[1],
      500
    );

  return query ||
    undefined;
}

/** Parses one provider response into Arturo's stable result shape. */
export function parseWebSearchProviderResponse(
  provider:
    "brave" |
    "searxng",
  value: unknown
): readonly WebSearchResult[] {
  const root =
    typeof value ===
      "object" &&
    value !==
      null
      ? value as
          Record<
            string,
            unknown
          >
      : {};
  const candidates =
    provider ===
    "brave"
      ? (
          typeof root.web ===
            "object" &&
          root.web !==
            null
            ? (
                root.web as
                  Record<
                    string,
                    unknown
                  >
              ).results
            : undefined
        )
      : root.results;

  if (
    !Array.isArray(
      candidates
    )
  ) {
    return [];
  }

  return candidates
    .map(
      (
        candidate
      ):
        WebSearchResult |
        undefined => {
        if (
          typeof candidate !==
            "object" ||
          candidate ===
            null
        ) {
          return undefined;
        }
        const item =
          candidate as
            Record<
              string,
              unknown
            >;
        const title =
          normalizeWebSearchText(
            item.title,
            500
          );
        const urlValue =
          normalizeWebSearchText(
            item.url,
            2_048
          );
        const snippet =
          normalizeWebSearchText(
            provider ===
              "brave"
              ? item.description
              : item.content
          );
        if (
          !title ||
          !urlValue
        ) {
          return undefined;
        }

        let url:
          URL;
        try {
          url =
            new URL(
              urlValue
            );
        } catch {
          return undefined;
        }

        return {
          title,
          url:
            url.toString(),
          sourceDomain:
            url.hostname.toLowerCase(),
          snippet,
          publishedAt:
            normalizeWebSearchText(
              provider ===
                "brave"
                ? (
                    item.page_age ??
                    item.age
                  )
                : (
                    item.publishedDate ??
                    item.published_date
                  ),
              200
            ) ||
            undefined,
          providerEngine:
            normalizeWebSearchText(
              item.engine,
              100
            ) ||
            undefined,
        };
      }
    )
    .filter(
      (
        result
      ):
        result is
          WebSearchResult =>
        Boolean(
          result
        )
    );
}

/** Builds the fixed provider request for one bounded query. */
export function buildWebSearchRequest(
  query: string,
  configuration:
    WebSearchConfiguration
): {
  readonly url: string;
  readonly headers:
    Readonly<
      Record<
        string,
        string
      >
    >;
} {
  if (
    !configuration.ready ||
    configuration.provider ===
      "disabled" ||
    !configuration.endpoint
  ) {
    throw new Error(
      configuration.reason ??
      "Web Search is not configured."
    );
  }

  const url =
    new URL(
      configuration.endpoint
    );
  if (
    configuration.provider ===
    "brave"
  ) {
    url.searchParams.set(
      "q",
      query
    );
    url.searchParams.set(
      "count",
      String(
        configuration.maxResults
      )
    );
    url.searchParams.set(
      "safesearch",
      "strict"
    );
    return {
      url:
        url.toString(),
      headers: {
        Accept:
          "application/json",
        "X-Subscription-Token":
          configuration.apiKey!,
      },
    };
  }

  if (
    !url.pathname.endsWith(
      "/search"
    )
  ) {
    url.pathname =
      `${url.pathname.replace(/\/$/, "")}/search`;
  }
  url.searchParams.set(
    "q",
    query
  );
  url.searchParams.set(
    "format",
    "json"
  );
  url.searchParams.set(
    "safesearch",
    "2"
  );

  return {
    url:
      url.toString(),
    headers: {
      Accept:
        "application/json",
    },
  };
}

/**
 * Performs one governed Web Search.
 *
 * The process-local call allowance is consumed for every provider attempt,
 * including provider failures, because a failed remote call can still carry
 * cost or quota impact.
 */
export async function performGovernedWebSearch(
  query: string,
  configuration =
    getWebSearchConfiguration(),
  fetchFn:
    WebSearchFetch =
    globalThis.fetch as
      unknown as
      WebSearchFetch,
  now =
    Date.now()
): Promise<WebSearchResponse> {
  const normalizedQuery =
    normalizeWebSearchText(
      query,
      500
    );

  if (!normalizedQuery) {
    throw new Error(
      "Web Search query cannot be empty."
    );
  }
  if (
    !configuration.ready ||
    configuration.provider ===
      "disabled"
  ) {
    throw new Error(
      configuration.reason ??
      "Web Search is not configured."
    );
  }
  const provider =
    configuration.provider;
  if (
    webSearchCallsUsed >=
    configuration
      .maxCallsPerSession
  ) {
    throw new Error(
      "Web Search session call allowance is exhausted."
    );
  }

  webSearchCallsUsed +=
    1;

  const request =
    buildWebSearchRequest(
      normalizedQuery,
      configuration
    );
  const controller =
    new AbortController();
  const timeout =
    setTimeout(
      () =>
        controller.abort(),
      configuration
        .timeoutMs
    );

  try {
    const response =
      await fetchFn(
        request.url,
        {
          method:
            "GET",
          headers:
            request.headers,
          signal:
            controller.signal,
          redirect:
            "manual",
        }
      );
    const body =
      await response.text();

    if (
      response.status <
        200 ||
      response.status >=
        300
    ) {
      throw new Error(
        `Web Search provider returned HTTP ${response.status}.`
      );
    }
    if (
      Buffer.byteLength(
        body,
        "utf8"
      ) >
      2 * 1024 * 1024
    ) {
      throw new Error(
        "Web Search provider response exceeded the 2 MiB limit."
      );
    }

    let parsed:
      unknown;
    try {
      parsed =
        JSON.parse(
          body
        );
    } catch {
      throw new Error(
        "Web Search provider did not return valid JSON."
      );
    }

    const unique =
      new Map<
        string,
        WebSearchResult
      >();
    parseWebSearchProviderResponse(
      provider,
      parsed
    )
      .filter(
        (result) =>
          isAllowedWebSearchResult(
            result,
            configuration
          )
      )
      .forEach(
        (result) => {
          if (
            !unique.has(
              result.url
            )
          ) {
            unique.set(
              result.url,
              result
            );
          }
        }
      );
    const results =
      [
        ...unique.values(),
      ].slice(
        0,
        configuration.maxResults
      );

    if (
      results.length ===
      0
    ) {
      throw new Error(
        "Web Search returned no results permitted by the configured source policy."
      );
    }

    return {
      provider:
        provider,
      query:
        normalizedQuery,
      retrievedAt:
        new Date(
          now
        ).toISOString(),
      results,
    };
  } finally {
    clearTimeout(
      timeout
    );
  }
}

/** Returns an explicit query marker, or the bounded Job task as a fallback. */
export function resolveWebSearchQuery(
  job: Job
): string {
  // Only the words a person gave for this step (S4): never the task's own
  // text, nor a "Web search query:" line in it, which a model may have written.
  return normalizeWebSearchText(
    job.webSearchQuery,
    500
  );
}

/**
 * Resolves the Enterprise that owns Web Search evidence.
 *
 * Explicit Job routing wins, followed by the Enterprise of an exact input
 * Artefact. A single stored Enterprise is an unambiguous final fallback.
 */
export function resolveWebSearchEnterprise(
  job: Job
): Enterprise {
  if (
    job.enterpriseId
  ) {
    const explicit =
      getEnterprise(
        job.enterpriseId
      );
    if (explicit) {
      return explicit;
    }
  }

  for (
    const reference of
      job.inputArtefactRefs ??
      []
  ) {
    try {
      const artefact =
        getArtefact(
          parseArtefactReference(
            reference
          ).artefactId
        );
      if (artefact) {
        const enterprise =
          getEnterprise(
            artefact.enterpriseId
          );
        if (enterprise) {
          return enterprise;
        }
      }
    } catch {
      // A malformed reference is reported by its normal Artefact path.
    }
  }

  const enterprises =
    listEnterprises();
  if (
    enterprises.length ===
    1
  ) {
    return enterprises[0];
  }

  throw new Error(
    "Web research needs an Enterprise. Use --enterprise with /task create or /run when more than one Enterprise exists."
  );
}

/** Writes normalized Web Search evidence and registers its exact Artefact. */
export function captureWebSearchEvidence(
  response:
    WebSearchResponse,
  enterprise:
    Enterprise,
  job:
    Job,
  worker:
    Worker<any, any>,
  dataDirectory =
    resolveRuntimeDataDirectory()
): CapturedWebSearchEvidence {
  assertWorkerCapability(
    worker,
    "web-research"
  );

  const directory =
    path.join(
      dataDirectory,
      "web-evidence"
    );
  fs.mkdirSync(
    directory,
    {
      recursive: true,
      mode:
        0o700,
    }
  );
  const evidencePath =
    path.join(
      directory,
      `${job.id}.json`
    );
  const evidence = {
    schemaVersion:
      1,
    evidenceType:
      "governed-web-search",
    provider:
      response.provider,
    query:
      response.query,
    retrievedAt:
      response.retrievedAt,
    warning:
      "Search snippets are unverified third-party content. Open and independently check important sources before relying on them.",
    results:
      response.results.map(
        (
          result,
          index
        ) => ({
          rank:
            index + 1,
          ...result,
        })
      ),
  };

  fs.writeFileSync(
    evidencePath,
    `${JSON.stringify(
      evidence,
      null,
      2
    )}\n`,
    {
      encoding:
        "utf8",
      mode:
        0o600,
    }
  );

  const artefact =
    createArtefact({
      enterpriseId:
        enterprise.id,
      name:
        `Web Search evidence — ${response.query.slice(0, 80)}`,
      kind:
        "evidence",
      file:
        evidencePath,
      mediaType:
        "application/json",
      createdBy:
        worker.displayName ??
        worker.name,
      sourceJobId:
        job.id,
      notes:
        `Governed ${response.provider} search captured at ${response.retrievedAt}. Search snippets require independent source verification.`,
    });
  const artefactReference =
    formatArtefactReference({
      artefactId:
        artefact.id,
      version:
        1,
    });

  return {
    response,
    artefactReference,
    evidencePath,
  };
}
