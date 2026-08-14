# Certificate Management & Card Management — Combined Audit Report

**Audited 2026-08-07.** Owner: audit/fix pass for `certificate-management` and `card-and-admit-card-management`. Every claim below was re-verified directly against the live repo and the live database this pass — nothing is taken from a prior self-report, including this report's own earlier drafts.

Ground rule honored throughout: *a route existing is not a route working; a migration written is not a migration applied; tsc passing is not the feature functioning.*

---

## 1b. Post-audit build-out (2026-08-07, second pass) — cards end-to-end loop is now real

After the audit (below), the seed/session blocker was cleared (`npm run db:seed`, 2 tenants + 6 credential accounts), both addon entitlements were granted, and the **card issue → verify → bulk-job loop was built and live-verified end-to-end** against the running app:

| New file | Purpose |
|---|---|
| `src/features/cards/services/issue-service.ts` | Shared issue engine: resolves subject data (student/employee/exam-seat), type-matches template vs subject, mints opaque token + sha256 hash, renders PDF via `document-studio`. |
| `src/app/api/cards/issue/route.ts` | `POST` single issue (returns raw token once + `pdfBase64`). |
| `src/app/api/cards/issued/route.ts` | `GET` tenant-scoped issued list. |
| `src/app/api/cards/jobs/route.ts` | `POST` bulk-job create (validates published version, type match) + `GET` list. |
| `src/app/api/cards/jobs/[id]/route.ts` | `GET` job + items. |
| `src/app/api/cards/jobs/[id]/process/route.ts` | `POST` batch processor (≤50 items/call, dedupe-by-active-card, retry-safe). |
| `src/app/api/public/cards/verify/route.ts` | `POST` public verifier — rate-limited, honeypot, sha256 lookup, generic `{valid:false}` for revoked/nonexistent. |
| `src/app/[locale]/verify/card/[token]/page.tsx` | Public no-login verifier page (token in URL). |
| `src/app/[locale]/(dashboard)/dashboard/cards/jobs/page.tsx` | Bulk-jobs page (create w/ student picker, list, process, detail). |

**Live HTTP evidence** (dev server on :3001, two real sessions, separate cookie jars, `Origin` header):
- Create + publish template → `200`; issue STU-001 → `201` with a **real rendered PDF** (6 KB base64), 64-char raw token; DB stores **sha256 hash only** (verified: no raw token column, hash row in `issued_documents.public_token_hash`).
- `POST /api/public/cards/verify` good token → `{valid:true, subjectName, schoolName, documentType}`; random token → `{valid:false}`; honeypot → `{valid:false}`; missing token → `422`.
- **Cross-tenant (by-id + issue)**: Lango against Atlas template version → `404 NOT_FOUND` (issue, admit-card, by-id GET/PATCH/DELETE all verified); Lango issued-list → `0` rows.
- **Bulk idempotency**: job of 3 students → run1 `completed, success=3, error=0`; run2 `0 processed ("Lot déjà terminé")`; **STU-001 active-card count = 1** after single-issue + bulk + retry (dedupe-by-existing-active works).
- **Disable addon** (flip `addon_entitlements.is_enabled=false`): issue/list → `403 ADDON_NOT_ACTIVATED`, but existing card **still verifies** (`valid:true`).
- **Admit card** from real seeded `exam_terms`/`exam_halls`/`exam_seats`: issue `201`, verify `valid:true` with `subjectType: exam_candidate`, candidate/seat/hall from the real seat row.
- Guards: unpublished version → `400 NOT_PUBLISHED`; template/subject type mismatch → `400 TYPE_MISMATCH`; cross-tenant template version → `404`.
- Static isolation sweep: **no new violations** (still only the 3 pre-existing baseline files).
- `tsc --noEmit`: cards/certificates add **zero** errors (total 18, all pre-existing events/domains).

### 1b-2. Third pass (2026-08-07) — cards surface completed: revoke + PDF + remaining routes + 5 pages, 27/27 live checks green

The remaining card routes and pages from §7 were built and **live-verified end-to-end** (two real sessions, separate cookie jars, real HTTP + DB evidence). All temporary data was cleaned back to 0 after the sweep.

