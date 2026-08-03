# SchoolOS v2 Implementation Plan — Paired Phases, Prioritized, Full Detail

## How to read this document

Restructured from the original v2 roadmap (2026-07-31) per user request: **paired into 8 execution phases** (2 sections each, one phase solo), **ordered highest to lowest priority**, with **full implementation detail** per task — exact schema, exact route contracts, exact UI files — so any session can pick up a phase and build it without re-deriving design decisions.

Every schema block below uses this codebase's exact Drizzle conventions (verified against `src/models/Schema.ts`):
- `id: uuid().defaultRandom().primaryKey().notNull()`
- `tenantId: uuid('tenant_id').notNull()` + `foreignKey({...}).onDelete('cascade')` to `tenants.id`
- Any column referencing `user.id` (students/teachers/parents) is `text()`, not `uuid()` — `user.id` values look like `STU-xxx`/`USR-xxx`/`PARENT-xxx`
- Timestamps: `timestamp('created_at', { mode: 'string' }).defaultNow().notNull()`
- Enums via `pgEnum('name', [...])`

Every route follows the established pattern: `requireRequestContext(request, allowedRoles)` → `requireTenant(context)` → Zod `.strict()` schema → tenant-scoped Drizzle query → `parsePagination` on GET → `recordAudit()` on mutations → `apiErrorResponse()` catch-all.

