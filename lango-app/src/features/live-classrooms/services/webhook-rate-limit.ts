// P1-4: rate limiting for unknown-session / invalid-signature webhook
// deliveries. A single-instance, in-memory sliding-window counter — the same
// documented limitation as this repo's other in-process job (advanced-reporting
// schedule-worker): correct for the current single-instance deployment, would
// need a shared store (Redis) for a multi-instance deployment.
//
// Only FAILED outcomes (unknown session, missing/invalid signature) consume
// budget — a legitimately signed, high-volume delivery stream from a real
// provider is never throttled by this.
type Bucket = { count: number; windowStartMs: number };

const WINDOW_MS = 60_000;
const MAX_FAILURES_PER_WINDOW = 20;

const buckets = new Map<string, Bucket>();

/** Read-only: has `key` already exhausted its failure budget for the current window? */
export function isWebhookRateLimited(key: string, now: number = Date.now()): boolean {
  const bucket = buckets.get(key);
  if (!bucket) return false;
  if (now - bucket.windowStartMs >= WINDOW_MS) return false; // window expired
  return bucket.count >= MAX_FAILURES_PER_WINDOW;
}

/** Record one failed (unknown-session / invalid-signature) delivery attempt from `key`. */
export function recordFailedWebhookAttempt(key: string, now: number = Date.now()): void {
  const existing = buckets.get(key);
  if (!existing || now - existing.windowStartMs >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStartMs: now });
    return;
  }
  existing.count += 1;
}

export function resetWebhookRateLimitForTest(): void {
  buckets.clear();
}

export const WEBHOOK_RATE_LIMIT = { windowMs: WINDOW_MS, maxFailuresPerWindow: MAX_FAILURES_PER_WINDOW };
