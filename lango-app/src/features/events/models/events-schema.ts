import { sql } from 'drizzle-orm';
import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from 'drizzle-orm/pg-core';

export const eventLifecycleStatus = pgEnum('event_lifecycle_status', ['draft', 'pending_approval', 'published', 'completed', 'cancelled', 'archived']);
export const eventRecurrenceRule = pgEnum('event_recurrence_rule', ['none', 'daily', 'weekly', 'monthly']);
export const eventVenueType = pgEnum('event_venue_type', ['physical', 'online', 'hybrid']);
export const eventAudienceTargetKind = pgEnum('event_audience_target_kind', ['school', 'role', 'class_offering', 'class_section', 'class_subject', 'user', 'group']);
export const eventRegistrationStatus = pgEnum('event_registration_status', ['going', 'maybe', 'declined', 'waitlisted', 'cancelled']);
export const eventInvitationStatus = pgEnum('event_invitation_status', ['pending', 'sent', 'opened', 'responded']);
export const eventWaitlistStatus = pgEnum('event_waitlist_status', ['queued', 'offered', 'expired', 'accepted', 'declined']);
export const eventCheckinMethod = pgEnum('event_checkin_method', ['qr', 'manual_search', 'self_service']);

export const eventTypes = pgTable('event_types', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  style: jsonb('style'), // color, icon, etc
  requiresApproval: boolean('requires_approval').default(false).notNull(),
  requiresRsvp: boolean('requires_rsvp').default(false).notNull(),
  requiresCheckin: boolean('requires_checkin').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('event_types_tenant_idx').on(table.tenantId),
]);

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  ownerId: text('owner_id').notNull(),
  typeId: uuid('type_id'),
  eventType: text('event_type').notNull().default('event'), // 'event' or 'holiday' or 'closure'
  isSystemGenerated: boolean('is_system_generated').default(false).notNull(),
  title: text('title').notNull(),
  description: text('description'),
  visibility: text('visibility').notNull().default('internal'), // internal, public
  lifecycle: eventLifecycleStatus('lifecycle').notNull().default('draft'),
  timezone: text('timezone').notNull().default('UTC'),
  publishedAt: timestamp('published_at', { mode: 'string' }),
  cancelledAt: timestamp('cancelled_at', { mode: 'string' }),
  cancellationReason: text('cancellation_reason'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('events_tenant_idx').on(table.tenantId),
]);

export const eventSchedules = pgTable('event_schedules', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  startTime: timestamp('start_time', { mode: 'string' }).notNull(),
  endTime: timestamp('end_time', { mode: 'string' }).notNull(),
  isAllDay: boolean('is_all_day').default(false).notNull(),
  timezone: text('timezone').notNull().default('UTC'),
  recurrenceRule: eventRecurrenceRule('recurrence_rule').default('none').notNull(),
  recurrenceEndDate: timestamp('recurrence_end_date', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('event_schedules_event_idx').on(table.eventId),
]);

export const eventOccurrences = pgTable('event_occurrences', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  scheduleId: uuid('schedule_id').notNull().references(() => eventSchedules.id, { onDelete: 'cascade' }),
  originalDate: text('original_date').notNull(), // YYYY-MM-DD
  startTime: timestamp('start_time', { mode: 'string' }).notNull(),
  endTime: timestamp('end_time', { mode: 'string' }).notNull(),
  isCancelled: boolean('is_cancelled').default(false).notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('event_occurrences_event_idx').on(table.eventId),
]);

export const eventVenues = pgTable('event_venues', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  occurrenceId: uuid('occurrence_id').references(() => eventOccurrences.id, { onDelete: 'cascade' }),
  venueType: eventVenueType('venue_type').default('physical').notNull(),
  name: text('name'),
  address: text('address'),
  capacity: integer('capacity'),
  onlineLink: text('online_link'),
  accessibilityNotes: text('accessibility_notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('event_venues_event_idx').on(table.eventId),
]);

export const eventAudienceRules = pgTable('event_audience_rules', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  targetKind: eventAudienceTargetKind('target_kind').notNull(),
  targetRoleValue: text('target_role_value'),
  targetRefId: text('target_ref_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('event_audience_rules_event_idx').on(table.eventId),
]);

export const eventInvitations = pgTable('event_invitations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  occurrenceId: uuid('occurrence_id').references(() => eventOccurrences.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull(),
  status: eventInvitationStatus('status').default('pending').notNull(),
  sentAt: timestamp('sent_at', { mode: 'string' }),
  respondedAt: timestamp('responded_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('event_invitations_event_idx').on(table.eventId),
  index('event_invitations_person_idx').on(table.personId),
]);

