// Live Classrooms add-on schema.
//
// Feature-schema pattern (mirrors inventory-schema.ts): shared types (tenants,
// user, academic class tables) are imported from '@/models/Schema' and this file
// is re-exported by the Schema.ts barrel at the bottom. Drizzle FK callbacks are
// lazy, so the circular import resolves. Enums are declared locally (same DB
// type as the migration) rather than imported: the barrel loads feature schemas
// before Schema.ts's own body finishes evaluating, so referencing a
// barrel-imported enum at table-definition time throws a TDZ error.
//
// Invariants:
//  - A session is owned by the tenant that created it; every owned table has a
//    tenant_id FK to tenants.id ON DELETE CASCADE.
//  - liveClassParticipantEvents is append-only (immutable provider events);
//    liveClassAttendanceSummaries is a derived projection that never overwrites
//    raw events.
//  - Unique (providerProfileId, providerMeetingId) prevents double room
//    creation; unique (tenantId, providerEventId) dedupes webhook delivery;
//    unique (tenantId, idempotencyKey) on provider operations makes saga
//    retries idempotent.
//  - Raw provider payloads are stored only as bounded jsonb diagnostic
//    evidence; normalized rows remain authoritative for reporting.
import { sql } from 'drizzle-orm';
import {
  bigint, boolean, foreignKey, index, integer, jsonb, pgEnum, pgTable,
  text, timestamp, unique, uniqueIndex, uuid, varchar,
} from 'drizzle-orm/pg-core';
import {
  academicClassOfferings, classSections, classScheduleSlots, classSubjects,
  tenants, user,
} from '@/models/Schema';

// ---------------------------------------------------------------------------
// Enums (created idempotently in migration 0081)
// ---------------------------------------------------------------------------

export const liveClassSessionStatus = pgEnum('live_class_session_status', [
  'draft', 'scheduled', 'waiting', 'live', 'ended', 'cancelled', 'failed', 'expired',
]);
export const liveClassEventType = pgEnum('live_class_event_type', [
  'joined', 'left', 'reconnect', 'error', 'kicked', 'muted',
  'consent_accepted', 'recording_started', 'recording_stopped',
]);
export const liveClassReconciliationState = pgEnum('live_class_reconciliation_state', [
  'pending', 'proposed', 'approved', 'rejected', 'posted',
]);

// Policy snapshot stored on each session (provider-agnostic; capability flags
// gate which controls are honored per provider).
export type LiveClassPolicy = {
  recordingEnabled: boolean;
  waitingRoom: boolean;
  chat: boolean;
  screenShare: boolean;
  guestPolicy: 'allow' | 'deny';
  maxParticipants?: number | null;
};

// ---------------------------------------------------------------------------
// Provider profiles
// ---------------------------------------------------------------------------

export const liveClassProviderProfiles = pgTable('live_class_provider_profiles', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  providerType: varchar('provider_type', { length: 30 }).notNull(), // dev | bigbluebutton | external_link
  scope: varchar('scope', { length: 20 }).default('tenant').notNull(), // tenant | platform
  baseUrl: varchar('base_url', { length: 500 }),
  accountId: varchar('account_id', { length: 120 }),
  // Reference key name (e.g. "LIVE_BBB_SECRET") or encrypted blob w/ keyId+version
  // metadata. Raw credential values are NEVER persisted.
  credentialRef: varchar('credential_ref', { length: 120 }),
  credentialEncrypted: text('credential_encrypted'),
  // P1-4: per-profile webhook-signature secret reference (env var name, or a
  // clearly-labeled dev value). Verification is bound to THIS profile's
  // secret, never a single global provider-wide secret. Raw value is NEVER
  // persisted — resolved from env at verification time.
  webhookSecretRef: varchar('webhook_secret_ref', { length: 120 }),
  capabilities: jsonb('capabilities').$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'live_class_provider_profiles_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('live_class_provider_profiles_tenant_name_unique').on(table.tenantId, table.name),
]);

// ---------------------------------------------------------------------------
// Recurrences & sessions
// ---------------------------------------------------------------------------

