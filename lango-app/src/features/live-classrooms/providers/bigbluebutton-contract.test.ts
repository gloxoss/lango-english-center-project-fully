// BigBlueButton adapter — conformance to the LiveClassProvider contract, mirroring
// dev-provider.test.ts. The adapter is implemented to contract but NOT certified:
// it must fail closed (never fabricate success) while LIVE_BBB_URL / LIVE_BBB_SECRET
// are absent, and its pure surfaces (webhook verification, event normalization,
// capability flags) must obey the provider-neutral contract exactly.
import { describe, expect, it } from 'vitest';
import bigbluebuttonProvider, { bbbCapabilities } from './bigbluebutton-provider';
import { isProviderFailure } from './types';

const config = { baseUrl: null, accountId: null };

describe('bigbluebutton provider (contract conformance, uncertified)', () => {
  it('identifies itself and exposes the full capability set (implementation-complete)', () => {
    expect(bigbluebuttonProvider.id).toBe('bigbluebutton');
    expect(bigbluebuttonProvider.label).toContain('non certifié');
    expect(bbbCapabilities.webhooks).toBe(true);
    expect(bbbCapabilities.attendanceEvents).toBe(true);
    expect(bbbCapabilities.recording).toBe(true);
    expect(bbbCapabilities.breakoutRooms).toBe(true);
    expect(bbbCapabilities.polls).toBe(true);
    expect(bbbCapabilities.whiteboard).toBe(true);
    expect(bbbCapabilities.embeddedUI).toBe(true);
  });

  it('fails closed when unconfigured — validateConfiguration never reports success', async () => {
    // Test environment has no LIVE_BBB_URL / LIVE_BBB_SECRET, so configuration
    // must resolve to NOT_CONFIGURED rather than fabricate a healthy provider.
    const result = await bigbluebuttonProvider.validateConfiguration(config);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('NOT_CONFIGURED');
  });

  it('fails closed on room creation when unconfigured', async () => {
    const result = await bigbluebuttonProvider.createRoom({
      sessionId: 's1',
      title: 'Test',
      scheduledStart: new Date().toISOString(),
      scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
      policy: {
        recordingEnabled: false, waitingRoom: false, chat: true, screenShare: true,
        guestPolicy: 'deny', maxParticipants: null,
      },
      config,
    });
    expect(isProviderFailure(result)).toBe(true);
    if (isProviderFailure(result)) expect(result.code).toBe('NOT_CONFIGURED');
  });

  it('fails closed on room cancellation when unconfigured', async () => {
    const result = await bigbluebuttonProvider.cancelRoom({ providerMeetingId: 'schoolos-s1', config });
    expect(isProviderFailure(result)).toBe(true);
    if (isProviderFailure(result)) expect(result.code).toBe('NOT_CONFIGURED');
  });

  it('never issues a join token when unconfigured (throws rather than fabricate)', async () => {
    await expect(bigbluebuttonProvider.createJoinToken({
      providerMeetingId: 'schoolos-s1', role: 'viewer', identity: 'u1', displayName: 'T', ttlSeconds: 300, config,
    })).rejects.toThrow('NOT_CONFIGURED');
  });

  it('updateRoom is an honest idempotent no-op (BBB has no update call)', async () => {
    const result = await bigbluebuttonProvider.updateRoom({ providerMeetingId: 'schoolos-s1', config });
    expect(result.ok).toBe(true);
  });

  it('syncEvents returns empty — BBB exposes no pull event stream in this contract', async () => {
    expect(await bigbluebuttonProvider.syncEvents('schoolos-s1')).toEqual([]);
  });

  it('verifyWebhook requires a per-profile secret and a signature', () => {
    // No configured secret → unsupported (never trust an unverifiable delivery).
    expect(bigbluebuttonProvider.verifyWebhook({}, {}, '').reason).toBe('unsupported');
    // Secret present but no signature header → unsigned.
    expect(bigbluebuttonProvider.verifyWebhook({}, {}, 'secret').reason).toBe('unsigned');
    // Secret + signature → verified.
    expect(bigbluebuttonProvider.verifyWebhook({ 'x-bbb-signature': 'sig' }, {}, 'secret').reason).toBe('verified');
  });

  it('normalizeWebhook maps BBB event names onto the provider-neutral event types', () => {
    const norm = bigbluebuttonProvider.normalizeWebhook;
    const base = { event: { id: 'e1', ts: '2026-01-01T00:00:00Z', meeting: { internalMeetingID: 'schoolos-s1' } }, participant: { externalUserId: 'p1', role: 'viewer' } };

    expect(norm({ ...base, eventName: 'participant.join' }).type).toBe('joined');
    expect(norm({ ...base, eventName: 'participant.left' }).type).toBe('left');
    expect(norm({ ...base, eventName: 'meeting.ended' }).type).toBe('left');
    expect(norm({ ...base, eventName: 'participant.reconnect' }).type).toBe('reconnect');
    expect(norm({ ...base, eventName: 'meeting.created' }).type).toBe('error');
  });
});