export const eventRegistrations = pgTable('event_registrations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  occurrenceId: uuid('occurrence_id').notNull().references(() => eventOccurrences.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull(),
  status: eventRegistrationStatus('status').default('going').notNull(),
  seats: integer('seats').default(1).notNull(),
  answers: jsonb('answers'),
  consentGiven: boolean('consent_given').default(false).notNull(),
  idempotencyKey: text('idempotency_key'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  unique('event_registrations_occurrence_person_unique').on(table.occurrenceId, table.personId),
]);

export const eventWaitlistEntries = pgTable('event_waitlist_entries', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  occurrenceId: uuid('occurrence_id').notNull().references(() => eventOccurrences.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull(),
  status: eventWaitlistStatus('status').default('queued').notNull(),
  queuedAt: timestamp('queued_at', { mode: 'string' }).defaultNow().notNull(),
  offerExpiresAt: timestamp('offer_expires_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('event_waitlist_occurrence_idx').on(table.occurrenceId),
]);

export const eventCheckins = pgTable('event_checkins', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  occurrenceId: uuid('occurrence_id').notNull().references(() => eventOccurrences.id, { onDelete: 'cascade' }),
  registrationId: uuid('registration_id').references(() => eventRegistrations.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull(),
  method: eventCheckinMethod('method').default('manual_search').notNull(),
  operatorId: text('operator_id'),
  timestamp: timestamp('timestamp', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('event_checkins_occurrence_idx').on(table.occurrenceId),
]);

export const eventReminderRules = pgTable('event_reminder_rules', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  occurrenceId: uuid('occurrence_id').references(() => eventOccurrences.id, { onDelete: 'cascade' }),
  beforeMinutes: integer('before_minutes').notNull(),
  channel: text('channel').notNull().default('email'),
  enabled: boolean('enabled').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('event_reminder_rules_event_idx').on(table.eventId),
]);

export const eventCommunicationJobs = pgTable('event_communication_jobs', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(), // reminder | invitation | announcement | cancellation | feedback_request
  payload: jsonb('payload'),
  status: text('status').notNull().default('queued'), // queued | sent | failed
  scheduledFor: timestamp('scheduled_for', { mode: 'string' }),
  sentAt: timestamp('sent_at', { mode: 'string' }),
  error: text('error'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('event_communication_jobs_event_idx').on(table.eventId),
]);

export const eventAttachments = pgTable('event_attachments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  occurrenceId: uuid('occurrence_id').references(() => eventOccurrences.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  fileKey: text('file_key').notNull(),
  mimeType: text('mime_type'),
  sizeBytes: integer('size_bytes'),
  kind: text('kind').notNull().default('document'), // document | image | other
  uploadedById: text('uploaded_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('event_attachments_event_idx').on(table.eventId),
]);

export const eventTasks = pgTable('event_tasks', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  occurrenceId: uuid('occurrence_id').references(() => eventOccurrences.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('todo'), // todo | in_progress | done | cancelled
  dueAt: timestamp('due_at', { mode: 'string' }),
  assigneeId: text('assignee_id'),
  createdById: text('created_by_id').notNull(),
  completedAt: timestamp('completed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('event_tasks_event_idx').on(table.eventId),
]);

export const eventIncidents = pgTable('event_incidents', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  occurrenceId: uuid('occurrence_id').references(() => eventOccurrences.id, { onDelete: 'cascade' }),
  severity: text('severity').notNull().default('medium'), // low | medium | high | critical
  title: text('title').notNull(),
  description: text('description'),
  status: text('status').notNull().default('open'), // open | resolving | resolved | closed
  reportedById: text('reported_by_id').notNull(),
  resolvedById: text('resolved_by_id'),
  resolvedAt: timestamp('resolved_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('event_incidents_event_idx').on(table.eventId),
]);

export const eventFeedback = pgTable('event_feedback', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  occurrenceId: uuid('occurrence_id').references(() => eventOccurrences.id, { onDelete: 'cascade' }),
  personId: text('person_id').notNull(),
  rating: integer('rating'), // 1..5
  comment: text('comment'),
  status: text('status').notNull().default('pending'), // pending | published | hidden
  createdById: text('created_by_id').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => [
  index('event_feedback_event_idx').on(table.eventId),
]);

export const eventAuditEvents = pgTable('event_audit_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: text('tenant_id').notNull(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // create | update | publish | cancel | checkin | registration | invite | reminder | delete
  actorId: text('actor_id').notNull(),
  details: jsonb('details'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  index('event_audit_events_event_idx').on(table.eventId),
]);
