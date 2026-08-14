# Section 01: Schema, Migration & Permissions Foundation

## Overview
Creates the new feature schema file (attachment types, digital assets, versions, targets, tags, usage links, access events), wires it into the main schema barrel, writes migration `0063`, and adds the two new capability keys this addon needs.

## Risk: [green] - straightforward, follows an established, already-proven-3x-this-session pattern (assessment-schema.ts, reporting-schema.ts)

## Dependencies
- Depends on: none
- Blocks: section-04, section-05
- Parallel batch: 1

## TDD Test Stubs
- Test: (schema-only section, no business logic to unit test here — verified via `tsc --noEmit` + a real migration run in section-09)

## Tasks

<task type="auto" id="01-01">
  <name>Create the attachments feature schema file</name>
  <files>src/features/attachments/models/attachments-schema.ts</files>
  <action>
    Create the file following the exact shape of `src/features/assessment/models/assessment-schema.ts` (uuid().defaultRandom().primaryKey().notNull() for ids, tenantId: text('tenant_id').notNull(), createdAt/updatedAt timestamps, index() calls in the third pgTable argument). Define:

    - `assetLifecycleStatus = pgEnum('asset_lifecycle_status', ['draft','uploading','quarantined','processing','ready','published','archived','upload_failed','scan_failed','infected','processing_failed','rejected'])` (local enum, matching the reporting-addon precedent of feature-local enums for fixed lifecycle states).
    - `assetTargetKind = pgEnum('asset_target_kind', ['school','role','class_offering','class_section','class_subject','user'])`.
    - `attachmentTypes`: tenantId, name, code (unique per tenant), icon, color, allowedMimeFamilies (jsonb array of strings e.g. ['image','pdf','document','audio']), maxSizeBytes (integer), studentVisible (boolean default true), downloadable (boolean default true), isSystem (boolean default false — system types are locked from rename/delete), isActive (boolean default true), displayOrder (integer default 0).
    - `digitalAssets`: tenantId, title, description, attachmentTypeId (references attachmentTypes.id), ownerId (text, the creating user's id), language, status (assetLifecycleStatus, default 'draft'), currentVersionId (uuid, nullable — set once the first version is ready), publishAt (timestamp, nullable), unpublishAt (timestamp, nullable), downloadable (boolean default true, inherited default from type at creation time but overridable per-asset), createdAt, updatedAt.
    - `digitalAssetVersions`: assetId (references digitalAssets.id), versionNumber (integer, monotonic per asset), storageKey (text — the BlobStore key), originalFilename, safeFilename, detectedMime, extension, byteSize (integer), sha256 (text), scanStatus (text: 'pending'|'clean'|'infected'|'error', default 'pending'), uploaderId (text), createdAt. Add a unique index on (assetId, versionNumber).
    - `digitalAssetTargets`: assetId (references digitalAssets.id), targetKind (assetTargetKind), targetRoleValue (text, nullable — holds the role string when targetKind='role'), targetRefId (text, nullable — holds classSectionId/classSubjectId/userId depending on targetKind; 'school' kind has both null). Add an index on (assetId).
    - `digitalAssetTags` (tenantId, name, unique per tenant) and `digitalAssetTagLinks` (assetId, tagId).
    - `digitalAssetUsageLinks`: assetId, usageType (text: 'homework'|'announcement'|'live_class'), usageRefId (text), createdAt. Index on (usageType, usageRefId) for reverse lookups.
    - `digitalAssetAccessEvents`: assetId, actorId (text), eventType (text: 'preview'|'download'), createdAt. Index on (assetId, createdAt) — this table is append-only and intentionally has no retention/aggregation job in v1 (documented follow-up per PRD.md Section 7's ops-dashboard deferral).

    Do NOT create an `uploadSessions` table — v1 has no resumable-upload state to persist (see PRD.md Section 7).
  </action>
  <verify>File compiles under `tsc --noEmit` once wired into Schema.ts (task 01-02). Every table has tenantId except the child tables that inherit tenant scope through their parent (versions/targets/tags-links/usage-links/access-events — these are scoped via a join to digitalAssets.tenantId at query time, matching how homeworkDetails/homeworkAttempts relate to assessmentDefinitions in the existing assessment schema).</verify>
  <done>attachments-schema.ts exists with all 8 tables + 2 enums, follows the established feature-schema style exactly.</done>
</task>

<task type="auto" id="01-02">
  <name>Wire the new schema into the main barrel</name>
  <files>src/models/Schema.ts</files>
  <action>
    Add one line near the other feature-schema re-exports (after the assessment export, ~line 3910): `export * from '@/features/attachments/models/attachments-schema';`. No other change needed in Schema.ts or src/libs/DB.ts (DB.ts imports `* as schema from '@/models/Schema'` and picks up new tables automatically through the barrel).
  </action>
  <verify>`grep "attachments-schema" src/models/Schema.ts` shows the new line; `tsc --noEmit` has no new errors from this file.</verify>
  <done>Schema.ts re-exports the attachments schema.</done>
</task>

<task type="auto" id="01-03">
  <name>Write migration 0063</name>
  <files>migrations/0063_attachments_book.sql</files>
  <action>
    Generate via `npx drizzle-kit generate` (or hand-write matching the exact SQL style of `migrations/0062_seed_report_definitions.sql` and `migrations/0060_assessment_and_examination.sql` if drizzle-kit isn't runnable in this environment) covering: both new enum types, all 8 new tables, and their indexes/unique constraints as defined in 01-01. Confirm the migration file is added to `migrations/meta/_journal.json` (drizzle-kit generate does this automatically; if hand-written, add the corresponding journal entry following the exact shape of entry `62`).
  </action>
  <verify>Migration file's SQL is syntactically valid Postgres (visually matches sibling migrations' `CREATE TYPE`/`CREATE TABLE` style); journal entry added.</verify>
  <done>migrations/0063_attachments_book.sql exists and is registered in the journal.</done>
</task>

<task type="auto" id="01-04">
  <name>Add content.manage and content.types.manage capability keys</name>
  <files>src/libs/api/permissions.ts</files>
  <action>
    In the `PERMISSIONS` const map, add two entries right after the existing `'crm.manage'` line (end of the map, ~line 90):
    ```ts
    'content.manage': 'Gérer les ressources pédagogiques',
    'content.types.manage': 'Configurer les types de pièces jointes',
    ```
    In `DEFAULT_ROLE_PERMISSIONS`, add `'content.manage'` to the `teacher` array (alongside `grading.manage` etc.) — teachers create/manage their own resources. Do NOT add `content.types.manage` to `teacher` — taxonomy configuration is admin-only, and `school_admin`/`super_admin` already receive it automatically via `ALL_PERMISSIONS`.
  </action>
  <verify>`grep "content.manage\|content.types.manage" src/libs/api/permissions.ts` shows both keys in PERMISSIONS and `content.manage` (only) in the teacher array. `tsc --noEmit` passes (PermissionKey union updates automatically since it's `keyof typeof PERMISSIONS`).</verify>
  <done>Both capability keys exist; teacher has content.manage but not content.types.manage; admin roles have both via ALL_PERMISSIONS.</done>
</task>
