import {
  runtimeConfig,
} from "../config/runtimeConfig";

/**
 * Writes a verbose log message.
 *
 * @param args Log arguments.
 * @returns void
 *
 * SIDE EFFECT: Writes to stdout.
 */
export function verboseLog(
  ...args: unknown[]
): void {
  if (!runtimeConfig.verbose) {
    return;
  }

  console.log(...args);
}

/**
 * Writes a verbose warning.
 *
 * @param args Warning arguments.
 * @returns void
 *
 * SIDE EFFECT: Writes to stdout.
 */
export function verboseWarn(
  ...args: unknown[]
): void {
  if (!runtimeConfig.verbose) {
    return;
  }

  console.warn(...args);
}