// Per-profile webhook-secret resolution (P1-4).
//
// A webhook delivery must be verified against the secret bound to the
// SPECIFIC provider profile the resolved session belongs to — never a single
// global provider-wide secret (a compromised/rotated secret for one school's
// profile must never let a forged delivery pass for another). The profile
// stores only a reference (`webhookSecretRef`, an env var name) — mirrors the
// `credentialRef` convention already used for provider API credentials. The
// raw secret value is never persisted.
export type WebhookSecretResult =
  | { ok: true; secret: string; mode: 'dev' | 'production' }
  | { ok: false; reason: 'NOT_CONFIGURED' | 'TOO_SHORT' | 'KNOWN_INSECURE' };

/** Dev/test fallback — clearly labeled, never accepted in production. */
export const DEV_WEBHOOK_SECRET = 'dev-webhook-secret-do-not-use-in-prod';

const KNOWN_INSECURE_VALUES = new Set([DEV_WEBHOOK_SECRET]);
export const MIN_WEBHOOK_SECRET_LENGTH = 16;

/** Pure resolver — unit-testable with a controlled env object. */
export function resolveWebhookSecretConfig(env: {
  nodeEnv: string | undefined;
  hasRef: boolean;
  refValue: string | undefined;
}): WebhookSecretResult {
  const isProd = env.nodeEnv === 'production';

  if (!isProd) {
    // Dev/test: an explicitly configured ref wins; otherwise fall back to the
    // labeled dev secret so the dev provider works with zero setup.
    return { ok: true, mode: 'dev', secret: env.hasRef && env.refValue ? env.refValue : DEV_WEBHOOK_SECRET };
  }

  if (!env.hasRef || !env.refValue) return { ok: false, reason: 'NOT_CONFIGURED' };
  if (env.refValue.length < MIN_WEBHOOK_SECRET_LENGTH) return { ok: false, reason: 'TOO_SHORT' };
  if (KNOWN_INSECURE_VALUES.has(env.refValue)) return { ok: false, reason: 'KNOWN_INSECURE' };
  return { ok: true, mode: 'production', secret: env.refValue };
}

/** Resolve the effective webhook secret for a given provider profile. */
export function resolveWebhookSecretForProfile(profile: { webhookSecretRef: string | null }): WebhookSecretResult {
  const hasRef = Boolean(profile.webhookSecretRef);
  const refValue = profile.webhookSecretRef ? process.env[profile.webhookSecretRef] : undefined;
  return resolveWebhookSecretConfig({ nodeEnv: process.env.NODE_ENV, hasRef, refValue });
}
