// Broadcast Messaging add-on schema (Lead CRM / Broadcast Messaging).
//
// Feature-schema pattern (mirrors inventory-schema.ts): shared types (tenants,
// user) are imported from '@/models/Schema' and this file is re-exported by the
// Schema.ts barrel. All enums are declared locally (same DB types) to avoid the
// TDZ hazard of referencing barrel-imported enums at table-definition time.
//
// Honesty convention (matches existing smsMessages): no real external SMS/email
// is sent by this app. Deliveries are written by provider adapters; the default
// `test`/`log` adapters record `sent` without a real carrier. `delivered` is
// only ever set from provider/webhook evidence, never fabricated.
import { sql } from 'drizzle-orm';
import {
  boolean, foreignKey, index, integer, jsonb, numeric, pgEnum, pgTable,
  text, timestamp, unique, uuid, varchar,
} from 'drizzle-orm/pg-core';
import { tenants, user } from '@/models/Schema';

// ---------------------------------------------------------------------------
// Enums (created idempotently in migration 0079)
// ---------------------------------------------------------------------------

export const broadcastChannel = pgEnum('broadcast_channel', [
  'sms', 'email', 'whatsapp', 'telegram', 'messenger',
]);
export const communicationConnectionStatus = pgEnum('communication_connection_status', [
  'connected', 'disconnected', 'error',
]);
export const communicationTemplateStatus = pgEnum('communication_template_status', [
  'draft', 'published', 'archived',
]);
export const communicationProviderApprovalStatus = pgEnum('communication_provider_approval_status', [
  'not_required', 'draft', 'pending', 'approved', 'rejected',
]);
export const communicationCampaignStatus = pgEnum('communication_campaign_status', [
  'draft', 'pending_approval', 'scheduled', 'queued', 'sending', 'completed', 'failed', 'cancelled',
]);
export const communicationRecipientStatus = pgEnum('communication_recipient_status', [
  'pending', 'queued', 'skipped', 'sent', 'failed',
]);
export const communicationDeliveryStatus = pgEnum('communication_delivery_status', [
  'queued', 'sent', 'delivered', 'failed', 'bounced', 'complained',
]);
export const communicationDeliveryEventType = pgEnum('communication_delivery_event_type', [
  'queued', 'sent', 'delivered', 'failed', 'bounced', 'complained', 'retry', 'webhook_received',
]);
export const communicationRecipientKind = pgEnum('communication_recipient_kind', [
  'inquiry', 'student', 'guardian', 'staff', 'alumni', 'external',
]);
export const communicationAutomationKind = pgEnum('communication_automation_kind', [
  'birthday_student', 'birthday_staff',
]);
export const communicationAutomationRunStatus = pgEnum('communication_automation_run_status', [
  'pending', 'running', 'completed', 'failed',
]);
export const communicationAutomationRecipientStatus = pgEnum('communication_automation_recipient_status', [
  'queued', 'skipped', 'sent', 'failed',
]);

// ---------------------------------------------------------------------------
// Channel connections (encrypted tenant secrets — never returned to browser)
// ---------------------------------------------------------------------------

export const communicationConnections = pgTable('communication_connections', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  channel: broadcastChannel('channel').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  provider: varchar('provider', { length: 60 }).notNull(), // test | sms-log | email-log | <real adapter>
  configJson: jsonb('config_json').default(sql`'{}'::jsonb`).notNull(), // encrypted credentials + non-secret config
  status: communicationConnectionStatus('status').default('disconnected').notNull(),
  lastTestedAt: timestamp('last_tested_at', { mode: 'string' }),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_connections_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'communication_connections_created_by_user_id_fk',
  }).onDelete('set null'),
  unique('communication_connections_tenant_channel_unique').on(table.tenantId, table.channel),
  index('communication_connections_tenant_idx').on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// Consent & suppression (checked at snapshot AND immediately before dispatch)
// ---------------------------------------------------------------------------

