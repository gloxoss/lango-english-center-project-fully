import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

export const documentDesigns = pgTable('document_designs', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  kind: varchar('kind', { length: 60 }).notNull(),
  draft: jsonb('draft').notNull(),
  publishedVersionId: uuid('published_version_id'),
  updatedById: text('updated_by_id').notNull(),
  updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [uniqueIndex('document_designs_tenant_kind_unique').on(table.tenantId, table.kind)]);

export const documentDesignVersions = pgTable('document_design_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  designId: uuid('design_id').notNull(),
  versionNumber: integer('version_number').notNull(),
  settings: jsonb('settings').notNull(),
  publishedById: text('published_by_id').notNull(),
  publishedAt: timestamp('published_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('document_design_versions_number_unique').on(table.tenantId, table.designId, table.versionNumber),
  index('document_design_versions_tenant_idx').on(table.tenantId),
]);

export const documentArtifacts = pgTable('document_artifacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  kind: varchar('kind', { length: 60 }).notNull(),
  sourceId: text('source_id').notNull(),
  designVersionId: uuid('design_version_id'),
  storageKey: text('storage_key').notNull(),
  sha256: varchar('sha256', { length: 64 }).notNull(),
  byteSize: integer('byte_size').notNull(),
  filename: varchar('filename', { length: 255 }).notNull(),
  archiveOrigin: varchar('archive_origin', { length: 30 }).default('issued').notNull(),
  createdById: text('created_by_id'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
}, table => [
  uniqueIndex('document_artifacts_source_unique').on(table.tenantId, table.kind, table.sourceId),
  index('document_artifacts_tenant_idx').on(table.tenantId),
]);
