import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { resetJoinSecretCache } from './signing-key';
import { createJoinGrant, hashJoinNonce, signJoinToken, verifyJoinToken, type JoinGrantPayload } from './tokens';

afterEach(() => {
  resetJoinSecretCache();
});

describe('join grant tokens (short-lived, signed, tenant-bound)', () => {
  it('signs and verifies a valid token with the intended claims', () => {
    const { token } = createJoinGrant({ userId: 'u1', tenantId: 't1', sessionId: 's1', role: 'viewer', ttlSeconds: 300 });
    const result = verifyJoinToken(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.sub).toBe('u1');
      expect(result.payload.tenant).toBe('t1');
      expect(result.payload.session).toBe('s1');
      expect(result.payload.role).toBe('viewer');
      expect(result.payload.exp * 1000).toBeGreaterThan(Date.now());
    }
  });

  it('rejects an expired token', () => {
    const payload: JoinGrantPayload = {
      sub: 'u1', tenant: 't1', session: 's1', role: 'viewer',
      exp: Math.floor(Date.now() / 1000) - 60, nonce: 'n-expired',
    };
    const result = verifyJoinToken(signJoinToken(payload));
    expect(result).toEqual({ ok: false, reason: 'EXPIRED' });
  });

  it('rejects a forged/tampered token (signature mismatch)', () => {
    const { token } = createJoinGrant({ userId: 'u1', tenantId: 't1', sessionId: 's1', role: 'viewer', ttlSeconds: 300 });
    const [body, sig] = token.split('.');
    const tampered = `${body!.slice(0, body!.length - 2)}XX.${sig}`;
    const result = verifyJoinToken(tampered);
    expect(result).toEqual({ ok: false, reason: 'INVALID_SIGNATURE' });
  });

  it('rejects a malformed token (no signature)', () => {
    const result = verifyJoinToken('no-signature-here');
    expect(result).toEqual({ ok: false, reason: 'INVALID_SIGNATURE' });
  });

  it('createJoinGrant exposes an ISO expiry after the grant', () => {
    const before = Date.now();
    const { expiresAt } = createJoinGrant({ userId: 'u1', tenantId: 't1', sessionId: 's1', role: 'viewer', ttlSeconds: 60 });
    expect(Date.parse(expiresAt)).toBeGreaterThan(before);
  });

  it('verifies a token signed with the previous key during rotation grace', () => {
    const prev = 'p'.repeat(40);
    const curr = 'c'.repeat(40);
    (process.env as any).NODE_ENV = 'production';
    process.env.LIVE_JOIN_SECRET = curr;
    process.env.LIVE_JOIN_SECRET_PREVIOUS = prev;
    resetJoinSecretCache();
    try {
      const payload: JoinGrantPayload = {
        sub: 'u1', tenant: 't1', session: 's1', role: 'viewer',
        exp: Math.floor(Date.now() / 1000) + 300, nonce: 'n-rot',
      };
      const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const oldSig = createHmac('sha256', prev).update(body).digest('base64url');
      expect(verifyJoinToken(`${body}.${oldSig}`)).toMatchObject({ ok: true });
      // The current key keeps signing/verifying normally.
      expect(verifyJoinToken(signJoinToken(payload))).toMatchObject({ ok: true });
    } finally {
      delete process.env.LIVE_JOIN_SECRET;
      delete process.env.LIVE_JOIN_SECRET_PREVIOUS;
      (process.env as any).NODE_ENV = 'test';
      resetJoinSecretCache();
    }
  });

  it('hashes a nonce deterministically and never stores the raw value', () => {
    const h = hashJoinNonce('abc-nonce');
    expect(h).toHaveLength(64);
    expect(h).toBe(hashJoinNonce('abc-nonce'));
    expect(h).not.toContain('abc-nonce');
  });
});