export const communicationConsents = pgTable('communication_consents', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  recipientKind: communicationRecipientKind('recipient_kind').notNull(),
  recipientId: text('recipient_id').notNull(),
  channel: broadcastChannel('channel').notNull(),
  granted: boolean('granted').default(true).notNull(),
  source: varchar('source', { length: 60 }).default('admin').notNull(),
  capturedAt: timestamp('captured_at', { mode: 'string' }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_consents_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('communication_consents_tenant_recipient_channel_unique').on(
    table.tenantId, table.recipientKind, table.recipientId, table.channel,
  ),
  index('communication_consents_tenant_kind_idx').on(table.tenantId, table.recipientKind),
]);

export const communicationSuppressions = pgTable('communication_suppressions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  recipientKind: communicationRecipientKind('recipient_kind').notNull(),
  recipientId: text('recipient_id').notNull(),
  channel: broadcastChannel('channel'),
  reason: varchar('reason', { length: 255 }),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_suppressions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.createdBy],
    foreignColumns: [user.id],
    name: 'communication_suppressions_created_by_user_id_fk',
  }).onDelete('set null'),
  index('communication_suppressions_tenant_kind_idx').on(table.tenantId, table.recipientKind),
]);

// Global (channel IS NULL) and channel-specific (channel NOT NULL) suppression
// are each unique via partial indexes in migration 0079, so re-adding the same
// suppression is a no-op upsert.

// ---------------------------------------------------------------------------
// Saved segment definitions (computed live at snapshot)
// ---------------------------------------------------------------------------

export const communicationSegments = pgTable('communication_segments', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  name: varchar('name', { length: 120 }).notNull(),
  description: text('description'),
  definition: jsonb('definition').default(sql`'{}'::jsonb`).notNull(), // { kind, filters }
  memberCount: integer('member_count').default(0).notNull(),
  lastComputedAt: timestamp('last_computed_at', { mode: 'string' }),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_segments_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('communication_segments_tenant_name_unique').on(table.tenantId, table.name),
  index('communication_segments_tenant_idx').on(table.tenantId),
]);

// ---------------------------------------------------------------------------
// Versioned templates (published versions are immutable)
// ---------------------------------------------------------------------------

export const communicationTemplates = pgTable('communication_templates', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 120 }).notNull(),
  channel: broadcastChannel('channel').notNull(),
  category: varchar('category', { length: 60 }).default('general').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_templates_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('communication_templates_tenant_channel_name_unique').on(
    table.tenantId, table.channel, table.name,
  ),
  index('communication_templates_tenant_idx').on(table.tenantId),
]);

export const communicationTemplateVersions = pgTable('communication_template_versions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  templateId: uuid('template_id').notNull(),
  version: integer('version').notNull(),
  subject: varchar('subject', { length: 255 }),
  bodyText: text('body_text').notNull(),
  bodyHtml: text('body_html'),
  variableSchema: jsonb('variable_schema').default(sql`'[]'::jsonb`).notNull(), // [{ name, allowlist? }]
  locale: varchar('locale', { length: 10 }).default('fr').notNull(),
  status: communicationTemplateStatus('status').default('draft').notNull(),
  providerApprovalStatus: communicationProviderApprovalStatus('provider_approval_status').default('not_required').notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_template_versions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.templateId],
    foreignColumns: [communicationTemplates.id],
    name: 'communication_template_versions_template_id_templates_id_fk',
  }).onDelete('cascade'),
  unique('communication_template_versions_tenant_template_version_unique').on(
    table.tenantId, table.templateId, table.version,
  ),
  index('communication_template_versions_tenant_template_idx').on(table.tenantId, table.templateId),
]);

// ---------------------------------------------------------------------------
// Campaigns (recipients + template version frozen at approval)
// ---------------------------------------------------------------------------