export const liveClassRecurrences = pgTable('live_class_recurrences', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  rule: varchar('rule', { length: 255 }).notNull(), // RFC 5545 RRULE
  timezone: varchar('timezone', { length: 64 }).notNull(),
  startsOn: timestamp('starts_on', { mode: 'string' }).notNull(),
  endsOn: timestamp('ends_on', { mode: 'string' }),
  sourceSlotId: uuid('source_slot_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'live_class_recurrences_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sourceSlotId],
    foreignColumns: [classScheduleSlots.id],
    name: 'live_class_recurrences_source_slot_id_class_schedule_slots_id_fk',
  }).onDelete('set null'),
]);

export const liveClassSessions = pgTable('live_class_sessions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  providerProfileId: uuid('provider_profile_id').notNull(),
  classOfferingId: uuid('class_offering_id'),
  classSectionId: uuid('class_section_id'),
  classSubjectId: uuid('class_subject_id'),
  teacherUserId: text('teacher_user_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  objectives: text('objectives'),
  providerMeetingId: varchar('provider_meeting_id', { length: 200 }),
  scheduledStart: timestamp('scheduled_start', { mode: 'string' }).notNull(),
  scheduledEnd: timestamp('scheduled_end', { mode: 'string' }).notNull(),
  timezone: varchar('timezone', { length: 64 }).default('Africa/Casablanca').notNull(),
  actualStart: timestamp('actual_start', { mode: 'string' }),
  actualEnd: timestamp('actual_end', { mode: 'string' }),
  status: liveClassSessionStatus('status').default('draft').notNull(),
  policy: jsonb('policy').$type<LiveClassPolicy>().default(sql`'{}'::jsonb`).notNull(),
  sourceTimetableSlotId: uuid('source_timetable_slot_id'),
  recurrenceId: uuid('recurrence_id'),
  creatorUserId: text('creator_user_id').notNull(),
  lastSyncAt: timestamp('last_sync_at', { mode: 'string' }),
  failureReason: text('failure_reason'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'live_class_sessions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.providerProfileId],
    foreignColumns: [liveClassProviderProfiles.id],
    name: 'live_class_sessions_provider_profile_id_live_class_provider_profiles_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.classOfferingId],
    foreignColumns: [academicClassOfferings.id],
    name: 'live_class_sessions_class_offering_id_academic_class_offerings_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.classSectionId],
    foreignColumns: [classSections.id],
    name: 'live_class_sessions_class_section_id_class_sections_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.classSubjectId],
    foreignColumns: [classSubjects.id],
    name: 'live_class_sessions_class_subject_id_class_subjects_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.teacherUserId],
    foreignColumns: [user.id],
    name: 'live_class_sessions_teacher_user_id_user_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.sourceTimetableSlotId],
    foreignColumns: [classScheduleSlots.id],
    name: 'live_class_sessions_source_timetable_slot_id_class_schedule_slots_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.recurrenceId],
    foreignColumns: [liveClassRecurrences.id],
    name: 'live_class_sessions_recurrence_id_live_class_recurrences_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.creatorUserId],
    foreignColumns: [user.id],
    name: 'live_class_sessions_creator_user_id_user_id_fk',
  }).onDelete('restrict'),
  unique('live_class_sessions_provider_meeting_unique').on(table.providerProfileId, table.providerMeetingId),
  index('live_class_sessions_tenant_start_idx').on(table.tenantId, table.scheduledStart),
  index('live_class_sessions_tenant_teacher_idx').on(table.tenantId, table.teacherUserId),
  index('live_class_sessions_tenant_status_idx').on(table.tenantId, table.status),
]);

// ---------------------------------------------------------------------------
// Invitations & participant events
// ---------------------------------------------------------------------------

export const liveClassInvitations = pgTable('live_class_invitations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  userId: text('user_id').notNull(),
  participantRole: varchar('participant_role', { length: 20 }).notNull(), // teacher | student | parent | guardian
  joinEligible: boolean('join_eligible').default(true).notNull(),
  deliveryState: varchar('delivery_state', { length: 20 }).default('none').notNull(), // none | queued | delivered | failed | read
  deliveryChannel: varchar('delivery_channel', { length: 20 }),
  deliveredAt: timestamp('delivered_at', { mode: 'string' }),
  invitedBy: text('invited_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'live_class_invitations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [liveClassSessions.id],
    name: 'live_class_invitations_session_id_live_class_sessions_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'live_class_invitations_user_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.invitedBy],
    foreignColumns: [user.id],
    name: 'live_class_invitations_invited_by_user_id_fk',
  }).onDelete('set null'),
  unique('live_class_invitations_session_user_unique').on(table.sessionId, table.userId),
]);

