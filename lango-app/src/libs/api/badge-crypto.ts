import crypto from 'crypto';

// Shared HMAC signing for badge/QR raw tokens. Single source of truth so the
// attendance, guard and workforce-punch paths provably use the same algorithm
// and secret. Only the hash is ever stored; the raw token is returned exactly
// once at issue time.
//
// The development sentinel exists only so local dev and tests run without
// secrets; production refuses to hash with a publicly known key.
const DEV_SENTINEL = 'schoolos-qr-secret-key-sentinel';

export function badgeHmacSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('BETTER_AUTH_SECRET is required to sign badge/QR tokens in production.');
  }
  return DEV_SENTINEL;
}

export function computeHmacHash(rawToken: string): string {
  return crypto.createHmac('sha256', badgeHmacSecret()).update(rawToken).digest('hex');
}
