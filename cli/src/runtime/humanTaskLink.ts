import crypto from "crypto";

import type {
  HumanTask,
} from "./humanTaskStore";

import {
  getPublicBaseUrl,
} from "../config/publicUrl";

import {
  getRequiredRuntimeSecret,
} from "./runtimeSecrets";

/**
 * Gets the human task token signing secret.
 *
 * @returns Human task token signing secret.
 *
 * SIDE EFFECT:
 * - Reads process.env.
 */
export function getHumanTaskTokenSecret(): string {
  return getRequiredRuntimeSecret(
    process.env,
    "HUMAN_TASK_TOKEN_SECRET"
  );
}

/**
 * Creates the stable signing payload for a human task link.
 *
 * @param task Human task.
 * @returns Token signing payload.
 *
 * PURE: No side effects.
 */
export function createHumanTaskTokenPayload(
  task: HumanTask
): string {
  return [
    task.id,
    task.sourceJobId ?? "",
    String(
      task.createdAt
    ),
  ].join(":");
}

/**
 * Signs a human task token payload.
 *
 * @param payload Token payload.
 * @param secret Signing secret.
 * @returns Hex HMAC signature.
 *
 * PURE: No side effects.
 */
export function signHumanTaskTokenPayload(
  payload: string,
  secret: string
): string {
  return crypto
    .createHmac(
      "sha256",
      secret
    )
    .update(
      payload
    )
    .digest(
      "hex"
    );
}

/**
 * Creates a signed human task access token.
 *
 * @param task Human task.
 * @returns Signed human task token.
 *
 * SIDE EFFECT:
 * - Reads token signing secret.
 */
export function createHumanTaskToken(
  task: HumanTask
): string {
  return signHumanTaskTokenPayload(
    createHumanTaskTokenPayload(
      task
    ),
    getHumanTaskTokenSecret()
  );
}

/**
 * Compares two strings using timing-safe comparison where possible.
 *
 * @param left First value.
 * @param right Second value.
 * @returns True when values match.
 *
 * PURE: No side effects.
 */
export function timingSafeEqualString(
  left: string,
  right: string
): boolean {
  const leftBuffer =
    Buffer.from(
      left
    );

  const rightBuffer =
    Buffer.from(
      right
    );

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    leftBuffer,
    rightBuffer
  );
}

/**
 * Verifies a supplied human task token.
 *
 * @param task Human task.
 * @param token Supplied token.
 * @returns True when token is valid for the task.
 *
 * SIDE EFFECT:
 * - Reads token signing secret.
 */
export function verifyHumanTaskToken(
  task: HumanTask,
  token: string | null
): boolean {
  if (!token) {
    return false;
  }

  const ageMs = Date.now() - task.createdAt;

  if (
    ageMs < 0 ||
    ageMs > 24 * 60 * 60 * 1000
  ) {
    return false;
  }

  const expected =
    createHumanTaskToken(
      task
    );

  return timingSafeEqualString(
    token,
    expected
  );
}

/**
 * Builds an external human task URL.
 *
 * @param task Human task.
 * @returns Human task URL.
 *
 * SIDE EFFECT:
 * - Reads PUBLIC_BASE_URL through getPublicBaseUrl.
 * - Reads token signing secret.
 */
export function buildHumanTaskUrl(
  task: HumanTask
): string {
  return [
    getPublicBaseUrl(),
    "/human-tasks/",
    encodeURIComponent(
      task.id
    ),
    "?token=",
    encodeURIComponent(
      createHumanTaskToken(
        task
      )
    ),
  ].join("");
}
