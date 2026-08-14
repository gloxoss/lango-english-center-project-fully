import {
  boolean,
  foreignKey,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { tenants, user } from '../../../models/Schema';

// ---------------------------------------------------------------------------
// DB-backed setting catalog (synced from src/libs/settings/registry.ts).
// Only metadata is persisted; the Zod valueSchema stays code-owned.
// ---------------------------------------------------------------------------

export const settingDefinitions = pgTable('setting_definitions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  key: varchar({ length: 128 }).notNull(),
  label: varchar({ length: 255 }).notNull(),
  description: text(),
  namespace: varchar({ length: 100 }).notNull(),
  scope: varchar({ length: 20 }).default('tenant').notNull(),
  sensitivity: varchar({ length: 20 }).default('public').notNull(),
  defaultValue: jsonb('default_value'),
  requiredPermission: varchar('required_permission', { length: 128 }),
  legacyField: varchar('legacy_field', { length: 128 }),
  isActive: boolean('is_active').default(true).notNull(),
  isCodeOwned: boolean('is_code_owned').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'setting_definitions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('setting_definitions_tenant_key_unique').on(table.tenantId, table.key),
  index('setting_definitions_tenant_ns_idx').on(table.tenantId, table.namespace),
]);

export const settingDefinitionVersions = pgTable('setting_definition_versions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  definitionId: uuid('definition_id').notNull(),
  version: integer().notNull(),
  label: varchar({ length: 255 }).notNull(),
  description: text(),
  namespace: varchar({ length: 100 }).notNull(),
  scope: varchar({ length: 20 }).notNull(),
  sensitivity: varchar({ length: 20 }).notNull(),
  defaultValue: jsonb('default_value'),
  requiredPermission: varchar('required_permission', { length: 128 }),
  legacyField: varchar('legacy_field', { length: 128 }),
  actorId: text('actor_id'),
  reason: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'setting_definition_versions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.definitionId],
    foreignColumns: [settingDefinitions.id],
    name: 'setting_definition_versions_definition_id_setting_definitions_id_fk',
  }).onDelete('cascade'),
  index('setting_definition_versions_def_idx').on(table.definitionId),
]);

// ---------------------------------------------------------------------------
// Maker/checker review workflow.
// ---------------------------------------------------------------------------

export const settingDrafts = pgTable('setting_drafts', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  key: varchar({ length: 128 }).notNull(),
  branchId: uuid('branch_id'),
  title: varchar({ length: 255 }).notNull(),
  reason: text(),
  proposedValue: jsonb('proposed_value').notNull(),
  currentValue: jsonb('current_value'),
  baseVersion: integer('base_version').default(0).notNull(),
  status: varchar({ length: 20 }).default('draft').notNull(),
  authorId: text('author_id').notNull(),
  approverId: text('approver_id'),
  rejectionReason: text('rejection_reason'),
  reviewedAt: timestamp('reviewed_at', { mode: 'string' }),
  appliedAt: timestamp('applied_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'setting_drafts_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.authorId],
    foreignColumns: [user.id],
    name: 'setting_drafts_author_id_user_id_fk',
  }).onDelete('restrict'),
  index('setting_drafts_tenant_status_idx').on(table.tenantId, table.status),
]);

export const settingApprovals = pgTable('setting_approvals', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  draftId: uuid('draft_id').notNull(),
  decision: varchar({ length: 20 }).notNull(),
  approverId: text('approver_id').notNull(),
  comment: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'setting_approvals_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.draftId],
    foreignColumns: [settingDrafts.id],
    name: 'setting_approvals_draft_id_setting_drafts_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.approverId],
    foreignColumns: [user.id],
    name: 'setting_approvals_approver_id_user_id_fk',
  }).onDelete('restrict'),
  index('setting_approvals_draft_idx').on(table.draftId),
]);

// ---------------------------------------------------------------------------
// Secret rotation audit.
// ---------------------------------------------------------------------------

export const secretReferences = pgTable('secret_references', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  key: varchar({ length: 128 }).notNull(),
  settingValueId: uuid('setting_value_id'),
  cipher: varchar({ length: 20 }).default('aes-256-gcm').notNull(),
  rotatedAt: timestamp('rotated_at', { mode: 'string' }).notNull(),
  rotatedBy: text('rotated_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'secret_references_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  index('secret_references_tenant_key_idx').on(table.tenantId, table.key),
]);

// ---------------------------------------------------------------------------
// Numbering series registry (invoice / matricule sequences).
// ---------------------------------------------------------------------------

export const numberingSeriesDefinitions = pgTable('numbering_series_definitions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  key: varchar({ length: 128 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  prefix: text(),
  suffix: text(),
  padding: integer().default(0).notNull(),
  start: integer().default(1).notNull(),
  current: integer().default(0).notNull(),
  step: integer().default(1).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'numbering_series_definitions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('numbering_series_definitions_tenant_key_unique').on(table.tenantId, table.key),
]);

export const numberingSeriesVersions = pgTable('numbering_series_versions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  seriesId: uuid('series_id').notNull(),
  version: integer().notNull(),
  prefix: text(),
  suffix: text(),
  padding: integer().notNull(),
  start: integer().notNull(),
  current: integer().notNull(),
  step: integer().notNull(),
  actorId: text('actor_id'),
  reason: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'numbering_series_versions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.seriesId],
    foreignColumns: [numberingSeriesDefinitions.id],
    name: 'numbering_series_versions_series_id_numbering_series_definitions_id_fk',
  }).onDelete('cascade'),
  index('numbering_series_versions_series_idx').on(table.seriesId),
]);

