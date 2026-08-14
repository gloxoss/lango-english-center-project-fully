// Deterministic adversarial provider double for the P1-1 provider-saga tests.
//
// Registered under providerType 'scripted' via setProviderOverrideForTest. Its
// behavior is scripted per session id so the tests can prove, against a real
// Postgres and without any network:
//   - timeout           → recoverable failed session (never phantom `live`)
//   - retry             → no duplicate room (same deterministic meeting id)
//   - duplicate workers → converge on a single room, one provider call
//   - provider-ok-but-persist-failed (stale `running` lease) → reclaimed,
//     converges without duplicating the room
//   - provider delayed  → succeeds within the bounded window
//   - cancel-during-create → valid `cancelled` final state + room cleaned up
import type {
  CancelRoomInput, CreateJoinTokenInput, CreateRoomInput, JoinTokenResult,
  LiveClassProvider, NormalizedWebhookEvent, ProviderConfig, ProviderOperationResult,
  ProviderRawEvent, ProviderRecording, ProviderType, RoomState, UpdateRoomInput,
  WebhookVerification,
} from './types';

export type CreateScript =
  | { kind: 'ok'; delayMs?: number }
  | { kind: 'fail'; error: string; code?: string; delayMs?: number }
  | { kind: 'hang' };

const scripts = new Map<string, CreateScript>();
let defaultScript: CreateScript = { kind: 'ok' };
const rooms = new Map<string, { running: boolean; canceled: boolean }>();
const createCalls = new Map<string, number>();
const cancelCalls = new Map<string, number>();
const createdMeetingIds = new Map<string, Set<string>>();

const meetingId = (sessionId: string) => `scr-${sessionId}`;

export function setCreateScript(sessionId: string, script: CreateScript): void { scripts.set(sessionId, script); }
export function setDefaultCreateScript(script: CreateScript): void { defaultScript = script; }
export function clearScripts(): void {
  scripts.clear();
  defaultScript = { kind: 'ok' };
  rooms.clear();
  createCalls.clear();
  cancelCalls.clear();
  createdMeetingIds.clear();
}
export function createRoomCalls(sessionId: string): number { return createCalls.get(sessionId) ?? 0; }
export function cancelRoomCalls(sessionId: string): number { return cancelCalls.get(sessionId) ?? 0; }
/** Distinct meeting ids ever returned for this session (1 == no duplicate room). */
export function roomIdCount(sessionId: string): number { return createdMeetingIds.get(sessionId)?.size ?? 0; }
export function roomExists(providerMeetingId: string): boolean { return rooms.has(providerMeetingId); }

function bumpCreate(sessionId: string): void {
  createCalls.set(sessionId, (createCalls.get(sessionId) ?? 0) + 1);
}
function bumpCancel(sessionId: string): void {
  cancelCalls.set(sessionId, (cancelCalls.get(sessionId) ?? 0) + 1);
}

const delay = (ms?: number) => (ms ? new Promise<void>((r) => setTimeout(r, ms)) : Promise.resolve());

export const scriptedProvider: LiveClassProvider = {
  id: 'scripted' as ProviderType,
  label: 'Scripted (test double)',
  capabilities: {
    webhooks: false, attendanceEvents: false, recording: false, breakoutRooms: false,
    polls: false, whiteboard: false, embeddedUI: false,
  },

  async validateConfiguration(): Promise<ProviderOperationResult> {
    return { ok: true };
  },

  async createRoom(input: CreateRoomInput) {
    bumpCreate(input.sessionId);
    const script = scripts.get(input.sessionId) ?? defaultScript;
    await delay(script.kind === 'hang' ? undefined : script.delayMs);
    if (script.kind === 'hang') return new Promise<never>(() => { /* never settles */ });
    if (script.kind === 'fail') {
      return { ok: false, code: script.code ?? 'PROVIDER_ERROR', error: script.error };
    }
    const mid = meetingId(input.sessionId);
    const seen = createdMeetingIds.get(input.sessionId) ?? new Set<string>();
    seen.add(mid);
    createdMeetingIds.set(input.sessionId, seen);
    if (!rooms.has(mid)) rooms.set(mid, { running: false, canceled: false });
    return { providerMeetingId: mid };
  },

  async updateRoom(): Promise<ProviderOperationResult> {
    return { ok: true };
  },

  async cancelRoom(input: CancelRoomInput): Promise<ProviderOperationResult> {
    const sessionId = input.providerMeetingId.startsWith('scr-')
      ? input.providerMeetingId.slice(4)
      : input.providerMeetingId;
    bumpCancel(sessionId);
    const room = rooms.get(input.providerMeetingId);
    if (room) { room.canceled = true; room.running = false; }
    return { ok: true };
  },

  async getRoom(providerMeetingId: string): Promise<RoomState | null> {
    const room = rooms.get(providerMeetingId);
    if (!room) return null;
    return {
      providerMeetingId,
      isRunning: room.running,
      participantCount: 0,
      state: room.canceled ? 'ended' : room.running ? 'live' : 'waiting',
    };
  },

  async createJoinToken(input: CreateJoinTokenInput): Promise<JoinTokenResult> {
    return { token: '', url: '/dashboard/academics/live-class/test', expiresAt: new Date(Date.now() + input.ttlSeconds * 1000).toISOString() };
  },

  async syncEvents(): Promise<ProviderRawEvent[]> { return []; },
  async listRecordings(): Promise<ProviderRecording[]> { return []; },
  async deleteRecording(): Promise<ProviderOperationResult> { return { ok: true }; },

  verifyWebhook(): WebhookVerification {
    return { valid: false, reason: 'unsupported' };
  },
  normalizeWebhook(body: unknown): NormalizedWebhookEvent {
    return { providerEventId: '', sessionExternalId: '', type: 'error', externalParticipantId: '', timestamp: new Date().toISOString(), raw: body };
  },
};

export type { ProviderConfig };
export default scriptedProvider;