export const communicationCampaigns = pgTable('communication_campaigns', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  name: varchar('name', { length: 120 }).notNull(),
  channel: broadcastChannel('channel').notNull(),
  connectionId: uuid('connection_id'),
  segmentId: uuid('segment_id'),
  templateId: uuid('template_id'),
  templateVersionId: uuid('template_version_id'), // frozen at approval
  subject: varchar('subject', { length: 255 }),
  bodyText: text('body_text').notNull(),
  bodyHtml: text('body_html'),
  scheduleAt: timestamp('schedule_at', { mode: 'string' }),
  timezone: varchar('timezone', { length: 60 }).default('Africa/Casablanca').notNull(),
  status: communicationCampaignStatus('status').default('draft').notNull(),
  targetedCount: integer('targeted_count').default(0).notNull(),
  excludedCount: integer('excluded_count').default(0).notNull(),
  invalidCount: integer('invalid_count').default(0).notNull(),
  dedupCount: integer('dedup_count').default(0).notNull(),
  consentExcludedCount: integer('consent_excluded_count').default(0).notNull(),
  suppressionExcludedCount: integer('suppression_excluded_count').default(0).notNull(),
  enqueuedCount: integer('enqueued_count').default(0).notNull(),
  sentCount: integer('sent_count').default(0).notNull(),
  deliveredCount: integer('delivered_count').default(0).notNull(),
  failedCount: integer('failed_count').default(0).notNull(),
  estimatedCost: numeric('estimated_cost', { precision: 12, scale: 2 }).default('0').notNull(),
  idempotencyKey: varchar('idempotency_key', { length: 120 }),
  createdBy: text('created_by'),
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at', { mode: 'string' }),
  sentAt: timestamp('sent_at', { mode: 'string' }),
  completedAt: timestamp('completed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_campaigns_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.connectionId],
    foreignColumns: [communicationConnections.id],
    name: 'communication_campaigns_connection_id_connections_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.segmentId],
    foreignColumns: [communicationSegments.id],
    name: 'communication_campaigns_segment_id_segments_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.templateId],
    foreignColumns: [communicationTemplates.id],
    name: 'communication_campaigns_template_id_templates_id_fk',
  }).onDelete('set null'),
  foreignKey({
    columns: [table.templateVersionId],
    foreignColumns: [communicationTemplateVersions.id],
    name: 'communication_campaigns_template_version_id_versions_id_fk',
  }).onDelete('set null'),
  index('communication_campaigns_tenant_status_idx').on(table.tenantId, table.status),
  index('communication_campaigns_tenant_created_idx').on(table.tenantId, table.createdAt),
]);

// ---------------------------------------------------------------------------
// Recipient snapshot + deliveries (append-only events)
// ---------------------------------------------------------------------------

export const communicationCampaignRecipients = pgTable('communication_campaign_recipients', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  campaignId: uuid('campaign_id').notNull(),
  recipientKind: communicationRecipientKind('recipient_kind').notNull(),
  recipientId: text('recipient_id').notNull(),
  contactName: varchar('contact_name', { length: 255 }),
  phone: varchar('phone', { length: 50 }),
  email: varchar('email', { length: 255 }),
  status: communicationRecipientStatus('status').default('pending').notNull(),
  skipReason: varchar('skip_reason', { length: 120 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_campaign_recipients_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.campaignId],
    foreignColumns: [communicationCampaigns.id],
    name: 'communication_campaign_recipients_campaign_id_campaigns_id_fk',
  }).onDelete('cascade'),
  unique('communication_campaign_recipients_tenant_campaign_recipient_unique').on(
    table.tenantId, table.campaignId, table.recipientKind, table.recipientId,
  ),
  index('communication_campaign_recipients_campaign_status_idx').on(table.campaignId, table.status),
]);

export const communicationDeliveries = pgTable('communication_deliveries', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  campaignId: uuid('campaign_id').notNull(),
  recipientId: uuid('recipient_id').notNull(),
  channel: broadcastChannel('channel').notNull(),
  provider: varchar('provider', { length: 60 }).notNull(),
  status: communicationDeliveryStatus('status').default('queued').notNull(),
  providerRef: varchar('provider_ref', { length: 255 }),
  failureReason: varchar('failure_reason', { length: 255 }),
  retryCount: integer('retry_count').default(0).notNull(),
  maxRetries: integer('max_retries').default(3).notNull(),
  nextRetryAt: timestamp('next_retry_at', { mode: 'string' }),
  lockedUntil: timestamp('locked_until', { mode: 'string' }),
  idempotencyKey: varchar('idempotency_key', { length: 200 }),
  sentAt: timestamp('sent_at', { mode: 'string' }),
  deliveredAt: timestamp('delivered_at', { mode: 'string' }),
  failedAt: timestamp('failed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_deliveries_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.campaignId],
    foreignColumns: [communicationCampaigns.id],
    name: 'communication_deliveries_campaign_id_campaigns_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.recipientId],
    foreignColumns: [communicationCampaignRecipients.id],
    name: 'communication_deliveries_recipient_id_campaign_recipients_id_fk',
  }).onDelete('cascade'),
  index('communication_deliveries_campaign_status_idx').on(table.campaignId, table.status),
  index('communication_deliveries_tenant_status_idx').on(table.tenantId, table.status),
]);

