// Join-grant signing-key configuration (P0-2).
//
// The join-signing secret is resolved strictly by environment. Dev/test may use
// a clearly-labeled dev secret; PRODUCTION FAILS CLOSED when LIVE_JOIN_SECRET is
// absent, too short, or a known-insecure value. A literal secret is never stored
// in the database, API responses, logs or client bundles. Rotation is supported
// via LIVE_JOIN_SECRET_PREVIOUS so already-issued short-lived grants verify
// during the grace period.
export type JoinSecretMode = 'dev' | 'production';

export type JoinSecretConfig =
  | { ok: true; mode: JoinSecretMode; current: string; previous?: string }
  | { ok: false; reason: 'MISSING' | 'TOO_SHORT' | 'KNOWN_INSECURE' };

/** The old literal fallback and the labeled dev secret must never sign in prod. */
const KNOWN_INSECURE_VALUES = new Set([
  'dev-join-secret-do-not-use-in-prod',
  'dev:local-dev-signing-key-do-not-use-in-prod-0123456789abcdef',
]);

/** Dev/test fallback — clearly labeled, never accepted in production. */
const DEV_FALLBACK = 'dev:local-dev-signing-key-do-not-use-in-prod-0123456789abcdef';

export const MIN_JOIN_SECRET_LENGTH = 32;

/**
 * Pure resolver — unit-testable with a controlled env object.
 * `NODE_ENV !== 'production'` is treated as dev/test.
 */
export function resolveJoinSecretConfig(env: {
  nodeEnv: string | undefined;
  joinSecret: string | undefined;
  previousJoinSecret?: string | undefined;
}): JoinSecretConfig {
  const isProd = env.nodeEnv === 'production';
  const secret = env.joinSecret;
  const previous = env.previousJoinSecret;

  if (!isProd) {
    return {
      ok: true,
      mode: 'dev',
      current: secret && secret.length > 0 ? secret : DEV_FALLBACK,
      previous,
    };
  }

  if (!secret) return { ok: false, reason: 'MISSING' };
  if (secret.length < MIN_JOIN_SECRET_LENGTH) return { ok: false, reason: 'TOO_SHORT' };
  if (secret.startsWith('dev:') || KNOWN_INSECURE_VALUES.has(secret)) {
    return { ok: false, reason: 'KNOWN_INSECURE' };
  }
  return { ok: true, mode: 'production', current: secret, previous };
}

let cached: JoinSecretConfig | null = null;

function readEnv() {
  return {
    nodeEnv: process.env.NODE_ENV,
    joinSecret: process.env.LIVE_JOIN_SECRET,
    previousJoinSecret: process.env.LIVE_JOIN_SECRET_PREVIOUS,
  };
}

/** Resolves (and caches for process lifetime) the effective signing config. */
export function getJoinSecretConfig(): JoinSecretConfig {
  cached ??= resolveJoinSecretConfig(readEnv());
  return cached;
}

export function resetJoinSecretCache(): void {
  cached = null;
}

/** True when join tokens can be signed/verified in the current environment. */
export function isJoinSigningConfigured(): boolean {
  return getJoinSecretConfig().ok;
}

/** 'dev' | 'production' when configured, null when the environment fails closed. */
export function getJoinSigningMode(): JoinSecretMode | null {
  const cfg = getJoinSecretConfig();
  return cfg.ok ? cfg.mode : null;
}
