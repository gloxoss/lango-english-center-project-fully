# UltraPlan Discovery

## Project Idea

Build the "attachments-book" addon for SchoolOS: a tenant-scoped academic resource library (content library, attachment-type taxonomy, versioned digital assets, secure upload pipeline, targeting/publish lifecycle, previews, reuse links, reporting). Full source spec: `ATTACHMENTS-BOOK-ADDON.md` + `REFERENCE-TOOLS-AND-REPOSITORIES.md` in this same folder.

## Codebase Context

Existing codebase (not greenfield): Next.js 15/16 App Router, TypeScript, Drizzle ORM, PostgreSQL, Better Auth, multi-tenant. Docker Compose stack is intentionally minimal: `db` (Postgres), `app` (Next.js standalone), `migrate` — no object storage, no message queue, no external services beyond Postgres. A local-disk upload helper already exists (`src/libs/api/uploads.ts`: tenant-namespaced paths, size/type checks, magic-byte validation) and is reused by student photos, teacher photos, student documents, school logo. The legacy `courseAttachments` table (`Schema.ts:1434`) belongs to a deprecated LMS chain and must not be reused, per the spec.

## Discovery Q&A

<!-- Compressed/self-answered per standing session directive: "dont ask again do the best option always". No AskUserQuestion calls were made for this plan; the two source documents already represent thorough product/technical discovery, so this phase re-derives structured answers from them plus targeted codebase checks, and makes the remaining unresolved calls with documented reasoning. -->

### 1. Core Requirements

- **What must this do (v1 minimum)?** A tenant-scoped, versioned academic resource library: admins configure attachment types; teachers/admins upload a resource, target an audience (school/role/class-offering/section/subject/user), and publish it; students/parents see only published resources targeted to them; replacing a file creates a new version without breaking old usage links; resources can be linked from homework (the one real "reuse" consumer that exists today).
- **What's explicitly out of scope for v1?** See "What It Does NOT Do" — deferred to documented follow-up phases, not silently dropped: Apache Tika text extraction, storage/quota operations dashboard, portability export, video upload/streaming, resumable tus-protocol uploads, S3/SeaweedFS object storage.
- **Why defer those?** The real infra this app runs on today is a 3-container Docker Compose stack for what reads as a small/early-stage multi-tenant deployment (confirmed via `docker-compose.yml` — no object storage, no queue, no external services). The reference doc itself flags this tradeoff: "operating distributed storage is substantial; managed S3-compatible storage may be safer for a small team" and "recommended v1 is links plus bounded small files, not a home-built video streamer." Building tusd + SeaweedFS + Tika now would be infra disproportionate to what's actually deployed, and CLAUDE.md's Section 2 ("Simplicity First") plus this session's established discipline (fix/build exactly what's needed, no speculative infra) both argue the same way. The `BlobStore` abstraction itself IS built now specifically so a real S3-compatible adapter can be dropped in later without touching any business logic — the door is left open, not closed.

### 2. Users & Context

