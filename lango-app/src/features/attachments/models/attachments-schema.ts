import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  jsonb,
  unique,
  index,
} from 'drizzle-orm/pg-core';

export const assetLifecycleStatus = pgEnum('asset_lifecycle_status', [
  'draft',
  'uploading',
  'quarantined',
  'processing',
  'ready',
  'published',
  'archived',
  'upload_failed',
  'scan_failed',
  'infected',
  'processing_failed',
  'rejected',
]);

export const assetTargetKind = pgEnum('asset_target_kind', [
  'school',
  'role',
  'class_offering',
  'class_section',
  'class_subject',
  'user',
]);

export const attachmentTypes = pgTable(
  'attachment_types',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    code: text('code').notNull(),
    icon: text('icon'),
    color: text('color'),
    allowedMimeFamilies: jsonb('allowed_mime_families').notNull(), // e.g. ['image','pdf','document','audio']
    maxSizeBytes: integer('max_size_bytes').default(26214400).notNull(), // 25MB default
    studentVisible: boolean('student_visible').default(true).notNull(),
    downloadable: boolean('downloadable').default(true).notNull(),
    isSystem: boolean('is_system').default(false).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    displayOrder: integer('display_order').default(0).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    unique('uq_attachment_types_tenant_code').on(table.tenantId, table.code),
    index('idx_attachment_types_tenant').on(table.tenantId),
  ],
);

export const digitalAssets = pgTable(
  'digital_assets',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    attachmentTypeId: uuid('attachment_type_id')
      .notNull()
      .references(() => attachmentTypes.id),
    ownerId: text('owner_id').notNull(),
    language: text('language'),
    status: assetLifecycleStatus('status').default('draft').notNull(),
    currentVersionId: uuid('current_version_id'),
    publishAt: timestamp('publish_at', { mode: 'string' }),
    unpublishAt: timestamp('unpublish_at', { mode: 'string' }),
    downloadable: boolean('downloadable').default(true).notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_digital_assets_tenant_status').on(table.tenantId, table.status),
    index('idx_digital_assets_owner').on(table.ownerId),
  ],
);

export const digitalAssetVersions = pgTable(
  'digital_asset_versions',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => digitalAssets.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    storageKey: text('storage_key').notNull(),
    originalFilename: text('original_filename').notNull(),
    safeFilename: text('safe_filename').notNull(),
    detectedMime: text('detected_mime').notNull(),
    extension: text('extension').notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text('sha256').notNull(),
    scanStatus: text('scan_status').default('pending').notNull(), // pending, clean, infected, error
    uploaderId: text('uploader_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    unique('uq_digital_asset_versions_asset_version').on(table.assetId, table.versionNumber),
    index('idx_digital_asset_versions_asset').on(table.assetId),
  ],
);

export const digitalAssetTargets = pgTable(
  'digital_asset_targets',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => digitalAssets.id, { onDelete: 'cascade' }),
    targetKind: assetTargetKind('target_kind').notNull(),
    targetRoleValue: text('target_role_value'),
    targetRefId: text('target_ref_id'),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_digital_asset_targets_asset').on(table.assetId),
  ],
);

export const digitalAssetTags = pgTable(
  'digital_asset_tags',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    tenantId: text('tenant_id').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    unique('uq_digital_asset_tags_tenant_name').on(table.tenantId, table.name),
  ],
);

export const digitalAssetTagLinks = pgTable(
  'digital_asset_tag_links',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => digitalAssets.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => digitalAssetTags.id, { onDelete: 'cascade' }),
  },
  table => [
    unique('uq_digital_asset_tag_links').on(table.assetId, table.tagId),
  ],
);

export const digitalAssetDerivatives = pgTable('digital_asset_derivatives', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  versionId: uuid('version_id')
    .notNull()
    .references(() => digitalAssetVersions.id, { onDelete: 'cascade' }),
  derivativeType: text('derivative_type').notNull(), // preview, thumbnail, text_extraction
  storageKey: text('storage_key'),
  generatorVersion: text('generator_version'),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const digitalAssetLinks = pgTable('digital_asset_links', {
  id: uuid('id').defaultRandom().primaryKey().notNull(),
  assetId: uuid('asset_id')
    .notNull()
    .references(() => digitalAssets.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  provider: text('provider'),
  validationState: text('validation_state').default('unverified').notNull(),
  createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
});

export const digitalAssetUsageLinks = pgTable(
  'digital_asset_usage_links',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => digitalAssets.id, { onDelete: 'cascade' }),
    usageType: text('usage_type').notNull(), // homework, announcement, live_class, event
    usageRefId: text('usage_ref_id').notNull(),
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_digital_asset_usage_links_ref').on(table.usageType, table.usageRefId),
    index('idx_digital_asset_usage_links_asset').on(table.assetId),
  ],
);

export const digitalAssetAccessEvents = pgTable(
  'digital_asset_access_events',
  {
    id: uuid('id').defaultRandom().primaryKey().notNull(),
    assetId: uuid('asset_id')
      .notNull()
      .references(() => digitalAssets.id, { onDelete: 'cascade' }),
    actorId: text('actor_id').notNull(),
    eventType: text('event_type').notNull(), // preview, download
    createdAt: timestamp('created_at', { mode: 'string' }).defaultNow().notNull(),
  },
  table => [
    index('idx_digital_asset_access_events_asset_date').on(table.assetId, table.createdAt),
  ],
);
