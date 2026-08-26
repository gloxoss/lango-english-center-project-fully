// Provider-neutral contract for the Live Classrooms add-on.
//
// SchoolOS owns scheduling, authorization, roster, normalized immutable events,
// derived attendance, recording policy and reports. A provider adapter owns
// media-room semantics only. Capability flags gate which UI controls are
// honored; the UI disables unsupported controls instead of pretending support.
//
// No adapter is certified for production today (see the external-provider rule
// in future-implementation/live-classrooms/.implementation-plan). The `dev`
// adapter is the default and proves internal behavior only. `bigbluebutton` is
// implemented to contract but requires a real sandbox + ADR before certification.

export type ProviderType = 'dev' | 'bigbluebutton' | 'external_link';

export type ProviderCapabilities = {
  webhooks: boolean;
  attendanceEvents: boolean;
  recording: boolean;
  breakoutRooms: boolean;
  polls: boolean;
  whiteboard: boolean;
  embeddedUI: boolean;
};

export type ProviderParticipantRole = 'moderator' | 'viewer';

export type ProviderEventType =
  | 'joined'
  | 'left'
  | 'reconnect'
  | 'error'
  | 'kicked'
  | 'muted'
  | 'consent_accepted'
  | 'recording_started'
  | 'recording_stopped';

export type ProviderOperationResult = {
  ok: boolean;
  /** Stable machine-readable error code (e.g. NOT_CONFIGURED, PROVIDER_TIMEOUT). */
  code?: string;
  error?: string;
};

export type ProviderConfig = {
  baseUrl?: string | null;
  accountId?: string | null;
  // Secret values are resolved by the adapter from env at call time and are
  // NEVER part of this object (which may be logged/serialized).
};

export type CreateRoomInput = {
  sessionId: string;
  title: string;
  scheduledStart: string;
  scheduledEnd: string;
  policy: {
    recordingEnabled: boolean;
    waitingRoom: boolean;
    chat: boolean;
    screenShare: boolean;
    guestPolicy: 'allow' | 'deny';
    maxParticipants?: number | null;
  };
  config: ProviderConfig;
};

export type UpdateRoomInput = {
  providerMeetingId: string;
  title?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  policy?: CreateRoomInput['policy'];
  config: ProviderConfig;
};

export type CancelRoomInput = {
  providerMeetingId: string;
  reason?: string;
  config: ProviderConfig;
};

export type RoomState = {
  providerMeetingId: string;
  isRunning: boolean;
  participantCount: number;
  state: 'waiting' | 'live' | 'ended';
};

export type CreateJoinTokenInput = {
  providerMeetingId: string;
  role: ProviderParticipantRole;
  identity: string; // SchoolOS user id
  displayName: string;
  ttlSeconds: number;
  config: ProviderConfig;
};

export type JoinTokenResult = {
  token: string; // signed, short-lived
  url: string; // redemption destination
  expiresAt: string; // ISO
};

export type ProviderRawEvent = {
  providerEventId: string;
  type: ProviderEventType;
  externalParticipantId: string;
  participantRole?: ProviderParticipantRole;
  /** Provider-reported timestamp (ISO). */
  timestamp: string;
  raw: unknown;
};

export type ProviderRecording = {
  providerRecordingId: string;
  state: 'processing' | 'ready' | 'failed' | 'deleted' | 'expired';
  playbackUrl?: string | null;
  downloadUrl?: string | null;
  durationSeconds?: number | null;
  sizeBytes?: number | null;
  createdAt?: string;
};

export type WebhookVerification = {
  valid: boolean;
  reason: 'verified' | 'failed' | 'unsigned' | 'unsupported';
};

export type NormalizedWebhookEvent = {
  providerEventId: string;
  /** The provider meeting id the event belongs to. */
  sessionExternalId: string;
  type: ProviderEventType;
  externalParticipantId: string;
  participantRole?: ProviderParticipantRole;
  timestamp: string;
  raw: unknown;
};

export interface LiveClassProvider {
  readonly id: ProviderType;
  readonly label: string;
  readonly capabilities: ProviderCapabilities;
  validateConfiguration(config: ProviderConfig): Promise<ProviderOperationResult>;
  createRoom(input: CreateRoomInput): Promise<{ providerMeetingId: string } | ProviderOperationResult>;
  updateRoom(input: UpdateRoomInput): Promise<ProviderOperationResult>;
  cancelRoom(input: CancelRoomInput): Promise<ProviderOperationResult>;
  getRoom(providerMeetingId: string, config: ProviderConfig): Promise<RoomState | null>;
  createJoinToken(input: CreateJoinTokenInput): Promise<JoinTokenResult>;
  syncEvents(providerMeetingId: string, since?: string, config?: ProviderConfig): Promise<ProviderRawEvent[]>;
  listRecordings(providerMeetingId: string, config: ProviderConfig): Promise<ProviderRecording[]>;
  deleteRecording(providerRecordingId: string, config: ProviderConfig): Promise<ProviderOperationResult>;
  /**
   * `secret` is the caller-resolved, PER-PROFILE webhook secret (P1-4) — the
   * adapter must verify against exactly this value, never a module-level
   * global secret, so a delivery claiming one profile can never be verified
   * with another profile's secret.
   */
  verifyWebhook(headers: Record<string, string | undefined>, body: unknown, secret: string): WebhookVerification;
  normalizeWebhook(body: unknown): NormalizedWebhookEvent;
}

// ---------------------------------------------------------------------------
// Helpers shared by adapters
// ---------------------------------------------------------------------------

export function isProviderFailure(result: unknown): result is ProviderOperationResult {
  return typeof result === 'object' && result !== null && 'ok' in result && (result as ProviderOperationResult).ok === false;
}
