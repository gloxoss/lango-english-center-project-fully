// Short-lived, signed, single-use join grants.
//
// Tokens are generated just in time at join time and are never persisted as
// reusable public links. Signature verification here is pure: the token is
// bound to (tenant, user, session, role, expiry, nonce), and SINGLE-USE is
// enforced durably by join-service via an atomic UPDATE on the
// live_class_join_grants table — not by an in-process cache that dies with the
// process and does not survive a restart or multiple replicas. Only the SHA-256
// hash of the nonce is persisted; the raw nonce/token is never written to the
// DB, logs, API responses or client bundles.
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { getJoinSecretConfig } from './signing-key';

export type JoinGrantPayload = {
  sub: string; // SchoolOS user id
  tenant: string; // tenant id the grant is bound to
  session: string; // live_class_sessions.id
  role: 'moderator' | 'viewer';
  exp: number; // epoch seconds
  nonce: string;
};

function signWith(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('base64url');
}

export function signJoinToken(payload: JoinGrantPayload): string {
  const cfg = getJoinSecretConfig();
  if (!cfg.ok) throw new Error(`JOIN_SIGNING_NOT_CONFIGURED:${cfg.reason}`);
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${signWith(cfg.current, body)}`;
}

/**
 * Verifies signature (current then previous key for rotation) and expiry.
 * Replay detection is deliberately NOT here — the durable grant table in
 * join-service is the single authority for one-time redemption.
 */
export function verifyJoinToken(
  token: string,
): { ok: true; payload: JoinGrantPayload } | { ok: false; reason: 'INVALID_SIGNATURE' | 'EXPIRED' | 'NOT_CONFIGURED' } {
  const cfg = getJoinSecretConfig();
  if (!cfg.ok) return { ok: false, reason: 'NOT_CONFIGURED' };

  const [body, sig] = token.split('.');
  if (!body || !sig) return { ok: false, reason: 'INVALID_SIGNATURE' };

  const secrets = [cfg.current, ...(cfg.previous ? [cfg.previous] : [])];
  const valid = secrets.some((secret) => {
    const expected = signWith(secret, body);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!valid) return { ok: false, reason: 'INVALID_SIGNATURE' };

  let payload: JoinGrantPayload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as JoinGrantPayload;
  } catch {
    return { ok: false, reason: 'INVALID_SIGNATURE' };
  }
  if (typeof payload.exp !== 'number' || Date.now() > payload.exp * 1000) {
    return { ok: false, reason: 'EXPIRED' };
  }
  return { ok: true, payload };
}

/** SHA-256 hex of the nonce — the only value persisted for replay detection. */
export function hashJoinNonce(nonce: string): string {
  return createHmac('sha256', 'nonce-v1').update(nonce).digest('hex');
}

export function createJoinGrant(args: {
  userId: string;
  tenantId: string;
  sessionId: string;
  role: 'moderator' | 'viewer';
  ttlSeconds: number;
  authSessionId?: string | null;
}): { token: string; expiresAt: string; nonce: string } {
  const exp = Math.floor(Date.now() / 1000) + args.ttlSeconds;
  const nonce = `${Date.now().toString(36)}-${randomBytes(18).toString('hex')}`;
  const payload: JoinGrantPayload = {
    sub: args.userId,
    tenant: args.tenantId,
    session: args.sessionId,
    role: args.role,
    exp,
    nonce,
  };
  return { token: signJoinToken(payload), expiresAt: new Date(exp * 1000).toISOString(), nonce };
}
