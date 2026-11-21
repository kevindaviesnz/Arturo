export type ApiSecret = {
  name: string;
  value: string;
};

export type ApiSecretValidationResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * Creates API secret.
 *
 * @param name Secret name.
 * @param value Secret value.
 * @returns API secret.
 *
 * PURE: No side effects.
 */
export function createApiSecret(
  name: string,
  value: string
): ApiSecret {
  return {
    name,
    value,
  };
}

/**
 * Validates API secret.
 *
 * @param secret API secret.
 * @returns Validation result.
 *
 * PURE: No side effects.
 */
export function validateApiSecret(
  secret: ApiSecret
): ApiSecretValidationResult {
  if (
    secret.name.trim() === ""
  ) {
    return {
      ok: false,
      error: "Secret name is required",
    };
  }

  if (
    secret.value.trim() === ""
  ) {
    return {
      ok: false,
      error: "Secret value is required",
    };
  }

  return {
    ok: true,
  };
}

/**
 * Masks API secret value for safe display.
 *
 * @param value Secret value.
 * @returns Masked secret value.
 *
 * PURE: No side effects.
 */
export function maskApiSecret(
  value: string
): string {
  if (
    value.length <= 4
  ) {
    return "****";
  }

  return `${"*".repeat(
    Math.max(
      value.length - 4,
      0
    )
  )}${value.slice(-4)}`;
}