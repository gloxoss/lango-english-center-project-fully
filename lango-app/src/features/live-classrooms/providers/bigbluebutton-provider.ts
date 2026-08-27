// BigBlueButton adapter — implemented to the provider contract but NOT certified.
//
// Certification requires a real BBB sandbox + API/checksum validation, webhook
// availability, recordings, RTL/Arabic/French and mobile/bandwidth review (the
// phase-zero gate in future-implementation/live-classrooms/.implementation-plan).
// Until then this adapter is gated behind LIVE_BBB_URL / LIVE_BBB_SECRET:
// validateConfiguration returns NOT_CONFIGURED when absent, and no operation
// ever fabricates success.
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import type {
  CancelRoomInput, CreateJoinTokenInput, CreateRoomInput, LiveClassProvider,
  NormalizedWebhookEvent, ProviderConfig, ProviderOperationResult, ProviderRawEvent,
  ProviderRecording, RoomState, UpdateRoomInput, WebhookVerification,
} from './types';

export const bbbCapabilities = {
  webhooks: true,
  attendanceEvents: true,
  recording: true,
  breakoutRooms: true,
  polls: true,
  whiteboard: true,
  embeddedUI: true,
} as const;

const BBB_BASE = process.env.LIVE_BBB_URL;
const BBB_SECRET = process.env.LIVE_BBB_SECRET;

function checksum(call: string, query: string): string {
  return createHash('sha1').update(call + query + (BBB_SECRET ?? '')).digest('hex');
}

function buildQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .sort((a, b) => a.localeCompare(b))
    .join('&');
}