export const liveClassParticipantEvents = pgTable('live_class_participant_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  providerEventId: varchar('provider_event_id', { length: 200 }).notNull(),
  providerProfileId: uuid('provider_profile_id').notNull(),
  userId: text('user_id'),
  externalParticipantId: varchar('external_participant_id', { length: 200 }),
  participantRole: varchar('participant_role', { length: 20 }),
  eventType: liveClassEventType('event_type').notNull(),
  providerTimestamp: timestamp('provider_timestamp', { mode: 'string' }).notNull(),
  receivedTimestamp: timestamp('received_timestamp', { mode: 'string' }).defaultNow().notNull(),
  rawPayload: jsonb('raw_payload').$type<unknown>(),
  processingStatus: varchar('processing_status', { length: 20 }).default('pending').notNull(), // pending | processed | failed
  retries: integer('retries').default(0).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'live_class_participant_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [liveClassSessions.id],
    name: 'live_class_participant_events_session_id_live_class_sessions_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.providerProfileId],
    foreignColumns: [liveClassProviderProfiles.id],
    name: 'live_class_participant_events_provider_profile_id_live_class_provider_profiles_id_fk',
  }).onDelete('restrict'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'live_class_participant_events_user_id_user_id_fk',
  }).onDelete('set null'),
  unique('live_class_participant_events_provider_event_unique').on(table.tenantId, table.providerEventId),
  index('live_class_participant_events_session_idx').on(table.tenantId, table.sessionId),
]);

// ---------------------------------------------------------------------------
// Derived attendance & recordings
// ---------------------------------------------------------------------------

export const liveClassAttendanceSummaries = pgTable('live_class_attendance_summaries', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  userId: text('user_id').notNull(),
  participantRole: varchar('participant_role', { length: 20 }).notNull(),
  firstJoinAt: timestamp('first_join_at', { mode: 'string' }),
  lastLeaveAt: timestamp('last_leave_at', { mode: 'string' }),
  totalPresenceSeconds: integer('total_presence_seconds').default(0).notNull(),
  intervals: jsonb('intervals').$type<Array<{ start: string; end: string }>>().default(sql`'[]'::jsonb`).notNull(),
  reconnectCount: integer('reconnect_count').default(0).notNull(),
  lateJoinSeconds: integer('late_join_seconds').default(0).notNull(),
  earlyLeaveSeconds: integer('early_leave_seconds').default(0).notNull(),
  status: varchar('status', { length: 20 }).default('unknown').notNull(), // present | late | early | absent | unknown
  reconciliationState: liveClassReconciliationState('reconciliation_state').default('pending').notNull(),
  reconciliationNote: text('reconciliation_note'),
  reconciledBy: text('reconciled_by'),
  reconciledAt: timestamp('reconciled_at', { mode: 'string' }),
  version: integer('version').default(1).notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'live_class_attendance_summaries_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [liveClassSessions.id],
    name: 'live_class_attendance_summaries_session_id_live_class_sessions_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'live_class_attendance_summaries_user_id_user_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.reconciledBy],
    foreignColumns: [user.id],
    name: 'live_class_attendance_summaries_reconciled_by_user_id_fk',
  }).onDelete('set null'),
  unique('live_class_attendance_summaries_session_user_unique').on(table.sessionId, table.userId),
]);

export const liveClassRecordings = pgTable('live_class_recordings', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  providerRecordingId: varchar('provider_recording_id', { length: 200 }),
  state: varchar('state', { length: 20 }).default('processing').notNull(), // processing | ready | failed | deleted | expired
  playbackUrl: text('playback_url'),
  downloadUrl: text('download_url'),
  durationSeconds: integer('duration_seconds'),
  sizeBytes: bigint('size_bytes', { mode: 'number' }),
  retentionDays: integer('retention_days'),
  expiresAt: timestamp('expires_at', { mode: 'string' }),
  consentSnapshot: jsonb('consent_snapshot').$type<unknown>().default(sql`'{}'::jsonb`).notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'live_class_recordings_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [liveClassSessions.id],
    name: 'live_class_recordings_session_id_live_class_sessions_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'live_class_recordings_created_by_user_id_fk',
  }).onDelete('set null'),
  unique('live_class_recordings_provider_recording_unique').on(table.tenantId, table.providerRecordingId),
  index('live_class_recordings_session_idx').on(table.tenantId, table.sessionId),
]);

