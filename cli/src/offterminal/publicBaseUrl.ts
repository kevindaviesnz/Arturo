/**
 * The public HTTPS hostname used in off-terminal sign-off and enrolment
 * links (off-terminal sign-off brief). No link goes out unless this is
 * https:// plus a hostname, not an IP.
 *
 * PURE: Reads only the value it is given, or process.env.
 */

import net from "node:net";

export const PUBLIC_BASE_URL_REFUSAL =
  "PUBLIC_BASE_URL must be https:// plus a hostname, not an IP address, before any off-terminal link is sent.";

export type PublicBaseUrlResult =
  | { readonly ok: true; readonly baseUrl: string }
  | { readonly ok: false; readonly refused: string };

function hostnameIsIp(hostname: string): boolean {
  return net.isIP(hostname.replace(/^\[|\]$/g, "")) !== 0;
}

function isLocalHostname(hostname: string): boolean {
  const host = hostname.replace(/\.$/, "").toLowerCase();
  return host === "localhost" || host.endsWith(".localhost");
}

/**
 * Accepts only https:// plus a hostname (no IP, no localhost, no
 * credentials, no path, query or fragment). A successful value is the
 * origin, with no trailing slash.
 */
export function parsePublicBaseUrl(value: string | undefined): PublicBaseUrlResult {
  if (value === undefined || value.trim() === "") {
    return { ok: false, refused: PUBLIC_BASE_URL_REFUSAL };
  }

  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return { ok: false, refused: PUBLIC_BASE_URL_REFUSAL };
  }

  if (url.protocol !== "https:") {
    return { ok: false, refused: PUBLIC_BASE_URL_REFUSAL };
  }
  if (url.username !== "" || url.password !== "") {
    return { ok: false, refused: PUBLIC_BASE_URL_REFUSAL };
  }
  if (!url.hostname || hostnameIsIp(url.hostname) || isLocalHostname(url.hostname)) {
    return { ok: false, refused: PUBLIC_BASE_URL_REFUSAL };
  }
  if (url.search !== "" || url.hash !== "") {
    return { ok: false, refused: PUBLIC_BASE_URL_REFUSAL };
  }
  if (url.pathname !== "" && url.pathname !== "/") {
    return { ok: false, refused: PUBLIC_BASE_URL_REFUSAL };
  }

  return { ok: true, baseUrl: url.origin };
}

export function requirePublicBaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  const parsed = parsePublicBaseUrl(env.PUBLIC_BASE_URL);
  if (!parsed.ok) {
    throw new Error(parsed.refused);
  }
  return parsed.baseUrl;
}

/**
 * No off-terminal link is issued unless PUBLIC_BASE_URL is a valid
 * https:// hostname. Further gates (the path being on) are added later.
 */
export function mayIssueOffTerminalLink(
  env: NodeJS.ProcessEnv = process.env
): PublicBaseUrlResult {
  return parsePublicBaseUrl(env.PUBLIC_BASE_URL);
}