async function bbbGet(call: string, params: Record<string, string>, timeoutMs = 5000): Promise<string> {
  if (!BBB_BASE) throw new Error('NOT_CONFIGURED');
  const query = buildQuery(params);
  const url = `${BBB_BASE}/${call}?${query}&checksum=${checksum(call, query)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`PROVIDER_HTTP_${res.status}`);
  return res.text();
}

function xmlValue(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
  return m ? m[1] ?? '' : '';
}

const bigbluebuttonProvider: LiveClassProvider = {
  id: 'bigbluebutton',
  label: 'BigBlueButton (non certifié — nécessite un bac à sable réel)',
  capabilities: bbbCapabilities,

  async validateConfiguration(): Promise<ProviderOperationResult> {
    if (!BBB_BASE || !BBB_SECRET) {
      return { ok: false, code: 'NOT_CONFIGURED', error: 'LIVE_BBB_URL / LIVE_BBB_SECRET non configurés.' };
    }
    try {
      const xml = await bbbGet('getMeetings', {});
      const rc = xmlValue(xml, 'returncode');
      return rc === 'SUCCESS'
        ? { ok: true }
        : { ok: false, code: 'PROVIDER_REJECTED', error: `BBB retour: ${rc}` };
    } catch (err) {
      return {
        ok: false,
        code: err instanceof Error ? err.message : 'PROVIDER_UNREACHABLE',
        error: 'Fournisseur BigBlueButton injoignable.',
      };
    }
  },

  async createRoom(input: CreateRoomInput) {
    if (!BBB_BASE || !BBB_SECRET) return { ok: false, code: 'NOT_CONFIGURED', error: 'BigBlueButton non configuré.' };
    const meetingId = `schoolos-${input.sessionId}`;
    const params: Record<string, string> = {
      meetingID: meetingId,
      name: input.title,
      record: input.policy.recordingEnabled ? 'true' : 'false',
      maxParticipants: String(input.policy.maxParticipants ?? 0),
      moderatorPW: 'mp', // replaced by just-in-time join tokens at join time
      attendeePW: 'ap',
      guestPolicy: input.policy.guestPolicy === 'allow' ? 'ALWAYS_ACCEPT' : 'ALWAYS_DENY',
      welcome: '',
    };
    try {
      const xml = await bbbGet('create', params);
      if (xmlValue(xml, 'returncode') !== 'SUCCESS') {
        return { ok: false, code: 'PROVIDER_REJECTED', error: xmlValue(xml, 'message') || 'Échec createMeeting' };
      }
      return { providerMeetingId: meetingId };
    } catch (err) {
      return { ok: false, code: err instanceof Error ? err.message : 'PROVIDER_UNREACHABLE', error: 'Impossible de créer la salle BBB.' };
    }
  },

  async updateRoom(): Promise<ProviderOperationResult> {
    // BBB has no update call; a create with the same meetingID is idempotent.
    return { ok: true };
  },

  async cancelRoom(input: CancelRoomInput): Promise<ProviderOperationResult> {
    try {
      await bbbGet('end', { meetingID: input.providerMeetingId, moderatorPW: 'mp' });
      return { ok: true };
    } catch (err) {
      return { ok: false, code: err instanceof Error ? err.message : 'PROVIDER_UNREACHABLE', error: 'Impossible de terminer la salle BBB.' };
    }
  },

  async getRoom(providerMeetingId: string): Promise<RoomState | null> {
    try {
      const xml = await bbbGet('getMeetingInfo', { meetingID: providerMeetingId, moderatorPW: 'mp' });
      const rc = xmlValue(xml, 'returncode');
      if (rc !== 'SUCCESS') return null;
      const running = xmlValue(xml, 'running') === 'true';
      const count = Number(xmlValue(xml, 'participantCount') || '0');
      return {
        providerMeetingId,
        isRunning: running,
        participantCount: Number.isFinite(count) ? count : 0,
        state: running ? 'live' : 'waiting',
      };
    } catch {
      return null;
    }
  },

  async createJoinToken(input: CreateJoinTokenInput) {
    if (!BBB_BASE) throw new Error('NOT_CONFIGURED');
    const pw = input.role === 'moderator' ? 'mp' : 'ap';
    const params: Record<string, string> = {
      fullName: input.displayName,
      meetingID: input.providerMeetingId,
      password: pw,
      role: input.role,
      redirect: 'true',
    };
    const query = buildQuery(params);
    const url = `${BBB_BASE}/join?${query}&checksum=${checksum('join', query)}`;
    const exp = Math.floor(Date.now() / 1000) + input.ttlSeconds;
    return { token: '', url, expiresAt: new Date(exp * 1000).toISOString() };
  },

  async syncEvents(): Promise<ProviderRawEvent[]> {
    // BBB exposes no push event stream in this contract revision; the webhook
    // receiver + manual resync cover event ingestion. Honest: nothing to pull.
    return [];
  },

  async listRecordings(providerMeetingId: string): Promise<ProviderRecording[]> {
    try {
      const xml = await bbbGet('getRecordings', { meetingID: providerMeetingId });
      const recordings: ProviderRecording[] = [];
      const blocks = xml.match(/<recording>[\s\S]*?<\/recording>/g) ?? [];
      for (const block of blocks) {
        const recId = xmlValue(block, 'recordID');
        const state = xmlValue(block, 'state');
        recordings.push({
          providerRecordingId: recId,
          state: (state === 'processing' || state === 'published' ? 'ready' : 'processing') as ProviderRecording['state'],
          playbackUrl: xmlValue(block, 'playback') || null,
          downloadUrl: null,
          durationSeconds: Number(xmlValue(block, 'duration') || '0') || null,
        });
      }
      return recordings;
    } catch {
      return [];
    }
  },

  async deleteRecording(providerRecordingId: string): Promise<ProviderOperationResult> {
    try {
      await bbbGet('deleteRecordings', { recordID: providerRecordingId });
      return { ok: true };
    } catch (err) {
      return { ok: false, code: err instanceof Error ? err.message : 'PROVIDER_UNREACHABLE', error: 'Impossible de supprimer l\'enregistrement BBB.' };
    }
  },

  verifyWebhook(headers: Record<string, string | undefined>, body: unknown, secret: string): WebhookVerification {
    // BBB's standard webhook plugin does not sign callbacks; the documented
    // x-bbb-signature HMAC (per-profile secret) is the only trusted shape.
    // The header value must MATCH the computed HMAC — presence alone proves
    // nothing (W4 fix: it previously verified on any non-empty header).
    if (!secret) return { valid: false, reason: 'unsupported' };
    const sig = headers['x-bbb-signature'];
    if (!sig) return { valid: false, reason: 'unsigned' };
    const expected = createHmac('sha256', secret)
      .update(typeof body === 'string' ? body : JSON.stringify(body))
      .digest('hex');
    const received = Buffer.from(sig);
    const computed = Buffer.from(expected);
    if (received.length !== computed.length || !timingSafeEqual(received, computed)) {
      return { valid: false, reason: 'failed' };
    }
    return { valid: true, reason: 'verified' };
  },

  normalizeWebhook(body: unknown): NormalizedWebhookEvent {
    const b = body as {
      event?: { id?: string; ts?: string; meeting?: { internalMeetingID?: string } };
      participant?: { externalUserId?: string; role?: 'moderator' | 'viewer' };
    };
    const type = String((body as { eventName?: string }).eventName ?? '');
    let eventType: NormalizedWebhookEvent['type'] = 'error';
    if (type === 'meeting.ended') eventType = 'left';
    else if (type === 'participant.join') eventType = 'joined';
    else if (type === 'participant.left') eventType = 'left';
    else if (type.includes('reconnect')) eventType = 'reconnect';
    return {
      providerEventId: String(b.event?.id ?? ''),
      sessionExternalId: String(b.event?.meeting?.internalMeetingID ?? ''),
      type: eventType,
      externalParticipantId: String(b.participant?.externalUserId ?? ''),
      participantRole: b.participant?.role,
      timestamp: b.event?.ts ?? new Date().toISOString(),
      raw: body,
    };
  },
};

export default bigbluebuttonProvider;
