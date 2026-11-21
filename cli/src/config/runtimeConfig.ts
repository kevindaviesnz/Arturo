/**
 * Runtime configuration.
 *
 * PURE: Reads process environment only.
 */
export const runtimeConfig = {
  verbose:
    process.env.VERBOSE === "true",
};