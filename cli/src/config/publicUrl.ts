const DEFAULT_PUBLIC_BASE_URL =
  "http://localhost:8788";

/**
 * Normalizes a public base URL by removing trailing slashes.
 *
 * @param value Raw public base URL.
 * @returns Normalized public base URL.
 *
 * PURE: No side effects.
 */
export function normalizePublicBaseUrl(
  value: string
): string {
  return value.replace(
    /\/+$/g,
    ""
  );
}

/**
 * Gets Arturo's public base URL.
 *
 * Uses PUBLIC_BASE_URL when set, otherwise falls back to the local review server.
 *
 * @returns Public base URL.
 *
 * SIDE EFFECT: Reads process.env.
 */
export function getPublicBaseUrl():
  string {
  return normalizePublicBaseUrl(
    process.env.PUBLIC_BASE_URL ??
      DEFAULT_PUBLIC_BASE_URL
  );
}

/**
 * Builds an external review URL.
 *
 * @param jobId Review job id.
 * @param token Raw decision token.
 * @returns External review URL.
 *
 * SIDE EFFECT: Reads process.env through getPublicBaseUrl.
 */
export function buildReviewUrl(
  jobId: string,
  token: string
): string {
  return [
    getPublicBaseUrl(),
    "/review/",
    encodeURIComponent(jobId),
    "?token=",
    encodeURIComponent(token),
  ].join("");
}

/**
 * Builds an external human task URL.
 *
 * @param taskId Human task id.
 * @param token Signed human task token.
 * @returns External human task URL.
 *
 * SIDE EFFECT: Reads process.env through getPublicBaseUrl.
 */
export function buildHumanTaskUrl(
  taskId: string,
  token: string
): string {
  return [
    getPublicBaseUrl(),
    "/human-tasks/",
    encodeURIComponent(taskId),
    "?token=",
    encodeURIComponent(token),
  ].join("");
}