// ---------------------------------------------------------------------------
// Custom field registry (student / guardian / employee attributes).
// ---------------------------------------------------------------------------

export const customFieldDefinitions = pgTable('custom_field_definitions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  key: varchar({ length: 128 }).notNull(),
  label: varchar({ length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  fieldType: varchar('field_type', { length: 20 }).notNull(),
  options: jsonb(),
  required: boolean().default(false).notNull(),
  defaultValue: jsonb('default_value'),
  sortOrder: integer('sort_order').default(0).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'custom_field_definitions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('custom_field_definitions_tenant_key_unique').on(table.tenantId, table.key),
]);

export const customFieldDefinitionVersions = pgTable('custom_field_definition_versions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  definitionId: uuid('definition_id').notNull(),
  version: integer().notNull(),
  label: varchar({ length: 255 }).notNull(),
  entityType: varchar('entity_type', { length: 30 }).notNull(),
  fieldType: varchar('field_type', { length: 20 }).notNull(),
  options: jsonb(),
  required: boolean().notNull(),
  defaultValue: jsonb('default_value'),
  sortOrder: integer('sort_order').notNull(),
  actorId: text('actor_id'),
  reason: text(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'custom_field_definition_versions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.definitionId],
    foreignColumns: [customFieldDefinitions.id],
    name: 'custom_field_definition_versions_definition_id_custom_field_definitions_id_fk',
  }).onDelete('cascade'),
]);

export const customFieldValues = pgTable('custom_field_values', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  definitionId: uuid('definition_id').notNull(),
  entityId: text('entity_id').notNull(),
  value: jsonb().notNull(),
  updatedBy: text('updated_by'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'custom_field_values_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.definitionId],
    foreignColumns: [customFieldDefinitions.id],
    name: 'custom_field_values_definition_id_custom_field_definitions_id_fk',
  }).onDelete('cascade'),
  unique('custom_field_values_tenant_def_entity_unique').on(table.tenantId, table.definitionId, table.entityId),
  index('custom_field_values_entity_idx').on(table.definitionId, table.entityId),
]);

// ---------------------------------------------------------------------------
// Scheduled jobs (allowlisted handlers only).
// ---------------------------------------------------------------------------

export const scheduledJobDefinitions = pgTable('scheduled_job_definitions', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  key: varchar({ length: 128 }).notNull(),
  name: varchar({ length: 255 }).notNull(),
  handler: varchar({ length: 100 }).notNull(),
  intervalMinutes: integer('interval_minutes'),
  cron: text(),
  isActive: boolean('is_active').default(true).notNull(),
  lastRunAt: timestamp('last_run_at', { mode: 'string' }),
  nextRunAt: timestamp('next_run_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'scheduled_job_definitions_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  unique('scheduled_job_definitions_tenant_key_unique').on(table.tenantId, table.key),
  index('scheduled_job_definitions_due_idx').on(table.isActive, table.nextRunAt),
]);

export const scheduledJobControls = pgTable('scheduled_job_controls', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  jobId: uuid('job_id').notNull(),
  action: varchar({ length: 30 }).notNull(),
  actorId: text('actor_id').notNull(),
  metadata: jsonb(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'scheduled_job_controls_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.jobId],
    foreignColumns: [scheduledJobDefinitions.id],
    name: 'scheduled_job_controls_job_id_scheduled_job_definitions_id_fk',
  }).onDelete('cascade'),
]);

export const scheduledJobRuns = pgTable('scheduled_job_runs', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull(),
  jobId: uuid('job_id').notNull(),
  status: varchar({ length: 20 }).notNull(),
  startedAt: timestamp('started_at', { mode: 'string' }).notNull(),
  finishedAt: timestamp('finished_at', { mode: 'string' }),
  durationMs: integer('duration_ms'),
  error: text(),
  triggeredBy: varchar('triggered_by', { length: 20 }).default('worker').notNull(),
  metadata: jsonb(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'scheduled_job_runs_tenant_id_tenants_id_fk',
  }).onDelete('cascade'),
  foreignKey({
    columns: [table.jobId],
    foreignColumns: [scheduledJobDefinitions.id],
    name: 'scheduled_job_runs_job_id_scheduled_job_definitions_id_fk',
  }).onDelete('cascade'),
  index('scheduled_job_runs_job_idx').on(table.jobId, table.startedAt),
]);

// ---------------------------------------------------------------------------
// Email/password login capture (success + failure).
// ---------------------------------------------------------------------------

export const loginEvents = pgTable('login_events', {
  id: uuid().defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id'),
  userId: text('user_id'),
  email: varchar({ length: 255 }),
  method: varchar({ length: 30 }).notNull(),
  success: boolean().notNull(),
  failureReason: text('failure_reason'),
  ip: varchar({ length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({
    columns: [table.tenantId],
    foreignColumns: [tenants.id],
    name: 'login_events_tenant_id_tenants_id_fk',
  }).onDelete('set null'),
  index('login_events_tenant_created_idx').on(table.tenantId, table.createdAt),
  index('login_events_user_idx').on(table.userId, table.createdAt),
]);
