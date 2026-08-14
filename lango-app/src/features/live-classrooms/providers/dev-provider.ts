// Deterministic development/test provider.
//
// PROVES INTERNAL BEHAVIOR ONLY. It is explicitly not a production provider:
// there is no real media room, and every URL/token it produces carries a
// development label. It exists so the full add-on lifecycle (create → start →
// join → events → attendance → end) is usable and testable with zero
// credentials and zero network. See the external-provider rule.
import { createHmac, timingSafeEqual } from 'node:crypto';
import type {
  CancelRoomInput, CreateJoinTokenInput, CreateRoomInput, JoinTokenResult,
  LiveClassProvider, NormalizedWebhookEvent, ProviderConfig, ProviderOperationResult,
  ProviderRawEvent, ProviderRecording, ProviderType, RoomState, UpdateRoomInput,
  WebhookVerification,
} from './types';

type DevRoom = {
  running: boolean;
  canceled: boolean;
  participants: Map<string, string>; // externalParticipantId -> displayName
};

const devRooms = new Map<string, DevRoom>();

function sessionIdFromMeeting(providerMeetingId: string): string {
  // dev rooms use `dev-<sessionId>`; fall back to the raw id defensively.
  return providerMeetingId.startsWith('dev-') ? providerMeetingId.slice(4) : providerMeetingId;
}

export const devProviderCapabilities = {
  webhooks: true,
  attendanceEvents: true,
  recording: true,
  breakoutRooms: false,
  polls: false,
  whiteboard: false,
  embeddedUI: false,
} as const;

const devProvider: LiveClassProvider = {
  id: 'dev',
  label: 'Développement (simulation locale)',
  capabilities: devProviderCapabilities,

  async validateConfiguration(): Promise<ProviderOperationResult> {
    return { ok: true };
  },

  async createRoom(input: CreateRoomInput) {
    const meetingId = `dev-${input.sessionId}`;
    if (!devRooms.has(meetingId)) {
      devRooms.set(meetingId, { running: false, canceled: false, participants: new Map() });
    }
    return { providerMeetingId: meetingId };
  },

  async updateRoom(): Promise<ProviderOperationResult> {
    return { ok: true };
  },

  async cancelRoom(input: CancelRoomInput): Promise<ProviderOperationResult> {
    const room = devRooms.get(input.providerMeetingId);
    if (room) {
      room.canceled = true;
      room.running = false;
    }
    return { ok: true };
  },

  async getRoom(providerMeetingId: string): Promise<RoomState | null> {
    const room = devRooms.get(providerMeetingId);
    if (!room) return null;
    if (room.canceled) {
      return { providerMeetingId, isRunning: false, participantCount: 0, state: 'ended' };
    }
    return {
      providerMeetingId,
      isRunning: room.running,
      participantCount: room.participants.size,
      state: room.running ? 'live' : 'waiting',
    };
  },

  async createJoinToken(input: CreateJoinTokenInput): Promise<JoinTokenResult> {
    const room = devRooms.get(input.providerMeetingId);
    if (room) {
      room.participants.set(`dev-user-${input.identity}`, input.displayName);
    }
    // The dev link is an internal app route (DÉVELOPPEMENT) — no signed grant is
    // embedded. Access to the page is gated by the app's authenticated join
    // grant (issueJoinGrant → redeemJoinGrant), which enforces durable single-use.
    return {
      token: '',
      url: `/dashboard/academics/live-class/${sessionIdFromMeeting(input.providerMeetingId)}`,
      expiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString(),
    };
  },

  async syncEvents(): Promise<ProviderRawEvent[]> {
    // Dev attendance evidence is recorded by the app itself at join/leave
    // (deterministic); there is nothing to pull from a provider.
    return [];
  },

  async listRecordings(): Promise<ProviderRecording[]> {
    return [];
  },

  async deleteRecording(): Promise<ProviderOperationResult> {
    return { ok: true };
  },

  verifyWebhook(headers: Record<string, string | undefined>, body: unknown, secret: string): WebhookVerification {
    const signature = headers['x-dev-signature'];
    if (!signature) return { valid: false, reason: 'unsigned' };
    const expected = createHmac('sha256', secret)
      .update(typeof body === 'string' ? body : JSON.stringify(body))
      .digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return { valid: false, reason: 'failed' };
    }
    return { valid: true, reason: 'verified' };
  },

  normalizeWebhook(body: unknown): NormalizedWebhookEvent {
    const b = body as {
      eventId?: string;
      meetingId?: string;
      type?: string;
      externalParticipantId?: string;
      participantRole?: 'moderator' | 'viewer';
      timestamp?: string;
    };
    return {
      providerEventId: String(b.eventId ?? ''),
      sessionExternalId: String(b.meetingId ?? ''),
      type: (b.type as NormalizedWebhookEvent['type']) ?? 'error',
      externalParticipantId: String(b.externalParticipantId ?? ''),
      participantRole: b.participantRole,
      timestamp: String(b.timestamp ?? new Date().toISOString()),
      raw: body,
    };
  },
};

export function markDevRoomLive(providerMeetingId: string) {
  const room = devRooms.get(providerMeetingId);
  if (room) room.running = true;
}

export function resetDevRoomsForTest() {
  devRooms.clear();
}

export type { ProviderConfig };
export default devProvider;
