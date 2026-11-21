/**
 * Whether this process is serving review links.
 *
 * A review link is only worth issuing where something will answer it. The
 * maintained terminal does not start the review server, so a link announced
 * there led nowhere. The server records that it is listening; the runtime asks
 * before announcing a link. It lives apart from both because the review server
 * already imports the Worker runtime.
 */
let served = false;

/** SIDE EFFECT: Records that review links are answered by this process. */
export function markReviewLinksServed(): void {
  served = true;
}

/** PURE: Reads module state. */
export function areReviewLinksServed(): boolean {
  return served;
}

/** Test-only: clears the record. Never call from production code. */
export function resetReviewLinksServedForTests(): void {
  served = false;
}