- **Who uses this?** School admin (full config + moderation), teacher (create/manage own resources for assigned classes/subjects, reuse school-shared assets), student/parent (read-only, published + targeted to them only). Matches the existing `role` enum and `requireRequestContext`/`requireCapability` convention used everywhere else in this codebase.
- **Environment/devices:** Same as the rest of the dashboard — desktop-first responsive web, French UI copy (matches every other page's error-message convention, e.g. `apiErrorResponse` messages elsewhere are French).

### 3. Integration Points

- **What does it connect to?** `classSections`, `classSubjects`, `user` (for targeting - same tables `homework-service.ts` already joins for audience resolution, see `isHomeworkVisibleToStudent`), homework (as the first real `digitalAssetUsageLinks` consumer, since homework attachments already exist as a simpler, non-reusable mechanism this addon deliberately does not replace). `recordAudit()` on every mutation, matching the standing convention.
- **What existing audience-matching logic can be reused?** `isHomeworkVisibleToStudent`'s exact pattern (broadcast when no targets, otherwise match student/section/offering) is the direct template for `digitalAssetTargets` resolution - same shape, extended with `role` and `school`-wide targets per the spec.

### 4. Edge Cases

- Interrupted upload → v1 uses a single-request multipart POST (no true resumability, see scope decision above), so "interrupted" simply means retry the request; no partial-chunk state to clean up. This is a real simplification vs. the spec's `uploadSessions`/resumable design — documented, not hidden.
- Duplicate version-creation race → version numbers assigned via `SELECT ... FOR UPDATE`-style monotonic increment inside a `db.transaction`, matching the transaction pattern already established in this session's `online-exams/submit` fix.
- Infected/failed scan → asset stays in `quarantined`/`scan_failed`, never reachable by the download route (the download route re-checks `scanStatus === 'clean'` and `status === 'published'` on every request, not just at upload time).
- Audience change takes effect immediately → download route re-resolves targeting on every request rather than caching/signing a long-lived URL; matches the acceptance criterion verbatim.
- Archiving a type with referenced assets → allowed (blocks only hard delete of a referenced type), matches spec.
- Cross-tenant → every table gets `tenantId`, every route follows `requireRequestContext` → `requireTenant` → tenant-scoped Drizzle query, matching the exact convention audited and hardened twice already this session (advanced-reporting, assessment-and-examination).

### 5. Quality Attributes

- **Security:** malware scanning is a real, must-have control for a feature whose entire purpose is "let teachers upload arbitrary files that students then download" - ClamAV is added as a genuine new Docker service (small, well-bounded, official image), not deferred, unlike the heavier SeaweedFS/tusd infra. MIME sniffing extends the existing magic-byte pattern in `uploads.ts` to more file kinds. `Content-Disposition`, `X-Content-Type-Options: nosniff`, and no inline execution of untrusted HTML, per spec.
- **Performance:** bounded file sizes (configurable per attachment type, sane default e.g. 25MB) keep single-request uploads practical without resumability.
- **Reliability:** quarantine-first pipeline (never serve a file until scanned clean), version immutability (replacing never mutates a referenced blob).

### 6. Existing Patterns (this is an existing codebase)

- Route convention: `requireRequestContext(req, [roles])` → `requireTenant` → `requireCapability` (new capability keys needed, e.g. `content.manage`, `content.publish`) → Zod `.strict()` → tenant-scoped Drizzle query → `recordAudit()` (fire-and-forget) → `apiErrorResponse()`. Reused exactly.
- Upload convention: extend `src/libs/api/uploads.ts` rather than inventing a parallel mechanism - add a `BlobStore` interface there with the current local-disk logic becoming the `LocalDiskBlobStore` implementation, so existing callers (student photos etc.) are untouched.
- Schema convention: new tables live in a dedicated feature schema file (mirrors `src/features/assessment/models/assessment-schema.ts`), imported into the main `Schema.ts` re-export surface the way assessment/other feature schemas already are - confirmed this is the established per-feature schema pattern in this codebase (not everything lives in one 3900-line `Schema.ts`).
- Migration convention: sequential numbered SQL files; must check the current highest number before adding new ones, and remember `app`/`migrate` are separate Docker images with independent build caches (documented incident from this session's earlier work).
- Test convention: no DB-backed vitest pattern exists in this codebase (established finding, twice this session) - extract pure functions for anything unit-testable (e.g. targeting-resolution logic, version-numbering logic), verify DB-dependent behavior live via curl+psql like every other remediation this session.

### 7. Preferences & Tradeoffs

- Simplicity over speculative flexibility: build the `BlobStore` interface with exactly the two operations this app needs now (put/read/delete/head), not the full multipart/signed-URL surface the spec describes for an eventual S3 adapter - the interface can grow when a real S3 adapter is actually added, per YAGNI.
- Reuse over duplication: attachment-type policy fields, targeting resolution, and the audit/permission convention all reuse existing shapes rather than inventing new ones.

### 8. Monetization & Business Model

- N/A - this is an internal school-operations feature, not a monetized product surface. No pricing/subscription implications beyond what already exists at the tenant level.

### 9. Visual & UX Vision

- Matches the existing dashboard visual language (slate/blue palette, data-dense tables, KPI banners, inspector sidebars) per this project's `CLAUDE.md` Section 1.5 design mandate - same shell as every other module (Students, Teachers, Academics).
- Content library: table/grid toggle, search/filter bar, per-row preview/download/version/status actions, matches the spec's page list almost verbatim.
- Create/edit: a single form (title, type, tags, targeting, visibility, publish window) plus a file-drop upload zone - no multi-step wizard needed for v1's single-request upload (a wizard would add complexity resumability doesn't need yet).

## Discovery Summary

- Categories fully covered: all 9 (self-answered/compressed, no interactive Q&A per standing directive).
- Key scope decision made and documented (not silently dropped): v1 ships Phases 0-3 fully, plus the core of Phase 4 (usage-links reuse + basic browser-native previews, no Tika extraction), and formally defers full Phase 4 extraction + all of Phase 5 (ops dashboard/portability export) + resumable tus uploads + real S3/SeaweedFS backing as documented follow-up work, matching the proportionate-infra reasoning above.
- Key themes: reuse existing conventions maximally (route/permission/audit/schema/upload patterns all already exist and are proven this session); malware scanning is a non-negotiable security control and is built now; heavier infra (object storage, resumable protocol, extraction service) is deliberately right-sized down to what a 3-container Docker Compose deployment can actually operate, with the abstraction layer left open for later upgrade.
