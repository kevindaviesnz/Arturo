export const WEB_SEARCH_PROVIDERS = [
  "disabled",
  "brave",
  "searxng",
] as const;

export type WebSearchProvider =
  typeof WEB_SEARCH_PROVIDERS[number];

export type WebSearchConfiguration = {
  readonly provider: WebSearchProvider;
  readonly ready: boolean;
  readonly reason?: string;
  readonly endpoint?: string;
  readonly apiKey?: string;
  readonly maxResults: number;
  readonly maxCallsPerSession: number;
  readonly timeoutMs: number;
  readonly allowedDomains: readonly string[];
  readonly blockedDomains: readonly string[];
};

const DEFAULT_BLOCKED_DOMAINS = [
  "localhost",
] as const;

/** Parses a bounded positive integer from environment configuration. */
export function parseWebSearchInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  const parsed =
    Number.parseInt(
      value ?? "",
      10
    );

  if (
    !Number.isFinite(
      parsed
    ) ||
    parsed <
      minimum
  ) {
    return fallback;
  }

  return Math.min(
    parsed,
    maximum
  );
}

/** Parses, normalizes, and de-duplicates a comma-separated domain list. */
export function parseWebSearchDomains(
  value: string | undefined
): readonly string[] {
  return [
    ...new Set(
      (value ?? "")
        .split(",")
        .map(
          (domain) =>
            domain
              .trim()
              .toLowerCase()
              .replace(
                /^\.+/,
                ""
              )
        )
        .filter(Boolean)
    ),
  ];
}

/** Returns whether a configured SearXNG endpoint is an allowed fixed target. */
export function isValidSearxngEndpoint(
  value: string
): boolean {
  try {
    const url =
      new URL(
        value
      );
    const localHost =
      url.hostname ===
        "localhost" ||
      url.hostname ===
        "127.0.0.1" ||
      url.hostname ===
        "[::1]";

    return (
      url.protocol ===
        "https:" ||
      (
        url.protocol ===
          "http:" &&
        localHost
      )
    );
  } catch {
    return false;
  }
}

/**
 * Reads fail-closed Web Search configuration.
 *
 * Search is disabled unless a supported provider and a positive session
 * allowance are both configured. Brave additionally requires an API key;
 * SearXNG requires the operator's fixed HTTPS or loopback endpoint.
 */
export function getWebSearchConfiguration(
  environment:
    Readonly<
      Record<
        string,
        string |
        undefined
      >
    > =
    process.env
): WebSearchConfiguration {
  const providerRaw =
    environment
      .ARTURO_WEB_SEARCH_PROVIDER
      ?.trim()
      .toLowerCase() ??
    "disabled";
  const provider =
    (
      WEB_SEARCH_PROVIDERS as
        readonly string[]
    ).includes(
      providerRaw
    )
      ? providerRaw as
          WebSearchProvider
      : "disabled";
  const maxCallsPerSession =
    parseWebSearchInteger(
      environment
        .ARTURO_WEB_SEARCH_MAX_CALLS_PER_SESSION,
      0,
      0,
      1_000
    );
  const maxResults =
    parseWebSearchInteger(
      environment
        .ARTURO_WEB_SEARCH_MAX_RESULTS,
      5,
      1,
      10
    );
  const timeoutMs =
    parseWebSearchInteger(
      environment
        .ARTURO_WEB_SEARCH_TIMEOUT_MS,
      12_000,
      1_000,
      60_000
    );
  const allowedDomains =
    parseWebSearchDomains(
      environment
        .ARTURO_WEB_SEARCH_ALLOWED_DOMAINS
    );
  const blockedDomains = [
    ...new Set([
      ...DEFAULT_BLOCKED_DOMAINS,
      ...parseWebSearchDomains(
        environment
          .ARTURO_WEB_SEARCH_BLOCKED_DOMAINS
      ),
    ]),
  ];

  if (
    providerRaw !==
      provider
  ) {
    return {
      provider,
      ready: false,
      reason:
        `Unsupported Web Search provider: ${providerRaw}. Use disabled, brave, or searxng.`,
      maxResults,
      maxCallsPerSession,
      timeoutMs,
      allowedDomains,
      blockedDomains,
    };
  }

  if (
    provider ===
    "disabled"
  ) {
    return {
      provider,
      ready: false,
      reason:
        "Web Search is disabled.",
      maxResults,
      maxCallsPerSession,
      timeoutMs,
      allowedDomains,
      blockedDomains,
    };
  }

  if (
    maxCallsPerSession <=
    0
  ) {
    return {
      provider,
      ready: false,
      reason:
        "ARTURO_WEB_SEARCH_MAX_CALLS_PER_SESSION must be a positive integer.",
      maxResults,
      maxCallsPerSession,
      timeoutMs,
      allowedDomains,
      blockedDomains,
    };
  }

  if (
    provider ===
    "brave"
  ) {
    const apiKey =
      environment
        .BRAVE_SEARCH_API_KEY
        ?.trim();

    return {
      provider,
      ready:
        Boolean(
          apiKey
        ),
      reason:
        apiKey
          ? undefined
          : "BRAVE_SEARCH_API_KEY is not set.",
      endpoint:
        "https://api.search.brave.com/res/v1/web/search",
      apiKey,
      maxResults,
      maxCallsPerSession,
      timeoutMs,
      allowedDomains,
      blockedDomains,
    };
  }

  const endpoint =
    environment
      .ARTURO_SEARXNG_URL
      ?.trim();
  const endpointReady =
    Boolean(
      endpoint &&
      isValidSearxngEndpoint(
        endpoint
      )
    );

  return {
    provider,
    ready:
      endpointReady,
    reason:
      endpointReady
        ? undefined
        : "ARTURO_SEARXNG_URL must be an HTTPS URL or a loopback HTTP URL.",
    endpoint,
    maxResults,
    maxCallsPerSession,
    timeoutMs,
    allowedDomains,
    blockedDomains,
  };
}
