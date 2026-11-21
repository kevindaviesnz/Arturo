import { AsyncLocalStorage } from "node:async_hooks";
const context = new AsyncLocalStorage<string>();
/** Only the authentication boundary may establish this context. Trusted local flows leave it absent. */
export function withAuthenticatedUser<T>(userId: string, operation: () => T): T {
  return context.run(userId, operation);
}
export function authenticatedUserId(): string | undefined { return context.getStore(); }