Migrations continue sequentially from `migrations/0019_add_class_schedule_slots.sql` — **next number is 0020**. Remember: `docker compose build migrate` explicitly after every migration, not just `docker compose build app` (see `MIGRATION-NOTES.md`'s stale-image incident).

**Priority legend:** 🔴 P0 Critical (do first, closes real risk or known-fake data) · 🟠 P1 High (major business/security value) · 🟡 P2 Medium (solid value, not urgent) · 🟢 P3 Low (polish, do last).

Nothing in this document has been built yet. This is a planning/spec document — build one phase at a time, typecheck, `docker compose build` both images, live-verify with real HTTP + tenant isolation, clean up test data, then update `MIGRATION-NOTES.md`.

---

## Phase 1 — 🔴 P0 — Sections 21 + 24: Audit Fixes & Tenant-Isolation Hardening

**Why first:** closes the two things a fresh audit actually found still fake, and hardens the single guarantee the entire multi-tenant business model depends on. Nothing else matters if tenant isolation regresses.

### Section 21 — Quick audit fixes

**21.1 — Delete dead mock file**
- Delete `src/features/academics/data/optional-subjects-data.ts` (confirmed zero importers via grep).
- Verify: `npx tsc --noEmit` clean, `grep -r optionalSubjectsMockData src/` returns nothing.

**21.2 — Real notification badge (stub until Phase 4 lands)**
- File: `src/components/shared/header.tsx:85-107`.
- Replace hardcoded `"2 Alertes"` / `"12 Absences non justifiées"` with a real count.
- Interim data source (until Section 29 exists): `GET /api/dashboard/summary`'s existing `todayAttendance.absentCount` field (already real, already fetched elsewhere) — wire it into the header's existing fetch-on-mount pattern.
- Verify: create a real absence today, confirm the header badge count increments on next load.

**21.3 — `ComingSoonView` drift check**
- Grep all 8 `<ComingSoonView .../>` usages (6 super-admin pages, syllabus, attendance-settings, CNDP). Confirm none of them have a sibling fake-data array reintroduced since Sections 13-17.
- Verify: `grep -rn "ComingSoonView" src/features` returns exactly 8 call sites, each file otherwise empty of literal data arrays.

**21.4 — Silent-failure audit**
- Grep `console.error` inside `src/features/**/ui/*.tsx` catch blocks — for each, confirm there's also a user-visible `setError(...)` call, not just a console log. List any that only log.
- Verify: manually trigger one previously-silent failure path (e.g., disconnect network mid-fetch) and confirm an error banner now renders.

**21.5 — Route auth-coverage regression test**
- Extend `src/app/api/security.test.ts` (existing suite from Section 1) to cover every route added in Sections 13-20: `/api/audit-logs`, `/api/settings/logo`, `/api/settings/access-reset`, `/api/students/documents`, `/api/teachers/photo`, `/api/finance/reports`, `/api/academics/{class-results,classes/roster,timetable-slots,timetable-conflicts,assessment-sessions}`.
- Assert: anonymous request → `401`; wrong-tenant session → empty/`404`, never another tenant's row.
- Verify: `npm test -- security.test.ts` green, all new routes present in the assertion list.

### Section 24 — Multi-tenant isolation hardening

**24.1 — Automated cross-tenant test suite**
- New file: `src/app/api/tenant-isolation.test.ts`.
- Programmatically enumerate every route file under `src/app/api/**/route.ts` (via `fs.readdirSync` at test-setup time, not a hardcoded list — so new routes are automatically covered).
- For each GET route: log in as Tenant A, create a real row; log in as Tenant B, call the same GET; assert Tenant A's row is absent from Tenant B's response.
- For each mutating route (PUT/DELETE by `id`): as Tenant B, attempt to mutate a row that belongs to Tenant A by ID; assert `404`/`403`, never `200`.
- Exclude the deliberately tenant-free `super-admin/*` routes via an explicit allowlist at the top of the file (documented why).
- Verify: run the suite; deliberately comment out one `eq(table.tenantId, tenantId)` filter in an existing route, confirm the suite fails loudly; restore it.

**24.2 — Pre-commit tenant-filter lint check**
- New script: `scripts/check-tenant-isolation.ts` (or a custom ESLint rule if the codebase already has custom rules — check `eslint.config.*` first).
- Static-analyze every Drizzle `.select()`/`.update()`/`.delete()` call inside `src/app/api/**` — flag any `.from(someTable)`/`.where(...)` that never references `tenantId` in the same statement, unless the file is on the super-admin allowlist.
- Wire into `package.json`'s `precommit`/`lint` script.
- Verify: introduce a deliberate tenant-filter omission in a scratch branch, confirm the script exits non-zero; revert.

**24.3 — Teacher scope review**
- Audit every `role: 'teacher'`-permitted route (attendance, grade-entry, class-sections read, timetable-slots read) — confirm the query additionally restricts to class-sections the teacher is actually assigned to via `classTeachers`/`subjectTeachers`, not every section in the tenant.
- Fix any route found scoping only by `tenantId` and not by actual assignment (list findings before fixing, since this may be intentional in some read-only cases — confirm with existing UI expectations first).
- Verify: log in as a teacher assigned to only 1 of 3 class-sections in a tenant; confirm attendance/grade-entry pickers show only that 1 section.

**24.4 — Tenant-path-namespacing checklist for new modules**
- Document (in this same file, appended as a checklist) the exact file-storage tenant-namespacing pattern from `src/libs/api/uploads.ts` — require Phases 5/6's homework-submission and exam-content uploads to follow it from the first commit, not retrofitted.
- Verify: N/A (documentation task) — re-verify at Phase 5/6 build time that new upload paths are `{tenantId}/{...}`.

**24.5 — Isolation model documentation**
- New file: `ARCHITECTURE.md` at repo root — one page: how `requireTenant`/`requireSuperAdmin` work, why there's no Postgres RLS, the `role: 'teacher'` scoping nuance from 24.3, the file-storage namespacing pattern.
- Verify: N/A (documentation task).

**Phase 1 overall verify:** `docker compose build app && docker compose build migrate`, run both new test suites in CI, confirm zero regressions on the existing manual tenant-isolation spot-checks documented in `MIGRATION-NOTES.md`.

---

## Phase 2 — 🔴 P0 — Sections 22 + 23: Auth/Session Hardening & API/Infra Hardening

**Why second:** the app currently has zero rate limiting anywhere, including login — this is the most exploitable real gap before any new public-facing surface (Phase 4's inquiry form) ships.

### Section 22 — Auth & session hardening

**22.1 — Rate-limit login**
- Better Auth has a built-in rate-limit config (`rateLimit` option in `betterAuth({...})`, `src/libs/auth.ts`). Configure: 5 attempts / 15 min per IP+email combination on `sign-in/email`.
- Verify: script 6 rapid bad-password attempts against a real seeded account; confirm the 6th returns `429` even with the correct password on attempt 6.

**22.2 — Account lockout**
- Migration `0020`: add `failedLoginCount: integer('failed_login_count').default(0).notNull()`, `lockedUntil: timestamp('locked_until', { mode: 'string' })` to `user` table.
- Better Auth hook (`hooks.after` on sign-in) increments/resets `failedLoginCount`; locks (`lockedUntil = now + 30min`) after 5 failures.
- `school_admin` unlock action: `POST /api/users/:id/unlock` (school_admin only, own tenant).
- `recordAudit()` the lockout event with `entityType: 'user_lockout'`.
- Verify: trigger 5 failures, confirm 6th attempt rejected with a clear "locked" message even with correct password; unlock via the admin action; confirm login succeeds immediately after.

**22.3 — Password complexity policy**
- New shared validator `src/libs/api/password-policy.ts`: min 10 chars, not in a small common-password denylist (embed a ~1000-entry list, no external API call).
- Apply at: `seed.ts` (dev-only, can bypass), super-admin school creation (`generateTempPassword` already meets this — confirm), access-reset (already meets this), and any future self-service password change (Phase 5.35.4).
- Verify: attempt a weak-password self-service change once 22.4/35.4 exists; confirm rejection with a specific reason.

**22.4 — Session timeout & rotation**
- Better Auth session config: `expiresIn` shorter for `super_admin` sessions (e.g. 2h) than `school_admin`/`teacher`/`parent` (e.g. 8h) — Better Auth supports per-role session config via a custom session hook if not natively role-aware; check current version's API before assuming a built-in.
- Verify: log in as super_admin, confirm session expires and requires re-auth after the configured window (test with a shortened dev-only value, not the real 2h).

**22.5 — 2FA (TOTP) for school_admin/super_admin**
- Better Auth 2FA plugin (`twoFactor()` in the auth config). Scope enrollment prompt to `role in ('school_admin', 'super_admin')` only for v2.
- New settings UI: `dashboard/settings/security` — QR enrollment, backup codes.
- Verify: enroll a real school_admin account in 2FA, confirm login now requires a valid TOTP code, confirm a wrong code is rejected, confirm backup codes work once.

**22.6 — Forced password change for temp-password accounts**
- Migration `0020` (same file as 22.2): add `mustChangePassword: boolean('must_change_password').default(false).notNull()` to `user`.
- Set `true` when: super-admin creates a school (Section 8's flow), access-reset generates a code (Section 18's flow).
- Middleware/layout check: if `mustChangePassword`, redirect every route except a dedicated `dashboard/change-password` page.
- Verify: create a school via super-admin, log in as the new admin with the temp password, confirm immediate redirect to change-password and no dashboard access until changed.

**22.7 — Role-guard canonical matrix**
- New file `docs/role-matrix.md` (or a `.ts` const consumed by a test): every route path → allowed roles, hand-derived once from the current codebase.
- New test: `role-matrix.test.ts` greps every `requireRequestContext(request, [...])` call and diffs the actual roles array against the documented matrix — fails on drift either direction.
- Verify: intentionally add an extra role to one route's guard without updating the matrix doc; confirm the test catches it; revert.

### Section 23 — API & infrastructure hardening

**23.1 — Per-route mutation rate limiting**
- Shared middleware `src/libs/api/rate-limit.ts` — in-memory (or Redis if already available; check `docker-compose.yml` for an existing cache service before adding one) sliding-window limiter, keyed by `tenantId + userId + route`.
- Apply via a thin wrapper around `requireRequestContext` so every POST/PUT/DELETE route gets it by construction, not per-route copy-paste.
- Verify: burst 20 rapid POSTs against a real mutation route from one session; confirm later requests in the burst return `429`.

**23.2 — Security headers audit**
- `next.config.ts`: add/confirm `Content-Security-Policy`, `X-Frame-Options: DENY`, `Strict-Transport-Security`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Specifically verify CSP doesn't break the binary-serving routes (`/api/students/photos`, `/api/teachers/photo`, `/api/settings/logo`) — these return raw bytes with `Content-Type` set per-file, confirm headers still apply correctly there.
- Verify: `curl -I` a real page and a real photo route, confirm headers present on both.

**23.3 — Dependency vulnerability scanning in CI**
- Add `npm audit --audit-level=high` (or Dependabot config) as a CI gate — research whether this repo has CI configured yet (`.github/workflows/`) before assuming; if none exists, this task includes standing up minimal CI first.
- Verify: confirm the check runs and would fail on a deliberately-introduced known-vulnerable dependency (test in a scratch branch, don't merge).

**23.4 — Upload content-sniffing**
- Extend `src/libs/api/uploads.ts`'s `saveUploadedFile` to verify actual file magic bytes (not just the client's `Content-Type` header) for JPEG/PNG/PDF before writing — small dependency-free magic-byte check (PNG: `89 50 4E 47`, JPEG: `FF D8 FF`, PDF: `25 50 44 46`).
- Verify: rename a `.txt` file to `.png`, set `Content-Type: image/png` manually in the upload request, confirm rejection.

**23.5 — Rate-limit file-serving routes**
- Apply the Section 23.1 limiter to `GET` on all binary-serving routes too (currently only considered for mutations) — these are guessable-ID-adjacent even with tenant checks.
- Verify: burst-request a real photo URL, confirm eventual `429`.

**23.6 — Structured logging**
- Introduce `pino` (lightweight, no new infra needed) — replace `console.error`/`console.log` across `src/app/api/**` and `src/libs/**` with a shared logger instance.
- Verify: trigger a real error path, confirm structured JSON log output instead of a bare string.

**23.7 — Error tracking integration**
- Sentry (or self-hosted alternative if the user prefers no external SaaS — ask before assuming Sentry specifically, since this touches sending data off-server).
- Wire both client-side (`app/global-error.tsx`) and server-side (API route catch-alls via `apiErrorResponse`).
- Verify: trigger a real unhandled error, confirm it appears in the tracking dashboard within a minute.

**23.8 — Secret-rotation runbook**
- New `docs/secret-rotation.md`: exact steps to rotate `DATABASE_URL` password and `BETTER_AUTH_SECRET` without downtime (dual-secret transition window for Better Auth session validation, connection-string swap order for Postgres).
- Verify: N/A (documentation), but dry-run the DB password rotation steps against a scratch/staging DB once to confirm the runbook is actually correct, not just plausible.

**Phase 2 overall verify:** login rate-limit + lockout + 2FA all live-tested with real accounts; security headers present on a real response; a deliberately bad dependency version caught by the CI check.

---

## Phase 3 — 🟠 P1 — Sections 25 + 26: Data Protection/Compliance & Backup/DR

**Why third:** real operational risk (no backups exist today) and compliance exposure (CNDP page is currently just a placeholder with nothing behind it) — high stakes, but not actively exploitable the way Phase 2's gaps are, hence P1 not P0.

### Section 25 — Data protection, compliance & observability

**25.1 — Real CNDP F211 filing tracker**
- Migration `0021`: `cndpFilings` table — `id uuid pk`, `tenantId uuid notNull FK cascade`, `filingReference varchar(100)`, `filedAt date`, `status enum('draft','submitted','approved')`, `documentUploadPath varchar(255)` (reuses upload helper), `notes text`.
- `GET/POST /api/settings/cndp-filing` — school_admin only, one row per tenant (`onConflictDoUpdate` on `tenantId`, same pattern as `schoolSettings`).
- Replace the `ComingSoonView` in `src/features/settings/ui/cndp-view.tsx` with a real form — but the page still shows "no filing on record" honestly until a school_admin actually records one; never auto-populate a fake reference.
- Verify: record a real filing reference for a test tenant, confirm it persists and displays; confirm a fresh tenant with no filing shows an honest empty state, not a fabricated one.

**25.2 — Per-tenant data export**
- `GET /api/settings/data-export` (school_admin only) — generates a real JSON/CSV archive of every table filtered by that tenant's `tenantId` (students, teachers, invoices, attendance, grades, etc. — reuse the same table list as the tenant-isolation test's route enumeration from 24.1 to stay in sync).
- Streams a downloadable zip; large tenants should not load everything into memory at once — batch per table.
- Verify: export a real seeded tenant, confirm the archive actually contains real rows matching a manual DB query count.

**25.3 — Tenant anonymization/offboarding flow**
- `POST /api/super-admin/schools/:id/anonymize` (super_admin only) — distinct from hard delete: nulls/hashes PII columns (names, emails, phones) across `user`/`guardians` while preserving aggregate rows for retention-compliant record-keeping; sets `tenants.subscriptionStatus = 'cancelled'`.
- Verify: anonymize a real scratch tenant, confirm PII columns are gone but row counts/aggregates are unchanged; confirm the tenant can no longer log in.

**25.4 — Uploads-at-rest encryption**
- Research spike first: evaluate LUKS/dm-crypt on the Docker volume vs. application-level encryption (encrypt bytes before `writeFile`, decrypt on read) in `src/libs/api/uploads.ts`. Recommend application-level for portability across hosting environments — document the tradeoff, then implement.
- Verify: confirm an uploaded file is unreadable as plaintext directly from the volume/disk, but round-trips correctly through the app's read path.

**25.5 — Real security dashboard**
- `GET /api/security/dashboard` (school_admin/super_admin) — real aggregates: failed-login count (from 22.2's counter), active-session count, recent lockouts, recent access-resets — all from real tables, zero invented numbers.
- New page `dashboard/settings/security-dashboard`.
- Verify: trigger a real burst of failed logins, confirm the dashboard's count matches exactly.

**25.6 — Audit-log export**
- Extend the existing real `dashboard/settings/audit-logs` page with a CSV export button hitting a new `GET /api/audit-logs/export`.
- Verify: export, confirm row count matches the on-screen paginated total.

### Section 26 — Backup & disaster recovery

**26.1 — Per-tenant on-demand backup**
- `POST /api/super-admin/schools/:id/backup` (super_admin) — reuses the same table-enumeration approach as 25.2 but produces a restorable SQL dump scoped to one tenant's rows (not a full `pg_dump`, since tenants share tables).
- Verify: back up a real scratch tenant.

**26.2 — Scheduled automated backups**
- Container-level: add a `backup` service to `docker-compose.yml` running `pg_dump` on a cron schedule against the full DB, writing to a separate named volume with a retention policy (keep last 14 daily + last 8 weekly, pruned by a small script).
- Verify: let it run once on a short dev-only interval, confirm a real dump file appears in the backup volume.

**26.3 — Restore path, actually tested**
- Runbook + script: restore a `26.2` dump into a scratch Postgres container, confirm the app boots against it and real data is queryable.
- Verify: do this for real once against a copy, not just in theory — this is the task most likely to be skipped and most important not to skip.

**26.4 — Backup/restore + migrations interaction doc**
- Append to `MIGRATION-NOTES.md`: what happens if you restore a backup taken before the latest migration — must re-run `migrate` after restore, document the exact command sequence.
- Verify: N/A (documentation), cross-checked against the real restore test in 26.3.

**Phase 3 overall verify:** a real backup → real restore → app boots and serves real data; a real tenant data export contains real rows; security dashboard numbers match a live-triggered event.

---

## Phase 4 — 🟠 P1 — Sections 27 + 29: Admissions/Inquiry CRM & Announcements

**Why fourth:** highest business value of the 4 chosen new modules (top-of-funnel sales tracking + closes the Section 21.2 fake-badge stub with real data) and the two smallest/most self-contained — good pairing, ships fast, high visible payoff.

### Section 27 — Admissions/inquiry CRM

**27.1 — Schema**
```
inquiries: id uuid pk, tenantId uuid notNull FK cascade,
  contactName varchar(255) notNull, phone varchar(50), email varchar(255),
  source pgEnum('walk_in','phone','web','referral') notNull,
  interestLevel pgEnum('low','medium','high') default('medium'),
  status pgEnum('new','contacted','qualified','converted','lost') default('new') notNull,
  assignedToId text (FK -> user.id, nullable, onDelete set null),
  notes text, convertedApplicantId uuid (FK -> applicants.id, nullable, onDelete set null),
  createdAt, updatedAt timestamps

inquiryFollowUps: id uuid pk, tenantId uuid notNull FK cascade,
  inquiryId uuid notNull FK cascade -> inquiries.id,
  type pgEnum('call','email','meeting','note') notNull,
  notes text notNull, scheduledFor timestamp nullable,
  completedAt timestamp nullable, createdById text, createdAt timestamp
```
Migration `0022`.

**27.2 — CRUD route**
- `GET/POST/PUT /api/admissions/inquiries` (school_admin, receptionist) — standard tenant-scoped pattern, `GET` supports `?status=`/`?assignedToId=` filters + pagination.

**27.3 — Conversion route**
- `POST /api/admissions/inquiries/:id/convert` — validates inquiry belongs to tenant, creates a real `applicants` row via the existing Section-4 admissions logic (call the same insert path, don't duplicate the schema-mapping logic), sets `inquiries.status = 'converted'` + `convertedApplicantId`.
- Verify this reuses `src/app/api/students/admissions/route.ts`'s applicant-creation logic rather than re-implementing it — import/extract a shared function if needed.

**27.4 — Follow-up log CRUD**
- `GET/POST /api/admissions/inquiries/:id/follow-ups` — nested under an inquiry, tenant-scoped through the parent.

**27.5 — Kanban UI**
- `dashboard/students/admissions/inquiries/page.tsx` + `inquiries-kanban-view.tsx`, columns = `status` enum values, matching the exact drag/status-change pattern already proven in `admission-requests-view.tsx`.

**27.6 — Funnel stats route**
- `GET /api/admissions/funnel-stats` — real aggregate: count by `inquiries.status`, plus join through to `applicants.status` and `user` (enrolled), same `Promise.all` parallel-query pattern as `/api/analytics`.

**27.7 — Assignment UI**
- Assignee picker in the inquiry detail panel, sourced from real `/api/users?role=Admin` (reuse Section 13's staff endpoint).

**27.8 — Dashboard-home follow-up widget**
- Extend `GET /api/dashboard/summary` with a real `dueFollowUpsCount` (real query: `inquiryFollowUps` where `scheduledFor <= today` and `completedAt is null`), surface on `dashboard-view.tsx`.

**27.9 — Public inquiry form**
- `POST /api/public/inquiries/:tenantSlug` — **the one genuinely unauthenticated write endpoint in the app.** Requires: tenant resolved by slug (not ID, don't leak internal UUIDs publicly), aggressive rate limiting (reuse 23.1's limiter, much stricter — e.g. 3/hour per IP), honeypot field or similar basic bot deterrent, strict Zod validation, no file uploads accepted on this endpoint.
- Minimal public page `app/[locale]/(public)/inquire/[tenantSlug]/page.tsx` — outside the `(dashboard)` auth-gated tree entirely, new route group.
- Verify: submit a real public inquiry anonymously, confirm it lands in the kanban as `status: 'new'`; confirm rate limiting blocks a 4th submission within the hour from one IP; confirm a submission for a nonexistent `tenantSlug` fails cleanly, not with a stack trace.

**Verify (whole section):** full lifecycle — public form submission → kanban → assign → follow-up logged → convert to applicant → existing approval flow → real enrolled student. Tenant isolation on every new route.

### Section 29 — Announcements/notifications

**29.1 — Schema**
```
announcements: id uuid pk, tenantId uuid notNull FK cascade,
  title varchar(255) notNull, body text notNull,
  targetRole pgEnum(...role values...) nullable (null = everyone),
  targetClassSectionId uuid nullable FK -> classSections.id onDelete cascade,
  createdById text notNull, publishedAt timestamp defaultNow, createdAt timestamp

announcementReads: id uuid pk, announcementId uuid notNull FK cascade -> announcements.id,
  userId text notNull, readAt timestamp defaultNow notNull,
  unique(announcementId, userId)
```
Migration `0023`.

**29.2 — CRUD route**
- `GET/POST /api/communication/announcements` (school_admin creates; all authenticated roles can GET, filtered server-side by `targetRole is null OR targetRole = context.role` AND `targetClassSectionId is null OR matches viewer's class`).

**29.3 — Unread-count route**
- `GET /api/communication/announcements/unread-count` — real count of announcements visible to `context.userId`'s role/class minus those with an `announcementReads` row for that user.
- **This is what Section 21.2's header badge points to once this ships** — go back and swap the interim `todayAttendance.absentCount` stub for this real endpoint.

**29.4 — Mark-read route**
- `POST /api/communication/announcements/:id/mark-read` — upserts into `announcementReads`.

**29.5 — Announcements feed UI**
- `dashboard/communication/announcements/page.tsx` — list + create form (school_admin), read/unread visual state for all roles.

**29.6 — Header dropdown rewire**
- `src/components/shared/header.tsx` — replace the 21.2 interim stub with real `announcements/unread-count` + a real dropdown listing the actual unread announcements (not a single hardcoded line).

**29.7 — Polling refresh**
- Short-interval (e.g. 60s) client-side refetch of the unread count while the dashboard is open — explicitly document this as polling, not real-time/websockets, since no such infra exists in this app; this is a real, disclosed limitation, not something to paper over.

**Verify (whole section):** publish a `targetRole: 'teacher'` announcement, confirm only teacher accounts see it and get a real unread badge increment; mark read, confirm decrement; confirm a `school_admin`-only announcement never reaches a student session; confirm tenant isolation.

**Phase 4 overall verify:** both sections' full lifecycles tested live; header badge genuinely reflects real unread announcements, closing the loop from the original audit finding.

---

## Phase 5 — 🟠 P1 / 🟡 P2 — Sections 28 + 35: Homework Portal & Teacher/Parent Portal Enhancements

**Why fifth:** the first genuinely student/parent-facing write surface in the whole app — high value, but bigger and riskier than Phase 4 (new auth-path testing burden), so it follows the two smaller wins. Section 35 is paired here because it directly extends the same portal groundwork rather than standing alone.

### Section 28 — Homework/assignment portal

**28.1 — Schema**
```
assignments: id uuid pk, tenantId uuid notNull FK cascade,
  classSubjectId uuid notNull FK -> classSubjects.id onDelete cascade,
  title varchar(255) notNull, description text,
  dueDate timestamp notNull, maxScore numeric(5,2) notNull,
  createdById text notNull, createdAt, updatedAt timestamps

assignmentSubmissions: id uuid pk, tenantId uuid notNull FK cascade,
  assignmentId uuid notNull FK cascade -> assignments.id,
  studentId text notNull FK cascade -> user.id,
  submittedAt timestamp, fileExt varchar(10),
  score numeric(5,2) nullable, feedback text nullable,
  status pgEnum('pending','submitted','late','graded') default('pending') notNull,
  unique(assignmentId, studentId)
```
Migration `0024`.

**28.2 — Teacher create route**
- `POST /api/academics/assignments` (school_admin, teacher) — validates `classSubjectId` belongs to tenant (same helper pattern as `assessment-plans`).

**28.3 — Submission route**
- `POST /api/academics/assignments/:id/submit` (student, parent) — file upload via `src/libs/api/uploads.ts` at `documents/{tenantId}/homework/{assignmentId}/{studentId}.{ext}`; sets `status: submittedAt > dueDate ? 'late' : 'submitted'` server-side (never trust client-computed lateness).

**28.4 — Grading route**
- `POST /api/academics/assignments/:id/grade` (teacher) — body `{studentId, score, feedback}`, validates `score <= maxScore`, sets `status: 'graded'`.

**28.5 — Teacher review UI**
- `dashboard/academics/assignments/page.tsx` — list assignments per class-subject; `assignments/[id]/page.tsx` — submission review + inline grading, matching the roster-table pattern already used across the app.

**28.6 — Student/parent "my homework" view**
- `dashboard/homework/page.tsx` (new top-level nav item for `student`/`parent` roles — **first page in the app scoped to these roles**, confirm `sidebar.tsx`'s role-gating logic actually handles a nav item visible ONLY to student/parent, not just hidden-from-others).
- Real upload UI matching `student-photos-view.tsx`'s click-to-upload pattern.

**28.7 — Auth-path validation (do not skip)**
- Because this is the first real student/parent write surface: explicitly re-verify `requireRequestContext` correctly resolves a `role: 'student'` or `role: 'parent'` session's `tenantId`, and that a parent can only submit on behalf of their own linked child(ren) via `guardianStudents`, never an arbitrary `studentId`.

**28.8 — Completion-rate stat**
- `GET /api/academics/class-results?classSubjectId=` extended (or a sibling endpoint) with real homework completion % per class-subject.

**Verify (whole section):** create assignment as teacher → submit as a real parent account on behalf of their linked child → grade as teacher → confirm the parent sees the real grade → confirm a late submission is flagged correctly → confirm a parent CANNOT submit for a child they aren't linked to (test this specifically, it's the highest-risk gap in this section) → tenant isolation.

### Section 35 — Teacher/parent portal enhancements

**35.1 — Parent-teacher meeting scheduling**
```
meetingSlots: id uuid pk, tenantId uuid notNull FK cascade,
  teacherId text notNull FK cascade -> user.id,
  startTime timestamp notNull, endTime timestamp notNull,
  bookedByGuardianId uuid nullable FK -> guardians.id onDelete set null,
  studentId text nullable FK -> user.id onDelete set null,
  status pgEnum('open','booked','cancelled') default('open') notNull
```
- Teacher creates open slots; parent books one (must be linked to a student the teacher actually teaches — validate via `classTeachers`/`subjectTeachers`).
- `GET/POST /api/academics/meeting-slots`, `POST /api/academics/meeting-slots/:id/book`.

**35.2 — Teacher self-service profile editing**
- `PUT /api/teachers/me` (teacher role, self only — distinct from the existing school_admin-only `PUT /api/teachers`) — editable fields: phone, specialization, bio-style free text; NOT editable: role, employeeId, salary.

**35.3 — Parent multi-child switcher**
- Extend the parent-facing pages (28.6, 32.4 once it exists) with a real child-switcher component reading all of a guardian's real `guardianStudents` links, not just the first/last one.

**35.4 — Guardian self-service password change**
- `POST /api/auth/change-password` (any authenticated role, self only) — current password required, new password checked against 22.3's policy.
- UI: a small account-settings page accessible to all roles including `parent`.

**Verify (whole section):** book a real meeting slot as a parent, confirm the teacher's slot list reflects it as `booked`; edit a teacher's own profile and confirm a school_admin sees the change; link one guardian to two real students and confirm the switcher shows both with correct per-child data; change a parent's own password and confirm re-login requires the new one.

**Phase 5 overall verify:** the full student/parent auth path (already exercised by 28) reused correctly across 35's new surfaces; no cross-guardian or cross-child data leaks.

---

## Phase 6 — 🟡 P2 — Sections 30 + 31: Online Exam Engine & Payment Gateway Sandbox

**Why sixth:** both genuinely valuable but more isolated (exam engine doesn't block anything else; payment gateway is explicitly sandbox-only per the user's decision, not production-blocking) and both carry real external-research dependency (exam anti-cheat design, CMI vs Payzone API choice) — sequence after the higher-certainty phases.

### Section 30 — Online exam / MCQ engine

**30.1 — Schema**
```
onlineExams: id uuid pk, tenantId uuid notNull FK cascade,
  classSubjectId uuid notNull FK cascade -> classSubjects.id,
  title varchar(255) notNull, durationMinutes integer notNull,
  totalMarks numeric(5,2) notNull,
  startsAt timestamp notNull, endsAt timestamp notNull,
  createdById text notNull, createdAt timestamp

onlineExamQuestions: id uuid pk, tenantId uuid notNull FK cascade,
  onlineExamId uuid notNull FK cascade, questionText text notNull,
  marks numeric(5,2) notNull, orderIndex integer notNull

onlineExamQuestionOptions: id uuid pk, questionId uuid notNull FK cascade,
  optionText text notNull, isCorrect boolean default(false) notNull

onlineExamAttempts: id uuid pk, tenantId uuid notNull FK cascade,
  onlineExamId uuid notNull FK cascade, studentId text notNull FK cascade -> user.id,
  startedAt timestamp notNull, submittedAt timestamp nullable,
  score numeric(5,2) nullable,
  status pgEnum('in_progress','submitted','graded') default('in_progress') notNull,
  unique(onlineExamId, studentId)

onlineExamAnswers: id uuid pk, attemptId uuid notNull FK cascade,
  questionId uuid notNull FK cascade, selectedOptionId uuid nullable FK
```
Migration `0025`.

**30.2 — Exam/question builder route + UI**
- `POST/PUT/DELETE /api/academics/online-exams` + nested `/api/academics/online-exams/:id/questions` (teacher, school_admin) — question builder UI with inline option management, `isCorrect` toggle per option (client never sees which is marked correct once published — strip that field from any GET response a student can hit).

**30.3 — Attempt lifecycle routes**
- `POST /api/academics/online-exams/:id/start` — rejects if `now < startsAt || now > endsAt`, rejects a second attempt (unique constraint backs this), creates the attempt row with `startedAt = now`.
- `POST /api/academics/online-exams/:id/answer` — upserts one `onlineExamAnswers` row per question, allows resuming (idempotent per question).
- `POST /api/academics/online-exams/:id/submit` — computes `score` server-side by comparing `selectedOptionId` against each question's real `isCorrect` option, sums `marks` for correct answers, sets `status: 'graded'` immediately (auto-grade, no manual step for pure-MCQ).

**30.4 — Server-side auto-submit on timeout**
- Since there's no background job runner in this app yet, implement as: on any subsequent read of an `in_progress` attempt past `startsAt + durationMinutes` (or past `endsAt`), auto-finalize it server-side at that read time rather than relying on a cron — document this as "lazy timeout enforcement," a real and correct pattern for this app's current infra, not a hack.

**30.5 — Grading-engine integration**
- Add `sourceType: pgEnum('manual','online_exam').default('manual')` to the existing `assessmentResults` table (small migration) OR insert a real `assessmentResults` row on exam submission pointing at a synthetic `assessments` row created for the exam — prefer the latter (reuses 100% of the existing `class-results`/roster grade-averaging code with zero special-casing) over adding a new discriminator column everywhere. Decide and document which approach during implementation, don't leave it ambiguous.

**30.6 — Anti-cheating basics**
- One attempt per student (unique constraint, already in 30.1).
- Correct answers never exposed to the student's own results view until `now > endsAt` for the whole exam (not just their own submission) — prevents an early finisher from leaking answers to classmates still taking it.

**30.7 — Student-taking UI**
- `dashboard/exams/[id]/take/page.tsx` (student/parent-visible-on-behalf-of-child, same auth pattern as Phase 5) — timer UI reflecting the server-enforced window, one-question-at-a-time or single-page, autosave per answer via 30.3's idempotent endpoint.

**30.8 — Results review UI**
- Student-facing (post-window only, per 30.6); teacher-facing real-time monitoring (`dashboard/academics/online-exams/[id]/monitor` — who's started, who's submitted, live count).

**30.9 — Verify (whole section)**
- Build a real 5-question exam, take it as a student within the window, confirm auto-grading matches manual verification, confirm a second attempt is rejected, confirm the score appears in `class-results` alongside manually-entered grades, confirm access is rejected before `startsAt` and after `endsAt`, confirm correct answers aren't visible to a student who finishes early while others are still taking it.

### Section 31 — Fee payment gateway (CMI/Payzone sandbox)

**31.1 — Provider research spike (do first, before any code)**
- Compare CMI (Centre Monétique Interbancaire — the Moroccan interbank standard) vs. Payzone sandbox APIs: auth model, webhook signature scheme, sandbox test-card behavior, documentation quality. Recommend CMI as the default target audience for a Moroccan school SaaS, but confirm sandbox access is actually obtainable before committing — this is a real external dependency, not guaranteed to be frictionless.

**31.2 — Schema**
```
paymentTransactions: id uuid pk, tenantId uuid notNull FK cascade,
  invoiceId uuid notNull FK cascade -> invoices.id,
  provider varchar(50) notNull, providerTransactionId varchar(255),
  amount doublePrecision notNull,
  status pgEnum('pending','succeeded','failed','refunded') default('pending') notNull,
  createdAt, updatedAt timestamps
```
Migration `0026`. Deliberately separate from the existing `payments` table — gateway transactions have a pending→confirmed lifecycle the existing manual-entry table was never designed for.

**31.3 — Checkout-initiation route**
- `POST /api/finance/invoices/:id/pay` (parent role, own child's invoice only — validate via `guardianStudents`; also school_admin for in-person-assisted payment) — creates a `pending` `paymentTransactions` row, calls the provider's sandbox API to create a checkout session, returns the redirect URL.

**31.4 — Webhook handler**
- `POST /api/finance/webhooks/{provider}` — **verifies the provider's signature before trusting the payload** (this is the single highest-risk new endpoint in this phase — an unverified webhook is a direct path to fabricating "paid" invoices). On verified success: update `paymentTransactions.status = 'succeeded'`, insert a real row into the existing `payments` table (reuse existing invoice-balance-update logic from Section 7, don't duplicate it), `recordAudit()`.
- On verified failure: `status = 'failed'`, no `payments` row.

**31.5 — Guardian-facing "pay online" UI**
- On the existing invoice-detail page, when accessed by a `parent` role with a balance due: a real "Payer en ligne" button triggering 31.3, redirect to the provider's real sandbox checkout, return to a confirmation page polling `paymentTransactions.status`.

**31.6 — Credential-swap runbook**
- `docs/payment-gateway-runbook.md` — exact env vars, webhook URL registration steps, sandbox-to-production checklist. Written for someone with zero session context, since this is the task most likely to be picked up cold later.

**Verify (whole section):** complete one real sandbox payment end to end (checkout → webhook → real `payments` row → invoice balance updates on the real invoice-detail page); confirm a declined sandbox payment does NOT create a `payments` row; confirm the webhook endpoint rejects a forged/unsigned request with the correct HTTP status, not a silent 200.

**Phase 6 overall verify:** both sections' external-dependency risk (anti-cheat design, provider signature verification) specifically re-reviewed before marking done, not just the happy path.

---

## Phase 7 — 🟡 P2 — Sections 32 + 33: Timetable Polish & Analytics Enhancements

**Why seventh:** genuinely valuable but purely additive on top of already-real data (Section 20's scheduling, the grading engine) — no new schema risk, no new auth surface, safe to do later without blocking anything.

### Section 32 — Timetable/scheduling polish

**32.1 — Real per-teacher workload chart**
- File: `src/features/teachers/ui/teachers-manage-view.tsx` (the chart deliberately deleted in Section 13 for lack of data). Now compute real weekly hours from `classScheduleSlots` grouped by `teacherId` (sum `endTime - startTime` per slot, group by day) — replace the removed bar chart with this real one.

**32.2 — Teacher's personal schedule view**
- `dashboard/teachers/my-schedule/page.tsx` (teacher role) or a tab on the existing teacher profile page — `GET /api/academics/timetable-slots?teacherId=` (extend the existing route's filter support, currently only `classSectionId`).

**32.3 — Printable timetable**
- Reuse the exact Section 13 `window.print()` pattern (no new PDF library) on both `academics/schedule` (per class-section) and the new 32.2 teacher view.

**32.4 — Student/parent "my class schedule"**
- `dashboard/my-schedule/page.tsx` (student/parent role, part of the same portal-nav work started in Phase 5) — real filtered `classScheduleSlots` by the student's own `classSectionId`.

**32.5 — Room-utilization view**
- New small aggregate: `GET /api/academics/room-utilization` — real busy/idle breakdown by `roomLabel` across all `classScheduleSlots`, tenant-scoped.

**32.6 — Bulk timetable copy**
- `POST /api/academics/timetable-slots/copy` — body `{fromClassSectionId, toClassSectionId}` or `{fromTermId, toTermId}` (whichever term/semester model applies — check `semesters`/`sessionYears` tables for the right dimension) — bulk-duplicates real slots.

**Verify (whole section):** confirm the workload chart sum matches a manual calculation from real `classScheduleSlots`; confirm a student only ever sees their own section's schedule; confirm bulk-copy produces the exact same conflict-detection results as manually re-entering the same slots (run Section 20's conflict route before and after, compare).

### Section 33 — Analytics & reporting enhancements

**33.1 — Real grade-distribution analytics**
- Extend `GET /api/analytics` (dropped in the original route for lack of real data) — now real via `assessmentResults`: distribution across Moroccan mention bands, real trend over time.

**33.2 — Accounts-receivable aging report**
- Extend `GET /api/finance/reports` with 30/60/90-day overdue-invoice buckets (real, computed from `invoices.dueDate` vs today).

**33.3 — Homework/exam participation analytics**
- Extend `GET /api/analytics` with real completion/participation rates from Phase 5/6's `assignmentSubmissions`/`onlineExamAttempts` — build this task only after Phase 5/6 actually ship (hard dependency, note it explicitly in section-index tracking).

**33.4 — Shared CSV export helper**
- `src/libs/csv-export.ts` — one client-side `exportToCsv(rows, filename)` helper; retrofit onto every table page that currently lacks export (audit which ones do first, don't assume).

**33.5 — Dashboard-home real-data refresh**
- `dashboard-view.tsx`'s "Notes récentes" and timetable-preview cards (currently honest empty states) — now real, since grading (Sections 9/14) and scheduling (Section 20) both exist.

**Verify (whole section):** spot-check 3 exported CSVs against live table data; confirm grade-distribution numbers match a manual tally for a real test class.

**Phase 7 overall verify:** zero new schema, zero new auth surface — pure additive read-side work, verify by comparing every new number against a manual query.

---

## Phase 8 — 🟢 P3 (solo) — Section 34: UX Polish Across Existing Modules

**Why last:** valuable long-term but not blocking anything, no security/compliance/business-funnel stakes — genuinely the lowest-priority tier, correctly sequenced last.

**34.1 — Bulk actions**
- Multi-select + bulk status-change on students directory, staff directory, invoices list — checkbox column + a bulk-action toolbar, calling the existing single-row mutation routes in a loop (no new bulk-specific API needed unless performance testing shows otherwise).

**34.2 — Consistent loading-skeleton states**
- Audit which pages currently show a blank/empty table while fetching vs. a real skeleton; standardize on one shared `<TableSkeleton />` component.

**34.3 — Consistent empty-state design**
- Audit and unify every "no data" message across the app into one shared `<EmptyState icon message />` component.

**34.4 — Mobile-responsiveness pass**
- Manually test the 5 densest pages (invoices, students directory, staff directory, audit logs, teachers manage) at 375px width; fix overflow/truncation issues found.

**34.5 — Accessibility pass on modals**
- Focus-trapping, Escape-to-close, ARIA labels on every `Dialog` usage across the app (grep all `<Dialog` call sites first to get the real count, don't estimate).

**34.6 — Global cross-module search**
- `GET /api/search?q=` — real query across students/teachers/invoices by name/matricule/invoiceNumber, tenant-scoped, returns a small typed result list; header search bar wired to it, replacing the current per-page-only local search.

**Verify:** walk each of the 5 densest pages at 375px width manually; confirm every modal traps focus and closes on Escape; confirm global search returns real cross-module results and respects tenant isolation.

---

## Explicitly out of scope for v2 (backlog, not forgotten)

- **Payroll** — real Moroccan CNSS/tax-specific logic needed; scope as its own project with a compliance reviewer.
- **Lesson planning/syllabus tracking** — already deliberately deferred (`ComingSoonView`); revisit on a concrete requirement, not just reference-project parity.
- **Certificate generation** — bundle with any future PDF-generation work (report-card generator faces the identical "no PDF library yet" decision) rather than solving it twice.
- **Chat/messaging** — no real-time infra (websockets) exists anywhere in this app; Phase 4's announcements-polling approach covers the broadcast need without it.
- **Backup self-serve UI polish** — the ops-level backup/restore in Phase 3 covers the real risk; a polished self-serve UI can wait.
- **Marketing CMS/public website builder** — out of scope for an internal ops platform; Phase 4's public inquiry form (27.9) covers the actual funnel need without a full CMS.
