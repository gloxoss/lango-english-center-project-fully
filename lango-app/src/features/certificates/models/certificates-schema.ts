import { pgTable, uuid, varchar, text, timestamp, boolean, jsonb, integer, foreignKey, index, unique, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from '@/models/Schema';

export const certificateStatusEnum = pgEnum('certificate_status', ['draft', 'active', 'archived']);
export const certificateJobStatusEnum = pgEnum('certificate_job_status', ['pending', 'processing', 'completed', 'failed']);
export const certificateJobItemStatusEnum = pgEnum('certificate_job_item_status', ['pending', 'success', 'failed']);
export const certificateRequestStatusEnum = pgEnum('certificate_request_status', ['draft', 'submitted', 'under_review', 'changes_requested', 'approved', 'rejected', 'issued', 'cancelled']);
export const certificateEventKindEnum = pgEnum('certificate_event_kind', ['issued', 'replaced', 'revoked']);
export const issuedCertificateStatusEnum = pgEnum('issued_certificate_status', ['valid', 'replaced', 'revoked']);
export const certificateEventRosterStatusEnum = pgEnum('certificate_event_roster_status', ['going', 'attended', 'not_going']);

export const certificateDefinitions = pgTable('certificate_definitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  allowedTargetType: varchar('allowed_target_type', { length: 50 }).notNull(), // 'student', 'employee'
  status: certificateStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  index('certificate_definitions_tenant_idx').on(table.tenantId),
]);

export const certificateDefinitionVersions = pgTable('certificate_definition_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  definitionId: uuid('definition_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  fieldAllowlist: jsonb('field_allowlist').notNull(),
  templateSchema: jsonb('template_schema').notNull(),
  pdfmeBasePdf: jsonb('pdfme_base_pdf').notNull(),
  status: certificateStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.definitionId], foreignColumns: [certificateDefinitions.id] }).onDelete('cascade'),
  unique('certificate_definition_versions_tenant_definition_version_idx').on(table.tenantId, table.definitionId, table.versionNumber),
]);

export const certificateTemplates = pgTable('certificate_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  status: certificateStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  index('certificate_templates_tenant_idx').on(table.tenantId),
]);

export const certificateTemplateVersions = pgTable('certificate_template_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  templateId: uuid('template_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  templateSchema: jsonb('template_schema').notNull(),
  pdfmeBasePdf: jsonb('pdfme_base_pdf').notNull(),
  status: certificateStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.templateId], foreignColumns: [certificateTemplates.id] }).onDelete('cascade'),
  unique('certificate_template_versions_tenant_template_version_idx').on(table.tenantId, table.templateId, table.versionNumber),
]);

export const certificateRequests = pgTable('certificate_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  definitionId: uuid('definition_id').notNull(),
  requesterId: text('requester_id').notNull(),
  recipientId: text('recipient_id').notNull(),
  evidenceSnapshot: jsonb('evidence_snapshot').notNull(),
  status: certificateRequestStatusEnum('status').default('draft').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.definitionId], foreignColumns: [certificateDefinitions.id] }).onDelete('restrict'),
  index('certificate_requests_tenant_idx').on(table.tenantId),
]);

export const issuedCertificates = pgTable('issued_certificates', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  definitionId: uuid('definition_id').notNull(),
  versionId: uuid('version_id').notNull(),
  recipientId: text('recipient_id').notNull(),
  requestId: uuid('request_id'),
  serialNumber: varchar('serial_number', { length: 100 }).notNull(),
  verificationTokenHash: varchar('verification_token_hash', { length: 255 }).notNull(),
  fileExt: varchar('file_ext', { length: 10 }).notNull(),
  status: issuedCertificateStatusEnum('status').default('valid').notNull(),
  evidenceSnapshot: jsonb('evidence_snapshot').notNull(),
  issuedAt: timestamp('issued_at', { mode: 'string' }).defaultNow().notNull(),
  issuedBy: text('issued_by').notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.definitionId], foreignColumns: [certificateDefinitions.id] }).onDelete('restrict'),
  foreignKey({ columns: [table.versionId], foreignColumns: [certificateDefinitionVersions.id] }).onDelete('restrict'),
  unique('issued_certificates_tenant_serial_idx').on(table.tenantId, table.serialNumber),
  unique('issued_certificates_tenant_token_idx').on(table.tenantId, table.verificationTokenHash),
]);

export const certificateJobs = pgTable('certificate_jobs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  definitionId: uuid('definition_id').notNull(),
  status: certificateJobStatusEnum('status').default('pending').notNull(),
  totalCount: integer('total_count').default(0).notNull(),
  successCount: integer('success_count').default(0).notNull(),
  errorCount: integer('error_count').default(0).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  createdBy: text('created_by').notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  index('certificate_jobs_tenant_idx').on(table.tenantId),
]);

export const certificateJobItems = pgTable('certificate_job_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  jobId: uuid('job_id').notNull(),
  recipientId: text('recipient_id').notNull(),
  status: certificateJobItemStatusEnum('status').default('pending').notNull(),
  errorReason: text('error_reason'),
  issuedCertificateId: uuid('issued_certificate_id'),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.jobId], foreignColumns: [certificateJobs.id] }).onDelete('cascade'),
  unique('certificate_job_items_tenant_job_recipient_idx').on(table.tenantId, table.jobId, table.recipientId),
]);

export const certificateEvents = pgTable('certificate_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  issuedCertificateId: uuid('issued_certificate_id').notNull(),
  eventKind: certificateEventKindEnum('event_kind').notNull(),
  actorId: text('actor_id').notNull(),
  reason: text('reason'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  foreignKey({ columns: [table.issuedCertificateId], foreignColumns: [issuedCertificates.id] }).onDelete('cascade'),
]);

export const certificateSignatories = pgTable('certificate_signatories', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }).notNull(),
  signatureImageId: varchar('signature_image_id', { length: 255 }).notNull(), // points to digitalAssets
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
]);

export const certificateEventRosters = pgTable('certificate_event_rosters', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  eventName: varchar('event_name', { length: 255 }).notNull(),
  participantId: varchar('participant_id', { length: 255 }).notNull(),
  status: certificateEventRosterStatusEnum('status').default('attended').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  foreignKey({ columns: [table.tenantId], foreignColumns: [tenants.id] }).onDelete('cascade'),
  index('certificate_event_rosters_tenant_idx').on(table.tenantId),
  unique('certificate_event_rosters_tenant_event_participant_idx').on(table.tenantId, table.eventName, table.participantId),
]);
