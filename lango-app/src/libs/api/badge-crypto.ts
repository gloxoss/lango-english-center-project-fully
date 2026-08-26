import crypto from 'crypto';

// Shared HMAC signing for badge/QR raw tokens. Single source of truth so the
// attendance and guard credential paths provably use the same algorithm and
// secret (BETTER_AUTH_SECRET || sentinel). Only the hash is ever stored; the
// raw token is returned exactly once at issue time.
const HMAC_SECRET = process.env.BETTER_AUTH_SECRET || 'schoolos-qr-secret-key-sentinel';

export function computeHmacHash(rawToken: string): string {
  return crypto.createHmac('sha256', HMAC_SECRET).update(rawToken).digest('hex');
}