export const communicationDeliveryEvents = pgTable('communication_delivery_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  deliveryId: uuid('delivery_id').notNull(),
  campaignId: uuid('campaign_id'),
  eventType: communicationDeliveryEventType('event_type').notNull(),
  status: varchar('status', { length: 40 }),
  detail: jsonb('detail').default(sql`'{}'::jsonb`).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_delivery_events_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.deliveryId],
    foreignColumns: [communicationDeliveries.id],
    name: 'communication_delivery_events_delivery_id_deliveries_id_fk',
  }).onDelete('cascade'),
  index('communication_delivery_events_delivery_created_idx').on(table.deliveryId, table.createdAt),
]);

// ---------------------------------------------------------------------------
// Automations (birthday wishes etc.) + runs + per-person dedup
// ---------------------------------------------------------------------------

export const communicationAutomations = pgTable('communication_automations', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  branchId: uuid('branch_id'),
  name: varchar('name', { length: 120 }).notNull(),
  kind: communicationAutomationKind('kind').notNull(),
  channel: broadcastChannel('channel').notNull(),
  connectionId: uuid('connection_id'),
  templateId: uuid('template_id'),
  audienceKind: varchar('audience_kind', { length: 30 }).default('student').notNull(), // student | staff
  timezone: varchar('timezone', { length: 60 }).default('Africa/Casablanca').notNull(),
  sendTime: varchar('send_time', { length: 5 }).notNull(), // HH:MM
  quietHoursStart: varchar('quiet_hours_start', { length: 5 }),
  quietHoursEnd: varchar('quiet_hours_end', { length: 5 }),
  approvalMode: varchar('approval_mode', { length: 20 }).default('auto').notNull(), // auto | manual
  isActive: boolean('is_active').default(true).notNull(),
  nextRunAt: timestamp('next_run_at', { mode: 'string' }),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_automations_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  index('communication_automations_tenant_kind_idx').on(table.tenantId, table.kind),
]);

export const communicationAutomationRuns = pgTable('communication_automation_runs', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  automationId: uuid('automation_id').notNull(),
  runDate: varchar('run_date', { length: 10 }).notNull(), // YYYY-MM-DD
  status: communicationAutomationRunStatus('status').default('pending').notNull(),
  createdCount: integer('created_count').default(0).notNull(),
  queuedCount: integer('queued_count').default(0).notNull(),
  skippedCount: integer('skipped_count').default(0).notNull(),
  failedCount: integer('failed_count').default(0).notNull(),
  startedAt: timestamp('started_at', { mode: 'string' }),
  completedAt: timestamp('completed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_automation_runs_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.automationId],
    foreignColumns: [communicationAutomations.id],
    name: 'communication_automation_runs_automation_id_automations_id_fk',
  }).onDelete('cascade'),
  unique('communication_automation_runs_tenant_automation_date_unique').on(
    table.tenantId, table.automationId, table.runDate,
  ),
  index('communication_automation_runs_tenant_idx').on(table.tenantId),
]);

export const communicationAutomationRecipients = pgTable('communication_automation_recipients', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  runId: uuid('run_id').notNull(),
  personId: text('person_id').notNull(),
  channel: broadcastChannel('channel').notNull(),
  status: communicationAutomationRecipientStatus('status').default('queued').notNull(),
  skipReason: varchar('skip_reason', { length: 120 }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, (table) => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'communication_automation_recipients_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.runId],
    foreignColumns: [communicationAutomationRuns.id],
    name: 'communication_automation_recipients_run_id_runs_id_fk',
  }).onDelete('cascade'),
  unique('communication_automation_recipients_tenant_run_person_channel_unique').on(
    table.tenantId, table.runId, table.personId, table.channel,
  ),
  index('communication_automation_recipients_run_idx').on(table.runId),
]);

// Partial unique indexes can't be expressed via the second-arg array helper, so
// they live in migration 0079 SQL: campaign idempotency key, delivery
// idempotency key, global suppression, channel-specific suppression.
