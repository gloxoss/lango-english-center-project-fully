import { beforeEach, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import devProvider, {
  devProviderCapabilities, markDevRoomLive, resetDevRoomsForTest,
} from './dev-provider';
import { isProviderFailure } from './types';

const config = { baseUrl: null, accountId: null };

function roomInput(sessionId: string) {
  return {
    sessionId,
    title: 'Test',
    scheduledStart: new Date().toISOString(),
    scheduledEnd: new Date(Date.now() + 3600_000).toISOString(),
    policy: {
      recordingEnabled: true, waitingRoom: false, chat: true, screenShare: true,
      guestPolicy: 'deny' as const, maxParticipants: null,
    },
    config,
  };
}

// createRoom returns a success/failure union; the dev provider never fails, so
// narrow to the success shape at the call site.
async function createDevRoom(sessionId: string): Promise<{ providerMeetingId: string }> {
  const result = await devProvider.createRoom(roomInput(sessionId));
  if (!('providerMeetingId' in result)) throw new Error('dev provider unexpectedly failed to create a room');
  return result;
}

describe('dev provider (deterministic, internal behavior only)', () => {
  beforeEach(() => resetDevRoomsForTest());

  it('creates a deterministic meeting id from the session id', async () => {
    const a = await createDevRoom('abc');
    const b = await createDevRoom('abc');
    expect(a.providerMeetingId).toBe('dev-abc');
    expect(b.providerMeetingId).toBe('dev-abc');
  });

  it('reports the room lifecycle waiting → live → ended', async () => {
    const { providerMeetingId } = await createDevRoom('lifecycle');
    expect((await devProvider.getRoom(providerMeetingId, config))?.state).toBe('waiting');
    markDevRoomLive(providerMeetingId);
    expect((await devProvider.getRoom(providerMeetingId, config))?.state).toBe('live');
    await devProvider.cancelRoom({ providerMeetingId, config });
    expect((await devProvider.getRoom(providerMeetingId, config))?.state).toBe('ended');
  });

  it('issues a clearly-labeled development join URL, never a production host', async () => {
    const { providerMeetingId } = await createDevRoom('join');
    const result = await devProvider.createJoinToken({
      providerMeetingId, role: 'viewer', identity: 'u1', displayName: 'Test', ttlSeconds: 300, config,
    });
    // Internal app route (DÉVELOPPEMENT) — access is gated by the app's own
    // single-use join grant, so no signed grant is embedded in the URL.
    expect(result.url).toMatch(/^\/dashboard\/academics\/live-class\//);
    expect(result.url).not.toContain('join_token=');
    expect(result.url).not.toMatch(/^https?:\/\//);
    expect(result.token).toBe('');
  });

  it('verifies webhook signatures (against the caller-resolved per-profile secret) and rejects unsigned or tampered bodies', () => {
    const secret = 'dev-webhook-secret-do-not-use-in-prod';
    const body = { eventId: 'e1', meetingId: 'dev-s1', type: 'joined' };
    const unsigned = devProvider.verifyWebhook({}, body, secret);
    expect(unsigned.valid).toBe(false);
    expect(unsigned.reason).toBe('unsigned');

    const good = createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    expect(devProvider.verifyWebhook({ 'x-dev-signature': good }, body, secret).valid).toBe(true);

    const tampered = { ...body, type: 'error' };
    const bad = createHmac('sha256', secret).update(JSON.stringify(body)).digest('hex');
    expect(devProvider.verifyWebhook({ 'x-dev-signature': bad }, tampered, secret).valid).toBe(false);

    // Correct signature but against the WRONG profile's secret (P1-4:
    // per-profile binding) must fail — never verify with a mismatched secret.
    const wrongProfileSecret = 'a-different-profiles-secret-value';
    expect(devProvider.verifyWebhook({ 'x-dev-signature': good }, body, wrongProfileSecret).valid).toBe(false);
  });

  it('never fabricates recordings or external events (empty by design)', async () => {
    const { providerMeetingId } = await createDevRoom('none');
    expect(await devProvider.listRecordings(providerMeetingId, config)).toEqual([]);
    expect(await devProvider.syncEvents(providerMeetingId)).toEqual([]);
  });

  it('exposes capability flags the app uses to gate controls', () => {
    expect(devProviderCapabilities.webhooks).toBe(true);
    expect(devProviderCapabilities.attendanceEvents).toBe(true);
    expect(devProviderCapabilities.recording).toBe(true);
    expect(devProviderCapabilities.breakoutRooms).toBe(false);
  });

  it('isProviderFailure discriminates provider operation results', () => {
    expect(isProviderFailure({ ok: false, code: 'PROVIDER_TIMEOUT' })).toBe(true);
    expect(isProviderFailure({ ok: true })).toBe(false);
    expect(isProviderFailure(null)).toBe(false);
  });
});
