import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer, foreignKey, index, unique, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from '@/models/Schema';

export const documentTemplateTypeEnum = pgEnum('document_template_type', ['student_id', 'employee_id', 'admit_card', 'report_card']);
export const documentTemplateStatusEnum = pgEnum('document_template_status', ['draft', 'published', 'archived']);
export const issuedDocumentStatusEnum = pgEnum('issued_document_status', ['active', 'expired', 'revoked', 'replaced']);
export const documentSubjectTypeEnum = pgEnum('document_subject_type', ['student', 'employee', 'exam_candidate']);
export const documentGenerationJobStatusEnum = pgEnum('document_generation_job_status', ['queued', 'processing', 'partially_completed', 'completed', 'failed', 'cancelled']);
export const documentGenerationItemStatusEnum = pgEnum('document_generation_item_status', ['pending', 'success', 'failed']);
export const documentEventKindEnum = pgEnum('document_event_kind', ['issued', 'downloaded', 'printed', 'reprinted', 'replaced', 'revoked', 'verified']);

export const documentTemplates = pgTable('document_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  type: documentTemplateTypeEnum('type').notNull(),
  status: documentTemplateStatusEnum('status').default('draft').notNull(),
  isDefault: boolean('is_default').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  index('document_templates_tenant_idx').on(table.tenantId),
]);

export const documentTemplateVersions = pgTable('document_template_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  templateId: uuid('template_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  pageWidthMm: integer('page_width_mm').notNull(),
  pageHeightMm: integer('page_height_mm').notNull(),
  orientation: varchar('orientation', { length: 20 }).notNull(), // 'portrait' | 'landscape'
  schemaJson: jsonb('schema_json').notNull(),
  storageKey: varchar('storage_key', { length: 255 }), // points to BlobStore for background image/assets if any
  publishedById: text('published_by_id'),
  publishedAt: timestamp('published_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.templateId], foreignColumns: [documentTemplates.id] }).onDelete('cascade'),
  unique('document_template_versions_tenant_template_version_idx').on(table.tenantId, table.templateId, table.versionNumber),
]);

export const issuedDocuments = pgTable('issued_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  type: documentTemplateTypeEnum('type').notNull(),
  templateVersionId: uuid('template_version_id').notNull(),
  subjectType: documentSubjectTypeEnum('subject_type').notNull(),
  subjectId: text('subject_id').notNull(), // User or Student
  examCandidateId: uuid('exam_candidate_id'), // Specifically for admit cards, references examSeats or equivalent
  publicTokenHash: varchar('public_token_hash', { length: 255 }).notNull(),
  status: issuedDocumentStatusEnum('status').default('active').notNull(),
  validFrom: timestamp('valid_from', { mode: 'string' }),
  validUntil: timestamp('valid_until', { mode: 'string' }),
  renderDataSnapshot: jsonb('render_data_snapshot').notNull(),
  issuedById: text('issued_by_id').notNull(),
  issuedAt: timestamp('issued_at', { mode: 'string' }).defaultNow().notNull(),
  replacedDocumentId: uuid('replaced_document_id'),
  revokedAt: timestamp('revoked_at', { mode: 'string' }),
  revokedById: text('revoked_by_id'),
  revokeReason: text('revoke_reason'),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.templateVersionId], foreignColumns: [documentTemplateVersions.id] }).onDelete('restrict'),
  unique('issued_documents_tenant_token_idx').on(table.tenantId, table.publicTokenHash),
]);

export const documentGenerationJobs = pgTable('document_generation_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  type: documentTemplateTypeEnum('type').notNull(),
  templateVersionId: uuid('template_version_id').notNull(),
  filtersSnapshot: jsonb('filters_snapshot').notNull(),
  status: documentGenerationJobStatusEnum('status').default('queued').notNull(),
  totalCount: integer('total_count').default(0).notNull(),
  successCount: integer('success_count').default(0).notNull(),
  errorCount: integer('error_count').default(0).notNull(),
  startedAt: timestamp('started_at', { mode: 'string' }),
  completedAt: timestamp('completed_at', { mode: 'string' }),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.templateVersionId], foreignColumns: [documentTemplateVersions.id] }).onDelete('restrict'),
  index('document_generation_jobs_tenant_idx').on(table.tenantId),
]);

export const documentGenerationItems = pgTable('document_generation_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  jobId: uuid('job_id').notNull(),
  subjectType: documentSubjectTypeEnum('subject_type').notNull(),
  subjectId: text('subject_id').notNull(),
  issuedDocumentId: uuid('issued_document_id'),
  status: documentGenerationItemStatusEnum('status').default('pending').notNull(),
  errorCode: varchar('error_code', { length: 50 }),
  errorMessage: text('error_message'),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.jobId], foreignColumns: [documentGenerationJobs.id] }).onDelete('cascade'),
  unique('document_generation_items_tenant_job_subject_idx').on(table.tenantId, table.jobId, table.subjectType, table.subjectId),
]);

export const documentEvents = pgTable('document_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  issuedDocumentId: uuid('issued_document_id').notNull(),
  eventKind: documentEventKindEnum('event_kind').notNull(),
  actorId: text('actor_id'), // null for public verification
  timestamp: timestamp('timestamp', { mode: 'string' }).defaultNow().notNull(),
  metadata: jsonb('metadata'),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.issuedDocumentId], foreignColumns: [issuedDocuments.id] }).onDelete('cascade'),
]);
