// setup-token.ts
// Account-activation tokens for the setup-account flow. The raw token goes in
// the SMS/email link to the user; only its SHA-256 digest is stored at rest in
// `accountSetupTokens.token`, so a DB read never leaks a usable activation link.
// SHA-256 of a 256-bit random value is the right primitive here (unlike
// passwords, which need a deliberately slow KDF): the token is high-entropy and
// single-use, and expiry/rotation is handled by the token row itself.
import { createHash, randomBytes } from 'node:crypto';

export const SETUP_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateSetupToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSetupToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