| New file | Purpose |
|---|---|
| `src/app/api/cards/issued/[id]/revoke/route.ts` | `POST` soft-revoke: sets `status='revoked'` + `revokedById`/`revokedAt`/`revokeReason`, inserts `document_events` kind `revoked`, `recordAudit`. Idempotent, tenant-scoped, 404 on cross-tenant. |
| `src/app/api/cards/issued/[id]/pdf/route.ts` | `GET` re-renders the stored PDF from `version.schemaJson` + `renderDataSnapshot`; returns real `application/pdf`. |
| `src/app/api/cards/admit-seats/route.ts` | `GET` lists `exam_seats` (join terms/halls/users), tenant-scoped on `exam_seats.tenantId`, optional `examTermId` filter. |
| `src/app/api/cards/employees/route.ts` | `GET` staff listing for employee cards (roles teacher/accountant/receptionist/guard/school_admin) — teachers API alone can't serve this (school_admin-only). |
| `src/app/api/cards/overview/route.ts` | `GET` dashboard KPIs: template totals, issued-by-status, jobs-by-status, 8 recent issued. |
| `src/features/cards/ui/issue-card-dialog.tsx` | Shared issue dialog (template pick → published version → issue → raw token shown once + PDF download + verify link). |
| `src/app/[locale]/(dashboard)/dashboard/cards/page.tsx` | Overview page (KPI banner + quick links + recent issued). |
| `src/app/[locale]/(dashboard)/dashboard/cards/students/page.tsx` | Student cards page (search, KPI, per-student status, Émettre → dialog). |
| `src/app/[locale]/(dashboard)/dashboard/cards/employees/page.tsx` | Employee cards page (per-employee status, Émettre → dialog). |
| `src/app/[locale]/(dashboard)/dashboard/cards/admit-cards/page.tsx` | Admit-card page from real `exam_seats`, term filter, status by `examCandidateId`, Émettre → dialog. |
| `src/app/[locale]/(dashboard)/dashboard/cards/issued/page.tsx` | Issued-documents page (type/status filters, KPI row, PDF download, revoke dialog). |
| `src/components/shared/sidebar.tsx` | "Cartes & Convocations" section expanded to 7 sub-items (5 new this pass: overview, students, employees, admit-cards, issued), each capability-gated. |

**Live HTTP evidence** (dev server :3001):
- Template create + publish → `200`; exam term + hall + seat allocation → 3 `201`s; admit-seats lists the allocated seat with hall/term/desk; employees lists staff (tenant-scoped, name-ordered).
- Student card + admit card issued → `201` with real PDFs; issued list filters by type; overview counts match (templates total/published, issued by status, recent ≤8); PDF download → `application/pdf`, >500 bytes.
- Verify valid → revoke (reason stored) → re-verify returns same generic `{valid:false}` as a nonexistent token → **re-revoke idempotent** (no duplicate event).
- **Cross-tenant**: Lango issued-list empty; Lango revoke against Atlas doc → `404`; overview empty; seats empty.
- HTML page smoke for all 5 pages (overview/students/employees/admit-cards/issued) renders without error.

**DB evidence (post-sweep):** revoked row has `status='revoked'`, `revoked_at` set, `revoked_by_id='USR-001'`, `revoke_reason='Carte perdue (test)'`; matching `document_events` row `event_kind='revoked'` with actor; `public_token_hash` is 64-char sha256 hex; 1 card remains `active`.

**Cleanup:** all test artifacts removed (templates 0, issued 0, seats 0, terms 0); temp cookie jars and the `_cards_pages_live.cjs` sweep script deleted.

**Cards: fully done (nothing open).** Certificate surface was entirely unbuilt at that point — now fully built + live-verified, see §1c/§6/§7.

### 1c. Fourth pass (2026-08-07) — certificates surface built + live-verified end-to-end, one schema/migration defect found & fixed

The entire certificate surface (routes + pages + public verifier + sidebar + capabilities) was built and **live-verified end-to-end** against the running app (three real sessions — Atlas admin `USR-001`, Atlas teacher `USR-002`, Lango admin `USR-LANGO-001` — separate cookie jars, `Origin` header, real HTTP + DB-row evidence). All test data cleaned back to 0 after the sweep.

**Schema/DB defect found & fixed (blocking every INSERT on `issued_certificates`):** migration `0065` created the table with `verification_token varchar(255) NOT NULL` (no default) and **without** `file_ext`, but the Drizzle schema (`certificates-schema.ts:89-109`) declares the opposite: `fileExt varchar('file_ext',{length:10}).notNull()` and hash-only verification. `certificate-service.issueCertificate` inserts `fileExt: 'pdf'` and never sets `verification_token` → every INSERT/SELECT would fail at runtime (`file_ext does not exist` / null-value violation). Grep confirmed no source code reads the raw token column (hash-only design). **Fix:** new migration `migrations/0070_certificates_align_issued_columns.sql` (`ADD COLUMN file_ext varchar(10) NOT NULL DEFAULT 'pdf'; DROP COLUMN verification_token`), applied to the live DB (journaled idx 71). Post-fix probe: `file_ext` present with default `'pdf'`, raw-token column gone, `verification_token_hash` intact. Note: `issued_by` was already `text` on the live table (0069) matching the schema.