// ---------------------------------------------------------------------------
// Webhook receipts & provider operation attempts
// ---------------------------------------------------------------------------

export const liveClassWebhookReceipts = pgTable('live_class_webhook_receipts', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  providerProfileId: uuid('provider_profile_id').notNull(),
  providerEventId: varchar('provider_event_id', { length: 200 }),
  signatureResult: varchar('signature_result', { length: 20 }).notNull(), // verified | failed | unsigned | unsupported
  processingStatus: varchar('processing_status', { length: 20 }).default('received').notNull(), // received | queued | processed | failed | dead_letter
  attempts: integer('attempts').default(1).notNull(),
  lastError: text('last_error'),
  receivedAt: timestamp('received_at', { mode: 'string' }).defaultNow().notNull(),
  processedAt: timestamp('processed_at', { mode: 'string' }),
  rawPayload: jsonb('raw_payload').$type<unknown>().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'live_class_webhook_receipts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.providerProfileId],
    foreignColumns: [liveClassProviderProfiles.id],
    name: 'live_class_webhook_receipts_provider_profile_id_live_class_provider_profiles_id_fk',
  }).onDelete('restrict'),
  uniqueIndex('live_class_webhook_receipts_event_unique').on(table.tenantId, table.providerEventId)
    .where(sql`${table.providerEventId} IS NOT NULL`),
  index('live_class_webhook_receipts_profile_received_idx').on(table.tenantId, table.providerProfileId, table.receivedAt),
]);

export const liveClassProviderOperations = pgTable('live_class_provider_operations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sessionId: uuid('session_id'),
  providerProfileId: uuid('provider_profile_id').notNull(),
  operation: varchar('operation', { length: 30 }).notNull(), // create_room | update_room | cancel_room | get_room | test_connection | sync_events
  idempotencyKey: varchar('idempotency_key', { length: 160 }).notNull(),
  status: varchar('status', { length: 20 }).default('pending').notNull(), // pending | running | succeeded | failed
  requestSnapshot: jsonb('request_snapshot').$type<unknown>(),
  resultSnapshot: jsonb('result_snapshot').$type<unknown>(),
  error: text('error'),
  attempts: integer('attempts').default(1).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'live_class_provider_operations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [liveClassSessions.id],
    name: 'live_class_provider_operations_session_id_live_class_sessions_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.providerProfileId],
    foreignColumns: [liveClassProviderProfiles.id],
    name: 'live_class_provider_operations_provider_profile_id_live_class_provider_profiles_id_fk',
  }).onDelete('restrict'),
  unique('live_class_provider_operations_idem_key_unique').on(table.tenantId, table.idempotencyKey),
]);

// ---------------------------------------------------------------------------
// Durable single-use join grants (P0-1)
// ---------------------------------------------------------------------------

export const liveClassJoinGrants = pgTable('live_class_join_grants', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  sessionId: uuid('session_id').notNull(),
  userId: text('user_id').notNull(),
  // The authenticated Better-Auth session the grant was issued under (binding).
  authSessionId: text('auth_session_id'),
  role: varchar('role', { length: 20 }).notNull(), // moderator | viewer
  // SHA-256 hash of the token nonce — the RAW nonce/token is never persisted.
  nonceHash: varchar('nonce_hash', { length: 64 }).notNull(),
  // naive-local timestamp (app convention) — same T-separated format as
  // sessions so string-range comparisons in the services stay tz-correct.
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
  redeemedAt: timestamp('redeemed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'live_class_join_grants_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [liveClassSessions.id],
    name: 'live_class_join_grants_session_id_live_class_sessions_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'live_class_join_grants_user_id_user_id_fk',
  }).onDelete('cascade'),
  unique('live_class_join_grants_nonce_unique').on(table.tenantId, table.sessionId, table.userId, table.nonceHash),
  index('live_class_join_grants_expiry_idx').on(table.tenantId, table.expiresAt).where(sql`${table.redeemedAt} IS NULL`),
]);
