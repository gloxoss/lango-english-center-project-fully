import { sql } from 'drizzle-orm';
import { bigint, boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { branches, tenants, user } from '@/models/Schema';

export const reportRunStatus = pgEnum('report_run_status', [
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'expired',
]);

export const reportExportFormat = pgEnum('report_export_format', [
  'csv',
  'xlsx',
  'pdf',
]);

export const reportDefinitions = pgTable('report_definitions', {
  key: varchar('key', { length: 100 }).primaryKey().notNull(),
  domain: varchar('domain', { length: 50 }).notNull(),
  currentVersion: integer('current_version').default(1).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  sensitivityLevel: varchar('sensitivity_level', { length: 50 }).default('standard').notNull(),
  freshnessType: varchar('freshness_type', { length: 50 }).default('realtime').notNull(),
  executionAdapter: varchar('execution_adapter', { length: 100 }).notNull(),
  parametersSchema: jsonb('parameters_schema'),
  columnsSchema: jsonb('columns_schema'),
  supportedFormats: text('supported_formats').array().default(sql`ARRAY['csv']::text[]`).notNull(),
  requiredPermissions: text('required_permissions').array().default(sql`ARRAY[]::text[]`).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

export const reportDefinitionVersions = pgTable('report_definition_versions', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  reportKey: varchar('report_key', { length: 100 }).notNull().references(() => reportDefinitions.key, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  queryAdapter: varchar('query_adapter', { length: 100 }).notNull(),
  sqlTemplate: text('sql_template'),
  columnsSchema: jsonb('columns_schema'),
  parametersSchema: jsonb('parameters_schema'),
  checksum: varchar('checksum', { length: 64 }),
  publishedAt: timestamp('published_at', { mode: 'string' }).defaultNow().notNull(),
  publishedById: text('published_by_id').references(() => user.id, { onDelete: 'set null' }),
});

export const reportSavedViews = pgTable('report_saved_views', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  reportKey: varchar('report_key', { length: 100 }).notNull().references(() => reportDefinitions.key, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  isShared: boolean('is_shared').default(false).notNull(),
  parameters: jsonb('parameters').default({}).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

export const reportFavorites = pgTable('report_favorites', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  reportKey: varchar('report_key', { length: 100 }).notNull().references(() => reportDefinitions.key, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const reportRuns = pgTable('report_runs', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  reportKey: varchar('report_key', { length: 100 }).notNull().references(() => reportDefinitions.key, { onDelete: 'cascade' }),
  version: integer('version').default(1).notNull(),
  requesterId: text('requester_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  status: reportRunStatus('status').default('queued').notNull(),
  parameters: jsonb('parameters').default({}).notNull(),
  asOfDate: timestamp('as_of_date', { mode: 'string' }).defaultNow().notNull(),
  sourceWatermarks: jsonb('source_watermarks').default({}).notNull(),
  rowCount: integer('row_count').default(0).notNull(),
  executionTimeMs: integer('execution_time_ms'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { mode: 'string' }),
});

export const reportRunEvents = pgTable('report_run_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  runId: uuid('run_id').notNull().references(() => reportRuns.id, { onDelete: 'cascade' }),
  eventType: varchar('event_type', { length: 50 }).notNull(),
  message: text('message').notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const reportArtifacts = pgTable('report_artifacts', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  runId: uuid('run_id').notNull().references(() => reportRuns.id, { onDelete: 'cascade' }),
  format: reportExportFormat('format').notNull(),
  filePath: text('file_path').notNull(),
  fileSizeBytes: integer('file_size_bytes').default(0).notNull(),
  checksumSha256: varchar('checksum_sha256', { length: 64 }).notNull(),
  downloadCount: integer('download_count').default(0).notNull(),
  expiresAt: timestamp('expires_at', { mode: 'string' }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const reportSchedules = pgTable('report_schedules', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  branchId: uuid('branch_id').references(() => branches.id, { onDelete: 'set null' }),
  reportKey: varchar('report_key', { length: 100 }).notNull().references(() => reportDefinitions.key, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  cronExpression: varchar('cron_expression', { length: 100 }).notNull(),
  timezone: varchar('timezone', { length: 50 }).default('UTC').notNull(),
  format: reportExportFormat('format').default('csv').notNull(),
  parameters: jsonb('parameters').default({}).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  createdById: text('created_by_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  lastRunAt: timestamp('last_run_at', { mode: 'string' }),
  nextRunAt: timestamp('next_run_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

export const reportScheduleRecipients = pgTable('report_schedule_recipients', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  scheduleId: uuid('schedule_id').notNull().references(() => reportSchedules.id, { onDelete: 'cascade' }),
  recipientType: varchar('recipient_type', { length: 20 }).notNull(),
  recipientTarget: text('recipient_target').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const reportSnapshots = pgTable('report_snapshots', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  reportKey: varchar('report_key', { length: 100 }).notNull().references(() => reportDefinitions.key, { onDelete: 'cascade' }),
  periodKey: varchar('period_key', { length: 100 }).notNull(),
  snapshotData: jsonb('snapshot_data').notNull(),
  checksumSha256: varchar('checksum_sha256', { length: 64 }).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  createdById: text('created_by_id').references(() => user.id, { onDelete: 'set null' }),
});

export const reportSnapshotSources = pgTable('report_snapshot_sources', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  snapshotId: uuid('snapshot_id').notNull().references(() => reportSnapshots.id, { onDelete: 'cascade' }),
  sourceTable: varchar('source_table', { length: 100 }).notNull(),
  maxSourceId: text('max_source_id'),
  watermarkTimestamp: timestamp('watermark_timestamp', { mode: 'string' }).notNull(),
});

export const reportProjectionWatermarks = pgTable('report_projection_watermarks', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  projectionName: varchar('projection_name', { length: 100 }).notNull(),
  lastWatermark: timestamp('last_watermark', { mode: 'string' }).notNull(),
  rowCount: bigint('row_count', { mode: 'number' }).default(0).notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
});

export const reportDeliveryEvents = pgTable('report_delivery_events', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  scheduleId: uuid('schedule_id').notNull().references(() => reportSchedules.id, { onDelete: 'cascade' }),
  runId: uuid('run_id').references(() => reportRuns.id, { onDelete: 'set null' }),
  recipient: text('recipient').notNull(),
  deliveryStatus: varchar('delivery_status', { length: 50 }).notNull(),
  sentAt: timestamp('sent_at', { mode: 'string' }).defaultNow().notNull(),
  failureReason: text('failure_reason'),
});
