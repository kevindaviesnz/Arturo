import type {
  ApiSecret,
} from "./apiSecret";

export type ApiSecretStore =
  Record<string, ApiSecret>;

/**
 * Creates empty secret store.
 *
 * @returns Empty secret store.
 *
 * PURE: No side effects.
 */
export function createApiSecretStore(): ApiSecretStore {
  return {};
}

/**
 * Adds secret to store.
 *
 * @param store Existing store.
 * @param secret Secret to add.
 * @returns New store.
 *
 * PURE: No side effects.
 */
export function addApiSecret(
  store: ApiSecretStore,
  secret: ApiSecret
): ApiSecretStore {
  return {
    ...store,
    [secret.name]: secret,
  };
}

/**
 * Retrieves secret.
 *
 * @param store Secret store.
 * @param name Secret name.
 * @returns Secret or undefined.
 *
 * PURE: No side effects.
 */
export function getApiSecret(
  store: ApiSecretStore,
  name: string
): ApiSecret | undefined {
  return store[name];
}

/**
 * Removes secret.
 *
 * @param store Secret store.
 * @param name Secret name.
 * @returns New store.
 *
 * PURE: No side effects.
 */
export function removeApiSecret(
  store: ApiSecretStore,
  name: string
): ApiSecretStore {
  const {
    [name]: _removed,
    ...remaining
  } = store;

  return remaining;
}

/**
 * Lists secret names.
 *
 * @param store Secret store.
 * @returns Secret names.
 *
 * PURE: No side effects.
 */
export function listApiSecretNames(
  store: ApiSecretStore
): string[] {
  return Object.keys(store);
}