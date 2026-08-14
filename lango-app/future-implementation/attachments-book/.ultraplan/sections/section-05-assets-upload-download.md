# Section 05: Digital Asset CRUD, Upload/Scan Pipeline & Authorized Download

## Overview
The core of the addon: creating an asset with its first file version (quarantine → scan → ready), replacing a file (new version, old one untouched), publishing/archiving, listing with real targeting-aware filtering, and a download route that re-checks authorization and scan status on every single request — never a cached or pre-signed long-lived URL.

## Risk: [red] - security-critical (this is the route real students download real files from; a mistake here is a real data-leak or a real malware-serving bug), highest-complexity section in the plan

## Dependencies
- Depends on: section-01, section-02, section-03, section-04
- Blocks: section-06, section-07, section-08
- Parallel batch: 3

## TDD Test Stubs
- Test: `nextVersionNumber` returns 1 for a fresh asset, N+1 for an asset with N existing versions
- Test: `resolveViewerAudienceContext`-shaped helper (or equivalent) correctly derives a student's sectionId/offeringIds/classSubjectIds the same way `HomeworkService.getHomeworkForStudent` already does (reuse, don't reinvent)
- Test: (live, section-09) uploading a real EICAR test file is rejected and the asset never reaches 'ready'/'published'
- Test: (live, section-09) replacing a file preserves the old version row and any usage-link pointing at it

## Tasks