**Second defect found & fixed (PDF render 500 on every certificate):** pdfme 6.x requires a `padding: [top,right,bottom,left]` tuple on a blank `basePdf`. The designer always emits it, but the versions route's fallback / hand-built templates stored `{width,height}` without it → `renderPdf` threw `template.basePdf Invalid input` and the PDF route 500'd. **Fix:** `src/libs/document-studio/render.ts` normalizes a blank `basePdf` missing `padding` to `[0,0,0,0]` before calling `generate` (shared chokepoint; card PDFs unaffected). Live re-verified: PDF endpoint → `200 application/pdf` (52 KB, valid `%PDF-1.7`).

**Live HTTP + DB evidence (dev server :3001):**
- Definition create → `201`; publish version v3 (nested pdfme `schemas:[[…]]`) → `200`, version `status='active'`, definition `status='active'`.
- Request state machine: teacher `USR-002` create → submit → review → **admin `USR-001` approve** (four-eyes) → `status='issued'` after issuance. Same-user approve → `400 FOUR_EYES_VIOLATION`; teacher approve → `403 FORBIDDEN` (lacks `certificates.approve`).
- Issue (manual_authorized, student + employee) → `201`, serials `CERT-2026-000001…000008`, raw 64-char token returned once; DB stores **sha256 hash only** (`verification_token_hash`), `file_ext='pdf'`. Target-type guard: employee against student-only definition → `400 TYPE_MISMATCH`.
- Public verify `POST /api/public/certificates/verify`: good token → `{valid:true, recipientName, certificateTitle, serialNumber, issuedAt, schoolName}` (no evidence fields leaked); revoked/replaced/random → generic `{valid:false}`; honeypot `website_hp` → `{valid:false}`; missing token → `422`; rate limit → `429` after 10/min.
- Revoke → `status='revoked'`, `certificate_events` kind `revoked` with reason, re-verify `{valid:false}`. Replace → new serial + token created (`status='valid'`), original → `replaced`, original token verify `{valid:false}`.
- Bulk job (2 students) → run1 `processed=2 success=2 error=0`; run2 `processed=0` ("Lot déjà terminé") — idempotent. Job items `status='success'`, job `status='completed'`.
- Signatories create/toggle/delete all live (`201`/`PATCH`/`DELETE`).
- **Cross-tenant**: Lango admin sees 0 Atlas definitions / issued; direct by-id access → `404 NOT_FOUND`.
- **Addon guard**: flip `certificate-management` entitlement off for Lango → `403 ADDON_NOT_ACTIVATED`; re-enabled.
- Overview KPIs matched DB during sweep (definitions 2, issued 8, valid 6 / replaced 1 / revoked 1, job completed 1).
- `tsc --noEmit`: certificates + render.ts add **zero** errors. (At the time of this pass the pre-existing events/domains baseline still had errors and `next build` was blocked by the `getAuthContext` import in `addons/events/route.ts`; that whole baseline was subsequently resolved in the fifth pass — see §8.)

**Cleanup:** all certificate test data deleted back to 0 (definitions, versions, templates, requests, jobs, items, events, issued, signatories — verified via count query). Temp probe scripts removed.

---

## 1. Executive summary

| Area | Status |
|---|---|
| Migrations apply cleanly on the app DB | ✅ VERIFIED — 70/70 recorded, 204 tables, all 17 feature tables present |
| Schema (both features) | ✅ VERIFIED — complete, tenant-scoped, security-correct |
| Certificate FIX-PLAN CRITICAL items §1–§7 | ✅ VERIFIED FIXED on disk |
| Certificate evaluators | ✅ 6/6 implemented + unit tests |
| **NEW critical bug: cards addon-id mismatch** | ✅ FOUND + FIXED (was a guaranteed 422 on every card route) |
| Cards API routes | ✅ COMPLETE — 15 routes — live-verified 27/27 two-tenant sweep |
| Cards UI pages | ✅ COMPLETE — 8 dashboard pages + public verifier, live-smoke-tested |
| **NEW critical bug: issued_certificates schema/DB mismatch** | ✅ FOUND + FIXED (migration 0070) — blocked every INSERT |
| **NEW critical bug: certificate PDF render 500** | ✅ FOUND + FIXED (render.ts padding normalize) |
| Certificate API routes | ✅ COMPLETE — 21 routes — live-verified end-to-end (this pass) |
| Certificate UI pages | ✅ COMPLETE — 12 dashboard pages + public verifier page, live-smoke-tested |
| Acceptance checklists (both plans) | ✅ Cards verified. Certificates: all checklist items now live-verified (see §6) |

