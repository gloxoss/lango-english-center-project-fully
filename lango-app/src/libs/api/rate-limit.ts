import { ApiError } from './errors';

type RateLimitRecord = {
  timestamps: number[];
};

const store = new Map<string, RateLimitRecord>();

/**
 * In-memory sliding-window rate limiter.
 * @param key Unique identifier (e.g. `tenantId:userId:route` or `ip:route`)
 * @param limit Max allowed requests within window
 * @param windowMs Time window in milliseconds
 */
export function checkRateLimit(key: string, limit: number = 30, windowMs: number = 60 * 1000): void {
  const now = Date.now();
  const record = store.get(key) ?? { timestamps: [] };

  // Filter out timestamps outside current sliding window
  const validTimestamps = record.timestamps.filter(t => now - t < windowMs);

  if (validTimestamps.length >= limit) {
    throw new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Trop de requêtes. Veuillez patienter avant de réessayer.');
  }

  validTimestamps.push(now);
  store.set(key, { timestamps: validTimestamps });
}