<task type="auto" id="05-01">
  <name>AssetService: version numbering and the upload/scan pipeline</name>
  <files>src/features/attachments/services/asset-service.ts</files>
  <action>
    Create `AssetService` with:
    - `nextVersionNumber(tx, assetId): Promise<number>` — `SELECT COALESCE(MAX(versionNumber), 0) + 1 FROM digitalAssetVersions WHERE assetId = ...` run inside the same `db.transaction` as the insert that follows it, matching this session's established transaction-safety pattern (from the online-exam submit fix) to avoid a duplicate-version race.
    - `ingestVersion(params: { tenantId, assetId, uploaderId, file: File, attachmentType })`: computes `sha256` of the file bytes (`node:crypto` `createHash('sha256')`), validates `file.size <= attachmentType.maxSizeBytes` and the detected MIME (magic-byte sniff, extending the existing 3-type check in `src/libs/api/uploads.ts` to cover the broader `allowedMimeFamilies` this addon supports — do not just trust `file.type`), writes the raw bytes to `quarantineKeyFor(tenantId, uploadId)` via `blobStore.put`, calls `scanBuffer(bytes)` from section-03. On infected/error result: set the version's `scanStatus` accordingly, set the asset's `status` to `'infected'`/`'scan_failed'`, delete the quarantine blob, return early — this file is now permanently unreachable, matching the acceptance criterion "Infected/quarantined content cannot be previewed or downloaded." On clean result: inside a `db.transaction`, call `nextVersionNumber`, insert the `digitalAssetVersions` row with `scanStatus: 'clean'`, `blobStore.put` the bytes to the real immutable `blobKeyFor(...)` key, `blobStore.delete` the quarantine key, update `digitalAssets.currentVersionId` and `status: 'ready'`.
    - `createAsset(params)`: inserts the `digitalAssets` draft row, then calls `ingestVersion` for the first file. Returns the asset with its resolved status.
    - `publishAsset(tenantId, assetId)`: throws unless `status === 'ready'` and at least one target row exists (or an explicit 'school' target row — never publish with zero targets by accident, matching "All and Unfiltered must be deliberate audience choices, never null ambiguity" from the spec: creating a target row with `targetKind: 'school'` IS the deliberate "everyone" choice; truly zero target rows is instead treated as "not yet targeted" and blocks publish, a deliberate tightening beyond the homework-reuse precedent where zero rows silently meant broadcast — publish requires an explicit choice, list/download-time visibility still treats zero rows as broadcast for any asset that somehow reaches published with none, which cannot happen through this route). Sets `status: 'published'`.
    - `archiveAsset(tenantId, assetId)`: sets `status: 'archived'`. Always allowed (matches "Archiving a type with referenced assets succeeds" — assets themselves are never blocked from archiving by their own usage links; only permanent purge, which this addon doesn't implement in v1, would need a dependency check).
  </action>
  <verify>`ingestVersion` never marks an asset ready/published without a real 'clean' scan result on the exact bytes stored at the final key. `nextVersionNumber` + insert are in the same transaction.</verify>
  <done>AssetService covers create/ingest-version/publish/archive with the quarantine-then-clean-then-ready flow enforced.</done>
</task>

<task type="auto" id="05-02">
  <name>POST /api/content/assets — create asset + first version (multipart)</name>
  <files>src/app/api/content/assets/route.ts</files>
  <action>
    `requireRequestContext(req, ['school_admin', 'teacher'])` → `requireTenant` → `requireCapability(context, 'content.manage')`. Before parsing the body, check the `Content-Length` header against the largest possible `maxSizeBytes` across the tenant's active attachment types (a cheap early rejection so a wildly oversized request never gets fully buffered into memory just to fail a per-type check afterward — self-review finding: this codebase's existing upload helper already buffers whole files via `file.arrayBuffer()`, which is fine at small-MB scale, but a fast header-based upper bound is a one-line, zero-cost guard worth keeping regardless). Parse `request.formData()` (matches the existing multipart convention used by `homework/upload/route.ts`): `title`, `description`, `attachmentTypeId`, `language`, `targets` (JSON-stringified array of `{targetKind, targetRoleValue?, targetRefId?}`), `tags` (JSON array of strings), and `file`. Validate the referenced `attachmentTypeId` belongs to the tenant AND `isActive = true` (self-review finding: an archived type must not accept new assets, even though assets already referencing it keep working, per spec's "referenced types are archived instead of deleted") — same tenant-ownership-check pattern hardened in this session's assessment-and-examination cross-tenant fixes. If `context.role === 'teacher'`, `targets` must only reference class-sections/class-subjects the teacher is actually assigned to (reuse `getTeacherClassSectionIds`-equivalent scoping). Call `AssetService.createAsset`. `recordAudit(context, 'create', 'digital_asset', created.id, { title })` (not awaited). Return 201.
  </action>
  <verify>A teacher cannot target a class-section they aren't assigned to (live test in section-09 mirrors the exam-schedules cross-tenant-ID fix from the prior remediation this session).</verify>
  <done>Route creates a real asset+version, tenant- and ownership-scoped.</done>
</task>

<task type="auto" id="05-03">
  <name>GET /api/content/assets — targeting-aware library list</name>
  <files>src/app/api/content/assets/route.ts</files>
  <action>
    GET in the same file: `requireRequestContext(req)` → `requireTenant`. Branch by role: `school_admin`/`super_admin` see every non-archived asset in the tenant (plus an `includeArchived` query flag); `teacher` sees assets where `ownerId = context.userId` OR the asset is targeted/published to something the teacher can reach (reuse-visible school-shared assets) — resolve via `isAssetVisibleToUser` from section-04 with the teacher's own viewer context; `student`/`parent` see only `status = 'published'` assets where `isAssetVisibleToUser` returns true, resolving the viewer's `sectionId`/`offeringIds`/`classSubjectIds` via `resolveStudentAudienceContext` (section-04, task 04-04) — the same shared helper `homework-service.ts` now calls, imported here rather than re-derived. Support `search`/`type`/`tag`/`status` query filters per the spec's Content Library page. Never return `storageKey` in the list payload (only `id`/metadata/`currentVersionId` — the download route is the only path that ever resolves a real blob).
  </action>
  <verify>A student query never returns a draft/unpublished/staff-only asset even if title/id is guessed; a teacher never sees another teacher's private (zero-target, not-yet-published) draft.</verify>
  <done>GET is real, tenant- and audience-scoped, matches the Content Library page's filter set.</done>
</task>

<task type="auto" id="05-04">
  <name>GET /api/content/assets/[id] — detail, POST .../versions — replace file, POST .../publish, POST .../archive</name>
  <files>src/app/api/content/assets/[id]/route.ts, src/app/api/content/assets/[id]/versions/route.ts, src/app/api/content/assets/[id]/publish/route.ts, src/app/api/content/assets/[id]/archive/route.ts</files>
  <action>
    GET detail: tenant-scoped fetch + all versions + all targets + tag names + usage-link backlinks (asset detail/version-history page's exact data needs). Same visibility rule as the list route applies here too (a student hitting a random valid-looking UUID for an unpublished asset gets 404, not 403, to avoid confirming existence — matches this codebase's existing `apiErrorResponse` convention of not leaking existence via status-code choice where it's already used elsewhere).
    POST `.../versions`: `requireRequestContext(req, ['school_admin', 'teacher'])` → capability + ownership check (teacher must own the asset, admin always allowed) → same multipart parse as 05-02 → `AssetService.ingestVersion`. This is the "Replace file creates a version; it never mutates an already referenced historical blob" acceptance criterion — the old version row and its blob key are never touched or deleted by this route.
    POST `.../publish` and `.../archive`: thin wrappers calling `AssetService.publishAsset`/`archiveAsset` with the same ownership check as the versions route.
  </action>
  <verify>Publishing an asset with zero target rows is rejected (422); replacing a file on a published asset with real usage-links leaves those links pointing at an asset whose `currentVersionId` now resolves to the new version — old version row still exists in `digitalAssetVersions` untouched.</verify>
  <done>All four routes exist, tenant- and ownership-scoped, matching the established route convention.</done>
</task>

<task type="auto" id="05-05">
  <name>GET /api/content/assets/[id]/download — the authorized, re-checked-every-request download route</name>
  <files>src/app/api/content/assets/[id]/download/route.ts</files>
  <action>
    `requireRequestContext(req)` → `requireTenant`. Fetch the asset + its current version (or a specific `?versionId=` if the caller has manage rights — students/parents can only ever fetch the current published version, never an arbitrary version id, even an old one, unless the asset is currently published and that specific version is `currentVersionId`). Re-check, on THIS request, not from any cache: `status === 'published'` (or the requester is the owner/admin previewing a draft), `version.scanStatus === 'clean'`, and `isAssetVisibleToUser(...)` against the requester's live-resolved audience context (`resolveStudentAudienceContext` from section-04, task 04-04, for student/parent viewers). Any failure → 404 (not 403, same existence-hiding rationale as 05-04). On success: `blobStore.get(version.storageKey)`, stream the bytes back with `Content-Disposition: attachment; filename="${version.safeFilename}"`, `X-Content-Type-Options: nosniff`, and the version's `detectedMime` as `Content-Type` (never the client-claimed original type). Fire-and-forget `recordAudit` AND insert a `digitalAssetAccessEvents` row (`eventType: 'download'`) — the one place this table gets written in v1 (its aggregation/reporting consumer is deferred per PRD.md Section 7, but the raw events are captured now so that follow-up work has real data to report on later). This route is what makes "Audience changes take effect immediately even if an old download URL exists" true — there is no signed URL, no cache; every single request re-resolves authorization from scratch.
  </action>
  <verify>(Live, section-09) changing an asset's targets, then immediately re-requesting a previously-working download URL for a student who's no longer targeted, returns 404 on the very next request. An infected-version's storageKey (there shouldn't be one, since infected files are deleted from quarantine and never reach a real blob key, but as defense in depth) can never be reached through this route since `scanStatus === 'clean'` is required.</verify>
  <done>Download route re-authorizes and re-checks scan status on every request; never serves an unpublished/unscanned/de-targeted file.</done>
</task>
