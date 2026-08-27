import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import bigbluebuttonProvider from './bigbluebutton-provider';

// W4 regression: the BBB verifyWebhook accepted ANY non-empty x-bbb-signature
// header without comparing it to an HMAC, so attendance/participation events
// could be forged once a BBB profile was enabled. It must verify the signature
// exactly like dev-provider: HMAC-SHA256 over the serialized body, timing-safe.
const SECRET = 'wave3-bbb-webhook-secret-0123456789';
const BODY = {
  eventName: 'participant.join',
  event: { id: 'e-forgery-1', ts: '2026-08-27T10:00:00Z', meeting: { internalMeetingID: 'schoolos-s1' } },
  participant: { externalUserId: 'u1', role: 'viewer' },
};

function sign(body: unknown, secret: string = SECRET): string {
  return createHmac('sha256', secret).update(typeof body === 'string' ? body : JSON.stringify(body)).digest('hex');
}

describe('BBB webhook signature verification (W4 regression)', () => {
  it('rejects a junk signature header carrying an arbitrary string', () => {
    const v = bigbluebuttonProvider.verifyWebhook({ 'x-bbb-signature': 'totally-not-the-hmac' }, BODY, SECRET);
    expect(v.valid).toBe(false);
    expect(v.reason).toBe('failed');
  });

  it('rejects a well-formed HMAC made with the wrong secret', () => {
    const v = bigbluebuttonProvider.verifyWebhook({ 'x-bbb-signature': sign(BODY, 'another-secret-value-99') }, BODY, SECRET);
    expect(v.valid).toBe(false);
    expect(v.reason).toBe('failed');
  });

  it('accepts a correctly computed HMAC over the serialized body', () => {
    const v = bigbluebuttonProvider.verifyWebhook({ 'x-bbb-signature': sign(BODY) }, BODY, SECRET);
    expect(v).toEqual({ valid: true, reason: 'verified' });
  });

  it('keeps the fail-closed contract: no secret → unsupported, no header → unsigned', () => {
    expect(bigbluebuttonProvider.verifyWebhook({}, {}, '').reason).toBe('unsupported');
    expect(bigbluebuttonProvider.verifyWebhook({}, {}, SECRET).reason).toBe('unsigned');
  });
});
