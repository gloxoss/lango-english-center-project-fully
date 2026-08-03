# Attachments Book Addon Plan

Status: planned optional addon, not built  
Addon ID: `attachments-book`  
Reference scope: Upload Content, Attachment Types, browsing/downloading, and administration

## Product decision

Build a tenant-scoped academic resource library, not a generic file manager and not a duplicate homework system. A resource may be shared with classes/subjects and reused by assignments, announcements, or live classes. Assignment due dates, submissions, grading, and attempts remain in the core assignment domain.

This is an addon because existing student/teacher documents and assignment submissions must continue to work independently. The addon supplies richer reusable learning content, taxonomy, publishing, quotas, search, previews, and analytics.

## What Lango has today

- A secure helper for small purpose-specific local-disk uploads with tenant namespace, size/type checks, and basic magic-byte validation.
- Real student documents, photos, logos, excuse documents, and assignment-submission metadata.
- Active `classSections`, `classSubjects`, users, and assignments.
- No reusable academic asset library, attachment types, audience/publish lifecycle, versioning, resumable uploads, malware quarantine, content extraction, preview jobs, or download analytics.
- The old `courseAttachments` table points to the deprecated LMS `courses` chain and must not be reused.

## Pages

### Content library

- Search/filter by title, type, subject, class/section, publisher, date, tags, visibility, status, and file kind.
- Table/grid modes with preview, download, version, usage count, status, owner, and actions.
- Saved filters and CSV metadata export; never export private file URLs.

### Create/edit content

- Title, description/remarks, attachment type, tags, language, academic targets, visibility, publish/unpublish dates, downloadable flag.
- Upload one primary file and optional supporting files, or create an approved external link.
- Resumable progress, pause/retry, server validation, quarantine/processing state, preview before publish.
- A resource can target all school users, roles, class offerings/sections, or class subjects. `All` and `Unfiltered` must be deliberate audience choices, never null ambiguity.

### Attachment types

- School-configurable taxonomy such as notes, worksheet, assignment resource, daily activity, presentation, video, audio, answer key, policy.
- Fields: name, code, icon/color, allowed MIME families, max size, student visibility, download policy, retention policy, active/order.
- System types may be locked; referenced types are archived instead of deleted.

### Asset detail/version history

- Metadata, targets, versions, scan/processing status, preview, usage backlinks, download history summary, audit history.
- Replace file creates a version; it never mutates an already referenced historical blob.
- Unpublish, archive, restore, and permissioned permanent purge after retention/dependency checks.

## Data model

- `attachmentTypes`: tenant, name/code, policy fields, active/order.
- `digitalAssets`: tenant, title, description, type, owner, language, visibility, lifecycle status, publish window, currentVersionId, timestamps.
- `digitalAssetVersions`: asset, immutable version number, storage key, original/safe filename, detected MIME, extension, byte size, SHA-256, scan status, processing status, uploader, createdAt.
- `digitalAssetTargets`: asset and exactly one target kind/reference (`school`, role, class offering/section, class subject, user).
- `digitalAssetTags` and `digitalAssetTagLinks`.
- `digitalAssetDerivatives`: preview/thumbnail/text-extraction artifacts with generator version.
- `digitalAssetLinks`: approved external URL, provider/type, validation state; separate from uploaded versions.
- `digitalAssetUsageLinks`: typed backlink to assignment, announcement, live class, or future module.
- `digitalAssetAccessEvents`: bounded analytics for preview/download with actor and timestamp; define retention/aggregation.
- `uploadSessions`: resumable upload state, expected size/hash, owner, expiry, quota reservation.

Database metadata never grants access by itself. Every download resolves the asset, target audience, current user, tenant, lifecycle status, and policy before issuing a short-lived response or signed URL.

## Storage and processing architecture

- Create a `BlobStore` interface: put/multipart, read/range, head, delete, signed read/write, copy, and health check.
- Keep the existing local-disk adapter for development and migration compatibility.
- Add an S3-compatible adapter for production; the addon must not hard-code a single vendor.
- Use content-addressed or immutable version keys such as `tenant/{tenantId}/assets/{assetId}/versions/{versionId}/{sha256}`.
- Upload into quarantine, verify expected size and SHA-256, detect actual MIME, malware scan, extract bounded metadata/preview asynchronously, then mark ready.
- Failed or infected files never become downloadable. Keep only minimal quarantine evidence and apply automatic purge.
- Serve untrusted content with safe `Content-Disposition`, `X-Content-Type-Options: nosniff`, restrictive CSP for inline previews, and range support where appropriate.
- Track per-tenant quotas and atomically reserve/release upload capacity.

## Permissions

- School admin: configure types/policies, see all assets, moderate, restore/purge, and view reports.
- Teacher: create/manage own resources for assigned classes/subjects; may reuse school-shared assets.
- Student/parent: read only published resources targeted to their active placement/user/role.
- Sensitive staff/student administrative documents never enter this library.
- Answer keys and teacher-only materials require explicit staff-only visibility.

## Lifecycle

`draft -> uploading -> quarantined -> processing -> ready -> published -> archived`

Failure branches: `upload_failed`, `scan_failed`, `infected`, `processing_failed`, `rejected`.

Publishing is allowed only when the current version is ready, targets are valid, policy checks pass, and at least one authorized audience exists.

## Implementation phases

### Phase 0 - policy and storage ADR

- Decide production object-store provider, geography, backups, encryption, lifecycle rules, quotas, allowed formats/sizes, and video strategy.
- Decide whether v1 accepts uploaded video or external/streaming links only; recommended v1 is links plus bounded small files, not a home-built video streamer.

### Phase 1 - storage foundation

- Add addon gating, schema, BlobStore interface, local and S3 adapters, immutable keys, quota reservations, audit events, and migration tests.
- Extend upload validation beyond filename/MIME claims and remove direct whole-file buffering for large addon assets.

### Phase 2 - resumable secure ingestion

- Integrate Uppy with tus resumable uploads.
- Add authenticated upload authorization/completion hooks, expiry/cleanup, checksum verification, ClamAV service, quarantine state, worker queue, retries, and dead-letter operations.

### Phase 3 - library and taxonomy

- Build attachment-type CRUD and content list/create/detail/version pages.
- Add academic targeting, publish scheduling, authorization-aware download, archive/restore, tags, search, and bulk metadata actions.

### Phase 4 - previews, extraction, and reuse

- Add safe PDF/image/audio/video metadata previews and optional Apache Tika text/metadata extraction in a resource-limited sandbox.
- Add `digitalAssetUsageLinks` and pickers for assignments, announcements, and Live Classrooms.
- Add duplicate detection by hash with tenant-isolated reuse.

### Phase 5 - reports and operations

- Add storage/quota dashboard, popular/unused assets, broken external links, scan failures, processing backlog, retention jobs, backup/restore verification, and access-event aggregation.
- Add portability export of metadata plus blobs for one tenant.

## Acceptance criteria

- Cross-tenant metadata, blobs, signed URLs, upload sessions, and search results are inaccessible.
- Spoofed MIME, executable/polyglot test fixtures, oversize and checksum mismatch fail safely.
- Interrupted upload resumes; abandoned sessions release quota and purge chunks.
- Duplicate completion callbacks create one version only.
- Infected/quarantined content cannot be previewed or downloaded.
- Replacing a file preserves prior versions and existing usage backlinks.
- Audience changes take effect immediately even if an old download URL exists.
- Archiving a type with referenced assets succeeds; destructive deletion is blocked.
- Disabling the addon does not break core documents or assignment submissions.