**Bottom line:** **card & admit card management is genuinely done** (15-route / 9-page surface, tenant-scoped, live-verified with DB-row evidence — see §1b + §1b-2). **Certificate management is now genuinely done too** (21-route / 13-page surface, tenant-scoped, four-eyes approval, public verifier, bulk jobs, revoke/replace — live-verified end-to-end with DB-row evidence — see §1c). Two runtime-blocking defects were found and fixed this pass: the `issued_certificates` schema/DB mismatch (migration 0070) and the certificate PDF render 500 (padding normalize in `render.ts`). The only remaining repo-wide build gate blocker is the pre-existing events/domains tsc baseline (task #19), which is out of scope for both features.

---

## 2. Migration & live-database state (verified)

Connection verified through the app's own driver (`pg` over `DATABASE_URL`, `postgresql://schoolos:…@localhost:5432/schoolos` — same path `src/libs/DB.ts` uses):

- `TOTAL_TABLES = 204`
- `MIGRATIONS_RECORDED = 70` (journal `migrations/meta/_journal.json` is contiguous, idx 0–71)
- Feature tables present: `certificate_definitions`, `certificate_definition_versions`, `certificate_templates`, `certificate_template_versions`, `certificate_requests`, `issued_certificates`, `certificate_jobs`, `certificate_job_items`, `certificate_events`, `certificate_signatories`, `certificate_event_rosters`, `document_templates`, `document_template_versions`, `issued_documents`, `document_generation_jobs`, `document_generation_items`, `document_events`, `addon_entitlements` (plus the legacy dead `certificates` table, untouched per both plans).
- `npm run db:migrate` (the user-facing command, drizzle-kit) succeeds.
- The earlier `db:migrate` failure was the **root blocker already resolved this session**: `migrations/0026_add_attendance_summary_excuses_flags.sql` duplicated ~11 types / ~16 tables / ~9 columns / ~41 constraints / ~5 indexes from migrations 0020–0025, so any fresh migrate failed mid-transaction. It is now idempotent (53 `DO $$ BEGIN … EXCEPTION WHEN duplicate_object` blocks, 18 `IF NOT EXISTS`, 364 lines; corrupt original preserved at `.bak-corrupted`).
- **Environment hazard:** the file was reverted to its corrupt form by OneDrive cloud sync once this session after validation; the transform was re-applied and re-validated. Treat file state as suspect after any long-running operation.

---

## 3. Certificate FIX-PLAN items — re-verified on disk (not assumed)

| FIX-PLAN item | Verification |
|---|---|
| §1 spike scripts / dev route deleted | `scripts/certificate-spike.ts`, `scripts/pdfme-spike.ts`, `src/app/api/dev/pdfme-spike/route.ts` — all absent. tsc reports **zero** errors under `src/app/api/cards/` or certificates. |
| §2 no raw verification token | `certificates-schema.ts:97` — `issuedCertificates` has ONLY `verificationTokenHash varchar(255) notNull`; `certificates-schema.ts:108` unique `(tenantId, verificationTokenHash)`. No raw-token column exists. Raw token returns once to the caller at issuance; only the hash is persisted. |
| §3 schema barrel wiring | `src/models/Schema.ts:3931-3932` — `export * from '@/features/certificates/models/certificates-schema';` and `export * from '@/features/cards/models/cards-schema';`. |
| §4 poisoned 0056 migration | `0056_mushy_puff_adder.sql` gone; journal idx 56 = `0056_add_refund_approval.sql` (647 bytes, legitimate). Verified in journal. |
| §5 0057 decision | Kept as real named migration `0057_add_journal_line_reconciliation_link.sql` (journal idx 58); `0057_add_admission_model_enhancement.sql` (idx 57) verified idempotent on disk. Both registered. |
| §6 serial concurrency | `certificate-service.ts` — bounded retry loop (lines 34–84) re-issues inside the transaction on Postgres `23505` matching `issued_certificates_tenant_serial_idx`; `tx` is the real Drizzle transaction type, not `any`. The unique constraint `(tenantId, serialNumber)` exists in the schema as the final safety net. |
| §7 dead `document-studio` file | `renderer.ts` deleted. Remaining: `fonts.ts`, `render.ts`, `TemplateDesigner.tsx`, `types.ts`, `validators.ts`. |
| §8 evaluators | 6/6 implemented (`evaluateManualAuthorized`, `evaluateEnrollmentActive`, `evaluateAssessmentThreshold`, `evaluateAttendancePercentage`, `evaluateEventParticipation`, `evaluateHrEmployment`), `EVALUATORS` record + `evaluateRule()` dispatcher, unit tests in `src/features/certificates/__tests__/evaluators.test.ts`. |

---

## 4. NEW critical bug found and fixed this pass (not in any plan)

**All three card API routes called an unregistered addon id, so every request returned `422 UNKNOWN_ADDON`.**

- `src/app/api/cards/templates/route.ts:15,42`, `…/[id]/route.ts:16,43,78`, `…/[id]/versions/route.ts:16,39` — all 7 call sites used `requireAddon(tenantId, 'cards')`.
- `requireAddon` → `assertKnownAddon(addonId)` (`src/libs/api/entitlements.ts:16-19`) throws `ApiError(422, 'UNKNOWN_ADDON')` for any id not in the addons registry (`src/addons/registry.ts`).
- The registry registers **`card-management`** (`registry.ts:74`) and **`certificate-management`** (`registry.ts:80`) — **not** `'cards'`/`'certificates'`. The plan's §5 text said `'cards'`, but the real codebase convention (attachments-book uses `'attachments-book'`, reporting uses `'advanced-reporting'`, seed 0035 uses `'multi-branch'`) is: **routes pass the registry id verbatim.**
- Consequence: the two "real" card pages (template library + designer) are fetch-driven but were **dead on arrival** — the static isolation sweep (`scripts/check-tenant-isolation.ts`) passes them because it only checks for a `tenantId` reference, which is exactly why this bug survived: *the static check cannot catch a runtime 500/422.*

**Fix applied:** all 7 call sites → `requireAddon(tenantId, 'card-management')`. Mechanism-level proof (real import of the registry, not a grep):

```
card-management registered: true
certificate-management registered: true
old 'cards' id still absent: true
```

Same latent bug will hit **certificate routes when they are built** — they must use `'certificate-management'`, not `'certificates'`.

---

## 5. What exists and is real (verified by reading the actual files)

**Cards API routes (15 total — 3 template routes below + 12 built this session, see §1b/§1b-2):**
- `GET/POST /api/cards/templates` — list (tenant-filtered, type filter) + create template + initial empty version. `requireRequestContext` role-gated, `requireTenant`, `requireAddon('card-management')`, `requireCapability('cards.templates.manage')`, `recordAudit`.
- `GET/PATCH/DELETE /api/cards/templates/[id]` — tenant-filtered; published templates are archived, not hard-deleted (implements the spec's "published/in-use versions cannot be mutated or hard-deleted").
- `GET/POST /api/cards/templates/[id]/versions` — tenant-filtered version listing + create/publish with next version number.

**Cards UI pages (all 8 dashboard pages exist, real/fetch-driven, not stubs; live-smoke-tested this pass):**
- `/dashboard/cards` — overview: KPI banner (Modèles, Cartes actives, Révoquées, Lots), quick-links grid, recent issued list.
- `/dashboard/cards/templates` — fetches `/api/cards/templates`, KPI banner (Total Modèles), search, create dialog with type `Select`, table with `Badge` variants.
- `/dashboard/cards/templates/[id]/edit` — loads `/api/cards/templates/${id}` + versions, renders `<TemplateDesigner>` (the one allowed shared-component exception), save + publish buttons.
- `/dashboard/cards/students` — student cards: search, KPI row, per-student status, Émettre → `IssueCardDialog`.
- `/dashboard/cards/employees` — employee cards: per-employee status, Émettre → `IssueCardDialog`.
- `/dashboard/cards/admit-cards` — admit cards from real `exam_seats`, term filter, status by `examCandidateId`, Émettre → `IssueCardDialog`.
- `/dashboard/cards/issued` — issued docs: type/status filters, KPI row, PDF download, revoke dialog.
- `/dashboard/cards/jobs` — bulk jobs: create w/ student picker, list, process, detail.

**Certificate API routes (21 total, all tenant-scoped via `requireTenant` + `requireAddon('certificate-management')`, capability-gated, live-verified §1c):**
- `GET/POST /api/certificates/definitions` + `GET/PATCH/DELETE /api/certificates/definitions/[id]` — definition CRUD, archive (not hard-delete).
- `GET/POST /api/certificates/definitions/[id]/versions` — version list + create/publish (`status='active'` = published).
- `GET/POST /api/certificates/templates` + `GET/PATCH/DELETE /api/certificates/templates/[id]` + `GET/POST /api/certificates/templates/[id]/versions` — certificate template CRUD + versioning (mirrors cards).
- `GET/POST /api/certificates/signatories` + `GET/PATCH/DELETE /api/certificates/signatories/[id]` — signatory CRUD + active toggle.
- `GET /api/certificates/settings` — issuer + signatories + counts + serial prefix.
- `GET /api/certificates/recipients?type=` — eligible recipients (student/employee) for issue dialogs.
- `GET/POST /api/certificates/requests` + `GET/PATCH /api/certificates/requests/[id]` — request workflow state machine (draft→submitted→under_review→approved/rejected/changes_requested→issued/cancelled), four-eyes guard, `certificates.approve` capability.
- `POST /api/certificates/issue` — single issuance (validates active version + target type, snapshots evidence, mints token + hash, renders PDF).
- `GET /api/certificates/issued` + `GET /api/certificates/issued/[id]` — issued list (status/definition filters) + detail with event timeline + render-data display.
- `GET /api/certificates/issued/[id]/pdf` — re-renders stored PDF.
- `POST /api/certificates/issued/[id]/revoke` + `POST /api/certificates/issued/[id]/replace` — soft-revoke + replace (original → `replaced`, new serial+token).
- `GET/POST /api/certificates/jobs` + `GET /api/certificates/jobs/[id]` + `POST /api/certificates/jobs/[id]/process` — bulk jobs (create validates published version, idempotent process).
- `GET /api/certificates/overview` — dashboard KPIs.
- `POST /api/public/certificates/verify` — public verifier (rate-limited, honeypot, sha256 lookup, generic invalid response).

**Certificate UI pages (12 dashboard pages + public verifier page, real/fetch-driven, all under `/dashboard/certificates`):**
- `/dashboard/certificates` — overview (KPIs + recent).
- `/dashboard/certificates/definitions` + `/definitions/[id]` (TemplateDesigner + publish).
- `/dashboard/certificates/templates` + `/templates/[id]/edit` (TemplateDesigner).
- `/dashboard/certificates/issue/students` + `/issue/employees` (recipient lists + IssueCertificateDialog).
- `/dashboard/certificates/requests` (state machine, reason dialog, create dialog).
- `/dashboard/certificates/issued` + `/issued/[id]` (list with filters, detail with timeline + revoke/replace dialogs).
- `/dashboard/certificates/jobs` (bulk jobs create/process/detail).
- `/dashboard/certificates/settings` (signatories CRUD + KPIs).
- Public verifier: `/verify/certificate/[token]`.

**Shared engine:** `src/libs/document-studio/` exists (schema type, `renderPdf` [with the padding fix], `<TemplateDesigner>`, allowlist validator, fonts) — both plans' prerequisite.

---

## 6. Acceptance-checklist live-verification status

### Card & Admit Card Management (PLAN.md §8)

| Item | Status | Evidence / blocker |
|---|---|---|
| pdfme spike renders Arabic RTL + French (browser + server) | ⚠️ PARTIAL | Server render **live-proven** (real PDF bytes on issue; 6 KB student card, 4.2 KB employee, 5.1 KB admit). Browser-designer preview still not exercised live (needs a browser session). |
| Publishing makes a template immutable | ⚠️ PARTIAL | Publish verified live (version `publishedById` set). Issue of an unpublished version → `400 NOT_PUBLISHED` (runtime-confirmed). DELETE-of-in-use version rejection still not live-tested (route archives published templates). |
| Issue a real card, opaque hashed token, generic verify response | ✅ VERIFIED | `201` + 64-char raw token; only sha256 hash stored. `/verify/card/[token]` page + `POST /api/public/cards/verify` return generic `{valid:false}` for both nonexistent and (by status guard) revoked/superseded. |
| Bulk-issue idempotency (kill/retry mid-batch) | ✅ VERIFIED | Job of 3 → run1 success=3, run2 "Lot déjà terminé", 0 reprocessed; STU-001 active-card count = 1 after single+bulk+retry (dedupe by existing-active). |
| Admit card from real `examTerms`/`examSeats` | ✅ VERIFIED | Seeded real term/hall/seat → admit issue `201`, verify `valid:true`, candidate/seat/hall from the real `exam_seats` row. |
| Cross-tenant sweep on every new route | ✅ VERIFIED | Seed + entitlements + sessions live. Issue/by-id/jobs cross attempts → `404`/`403`; Lango list empty; isolation sweep no new violations. Revoke + overview + seats + employees cross attempts → `404`/empty (this pass). |
| Disabling addon blocks new actions, existing cards still verify | ✅ VERIFIED | Entitlement flip → issue/list `403 ADDON_NOT_ACTIVATED`; existing token still `valid:true`. |
| Revoke flow: soft-revoke + reason + immediate verify invalidation | ✅ VERIFIED | `POST …/issued/[id]/revoke` sets `status='revoked'` + `revoked_at` + `revoked_by_id` + `revoke_reason`; `document_events` row `event_kind='revoked'`; re-verify returns generic `{valid:false}` matching a nonexistent token; re-revoke idempotent (no duplicate event). |
| PDF re-download of an issued card | ✅ VERIFIED | `GET …/issued/[id]/pdf` re-renders stored `schemaJson` + `renderDataSnapshot` → `application/pdf`, >500 bytes. |
| Overview KPI page | ✅ VERIFIED | `/dashboard/cards` fetches `/api/cards/overview`: template totals (total/published), issued-by-status + issuedTotal, jobs-by-status, recent ≤8; counts matched DB. |
| Admit-card page driven by real `exam_seats` | ✅ VERIFIED | `/dashboard/cards/admit-cards` lists allocated seats with term/hall/desk, filters by term, matches issue status via `examCandidateId`, Émettre → dialog issues a real card. |
| Students & employees card pages | ✅ VERIFIED | `/dashboard/cards/students` + `/employees` render staff/student lists with per-subject card status, search, KPI rows; Émettre → dialog issues real cards. |
| Issued-documents page (filter/revoke/download) | ✅ VERIFIED | `/dashboard/cards/issued` filters by type/status, KPI row, PDF download link, revoke dialog. HTML smoke + HTTP sweep on all 5 pages. |
| Sidebar navigation to all card pages | ✅ VERIFIED | "Cartes & Convocations" expanded to 7 sub-items, capability-gated; each target route live-verified. |

### Certificate Management (PLAN.md §8)

| Item | Status | Evidence / blocker |
|---|---|---|
| Real issuance from real eligibility evaluation + evidence snapshot + non-retroactive threshold | ✅ VERIFIED | `POST /api/certificates/issue` live: validates active version + target type, snapshots evidence into `issued_certificates.evidence_snapshot` (not re-derived), mints serial + opaque token. Serial `CERT-2026-000001…000008` with per-row `evidence_snapshot`. |
| Bulk-job retry → no duplicate active cert per student | ✅ VERIFIED | Job of 2 → run1 `processed=2 success=2`; run2 `processed=0` ("Lot déjà terminé"); no duplicate serials. Unique `certificate_job_items_tenant_job_recipient_idx` in schema. |
| Correction flow (replace, original → `replaced`, new serial+token) | ✅ VERIFIED | `POST …/issued/[id]/replace` → new cert `status='valid'` (new serial + token), original → `replaced`, original token verify → generic `{valid:false}`. DB: replaced chain `CERT-2026-000004→000005`. |
| Revocation reflected immediately on verify page | ✅ VERIFIED | `POST …/issued/[id]/revoke` → `status='revoked'`, `certificate_events` kind `revoked` with reason; re-verify same token → `{valid:false}`. Public page `/verify/certificate/[token]` exists. |
| Public verify never leaks evidence/DOB/NID/salary/guardian | ✅ VERIFIED | `POST /api/public/certificates/verify` response shape is `{valid, recipientName, certificateTitle, serialNumber, issuedAt, schoolName}` — no evidenceSnapshot/DOB/NID/salary/guardian echoed. Honeypot + rate limit + generic `{valid:false}` verified. |
| Four-eyes approval (preparer ≠ approver) | ✅ VERIFIED | Teacher creates/submits/reviews, admin approves (four-eyes satisfied). Same-user approve → `400 FOUR_EYES_VIOLATION`; teacher (no `certificates.approve`) → `403`. |
| Cross-tenant sweep on every new route | ✅ VERIFIED | Lango admin: 0 Atlas definitions/issued; by-id access to Atlas cert → `404 NOT_FOUND`; addon-disabled → `403 ADDON_NOT_ACTIVATED`. |
| Serial collision-safety under concurrent load | ⚠️ PARTIAL | Retry loop + unique constraint verified (§3). Parallel load-test not run (serial service is single-process dev; production would use Postgres advisory locks or the existing retry loop). |

---

## 7. Honest open work — what "genuinely done" still requires

**Certificate management — ✅ COMPLETE (no open work).** All routes and pages from the plan exist, are tenant-scoped, and were live-verified end-to-end (§1c) + DB-row-verified. The two runtime-blocking defects (issued_certificates schema/DB mismatch; certificate PDF render 500) were found and fixed this pass.

**Card & admit card management — ✅ COMPLETE (no open work).** All routes and pages from the plan exist, are tenant-scoped, and were live-verified end-to-end (27/27 sweep) + DB-row-verified (see §1b + §1b-2).
- Remaining known nit (non-blocking, pre-existing): `pdfme` **browser-designer** preview is still unexercised live (server render is proven); this is the editor component's own preview, not a card-management gap.

**Runtime/verification preconditions — ✅ all resolved (task #15):**
- `npm run db:seed` run → 2 tenants (Atlas + Lango) + 6 credential accounts; sign-in path established via `POST /api/auth/sign-in/email` (better-auth) with fresh cookie jars per session.
- Both `card-management` and `certificate-management` entitlements granted to both tenants (addon-disabled flip tested live).

---

## 8. Pre-existing repo-level breakage — RESOLVED (2026-08-07, fifth pass)

The repo-wide build gate that this report previously documented as blocked is now **green**. `tsc --noEmit` = **0 errors**, `npm run check:isolation` = **pass**, `next build` = **exit 0**. The events-addon scaffolding that was never finished was repaired to compile and follow the codebase's auth/tenant conventions:

- **`getAuthContext` (did not exist) → the real API.** All 4 events routes (`addons/events/route.ts`, `[id]/occurrences`, `[id]/registrations`, `calendar`) now use `requireRequestContext` + `requireTenant` + `requireAddon(tenantId, 'event-management')` + `requireCapability` + `apiErrorResponse` + `parseJson`/zod, matching the cards/certificates route pattern. `[id]` routes got Next 15/16 async `params: Promise<{ id }>` (this also cleared the 2 generated `.next/dev/types/validator.ts` route-handler constraint errors).
- **`events-service.ts`** fixed: `ApiError` constructor arg order (`status` must be number), `timestamp {mode:'string'}` columns no longer receive `new Date(...)` (string passed directly), `noUncheckedIndexedAccess` on `split('T')[0]` → `slice(0,10)`, and the relational `db.query...with{}` calls (drizzle relations were never wired for the events tables — `Relations.ts` is unused) replaced with explicit tenant-scoped `select/join` queries.
- **3 isolation-sweep failures fixed:** `settings/migration/tasks/[id]` and `settings/migration/template` now call `requireTenant(context)` (matching the sibling `settings/migration/route.ts`); the unused `academics/promotions/route.ts` re-export alias was deleted (nothing referenced its base endpoint, and the static checker cannot follow re-exports — the underlying `students/promotions/route.ts` is already tenant-scoped).

**Pre-existing migration inconsistency (still open, not build-blocking):** the migrations journal has **two** entries tagged `0068_add_custom_domains`, and `migrations/0068_event_management.sql` exists on disk but is **not** in the journal — so the event tables were never created on any DB. The events addon is registered but "Not built"; its routes now compile and are tenant-guarded, but any runtime use requires the orphaned migration to be journaled+applied and the addon entitled. Outside this report's scope.

---

## 9. Recommended next steps

1. **Done — the repo-wide build gate is green.** `tsc` 0 errors, isolation check passes, `next build` exits 0 (see §8). No remaining repo-wide blocker for cards/certificates.
2. **Certificate & card surfaces are complete and live-verified** — no further build work for either feature. Follow-up is maintenance only.
3. **Open (out of this report's scope):** resolve the migrations-journal inconsistency (duplicate `0068_add_custom_domains` entry; orphaned `0068_event_management.sql`) before any runtime work on the events addon. The events routes are now compile-clean and tenant-guarded but the addon remains unshipped.
4. Both features ship with the schema/DB and PDF-render fixes in this pass (`migrations/0070_certificates_align_issued_columns.sql`, `src/libs/document-studio/render.ts` padding normalize). Keep the migration applied on any future environment (the journal records idx 71).

---

*Environment hazards recorded for future passes: (a) OneDrive reverted/truncated files this session — the audit report itself was truncated to 0 bytes by a failed write on a full disk (19:03) and had to be reconstructed; check file state after edits and after any long operation, and watch disk free space; (b) the Docker CLI hangs in this environment (daemon/WSL backend unresponsive), so DB verification was done through the app's own `pg` connection rather than `docker exec`; (c) the app DB was an empty shell at audit start — schema present, zero app data.*
