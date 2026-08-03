# Migration notes: stopgap columns

Columns added to real domain tables purely to carry fields the API contract already
returns, because the "correct" relational model for them either didn't exist yet or
the UI can't yet supply the data needed to populate it safely. Each one has a real
home to move to - listed below - once its blocking condition is resolved.

## `user` table (migration `0002_extend_user_for_students_api`)

`matricule`, `payment_status` model *student* concerns but live on the shared
`user` table (students are `user` rows with `role = 'student'`). `qualification`,
`salary`, `last_login` are staff concerns on the same table. These have no FK model
that applies to them and stay as-is.

`level`/`class_name` are **DEPRECATED** as of migration `0007_add_academic_structure`
- superseded by `user.class_section_id` (a real FK into `class_sections`). Kept,
  nullable, as a read-only fallback: `src/app/api/students/route.ts` displays them
  only when `classSectionId` is null (i.e. for students placed before this
  migration, or never placed at all). Nothing writes to them anymore.
- Drop when: an audit confirms every active student has `classSectionId` set
  (needs the admissions/enrollment UI to let admins place remaining students first).

## `guardians` table (migration TBD - added alongside the students/parents route)

`defaultRelation` carries what the UI displays as a single "relation" per guardian
(e.g. "Père"). The correct model already exists: `guardian_students.relationship_type`
is per guardian-student *link*, since one guardian can relate differently to
different children. `defaultRelation` is a fallback shown only when a guardian has
no real links yet.

- Move when: guardians are created through a flow that also creates real
  `guardian_students` rows (a student picker, not free text) - part of the
  admissions/enrollment slice. At that point `defaultRelation` becomes unused and
  can be dropped.

## Known gap: guardian-student linking

`src/app/api/students/parents/route.ts` intentionally does **not** write to
`guardian_students` from the free-text `linkedStudents` field the current UI sends -
matching by typed name against `user.name` is not reliable (names are not unique)
and would risk linking a guardian to the wrong child. `linkedStudents` in API
responses reflects only real `guardian_students` rows, which today is none for
guardians created through the current UI - it will read as empty until a real
student-picker + linking endpoint exists (planned as part of admissions/enrollment).

## `user` table (migration `0006_add_teacher_fields_to_user`)

`employeeId`, `specialization`, `cycle`, `hireDate`, `documents` are teacher
concerns on the shared `user` table (teachers are `user` rows with `role =
'teacher'`). `documents` is a single jsonb `{ contract, cin, diploma }` rather than
three columns, since it is read/written as one unit and never queried by individual
key. These have no FK model that applies to them and stay as-is. `workloadHours`
also stays manual - computing it needs real timetable data (a separate, not-yet-built
Phase 4 concern), not something the academic structure below provides.

`subjects`/`assignedClasses` are **DEPRECATED** as of migration
`0007_add_academic_structure` - superseded by the real `classTeachers`/
`subjectTeachers` join tables. Kept, nullable, as a read-only fallback:
`src/app/api/teachers/route.ts` only falls back to these `varchar[]` columns when
a teacher has zero rows in the new join tables. Nothing writes to them anymore -
assignment now goes exclusively through `POST /api/academics/class-teachers` and
`/api/academics/subject-teachers`.

- Drop when: an audit confirms every active teacher has real join-table rows
  instead of relying on the fallback.

## Academic structure (migration `0007_add_academic_structure`)

Added the ESchool-aligned tables `sessionYears`, `semesters`, `mediums`,
`sections`, `streams`, `shifts`, `classes`, `classSections`, `subjects`,
`classSubjects`, `classTeachers`, `subjectTeachers`, plus `user.classSectionId`.
See the repo's Plan doc (`ESchool-Aligned Academic Structure`) for the full design
rationale. Key points not to relitigate:

- `mediums`/`sections`/`streams`/`shifts`/`semesters`/`sessionYears` are plain
  tenant-scoped tables, not enums - schools configure their own, matching
  `PRODUCT-TRUTH.md`'s "configurable per school" requirement.
- The pre-existing `academicYears`/`academicTerms`/`programs`/`courses`/
  `studentGroups`/`programEnrollments`/`courseEnrollments`/`timetableSlots`/`rooms`
  tables are **not** used by this structure and remain dead/orphaned schema (leftover
  from the original "saas-boilerplate" template, nothing in `src/` reads or writes
  them) - do not build on them.
- `classSections.mediumId` is always derived server-side from `classId`, never
  accepted from the client (`src/app/api/academics/class-sections/route.ts`).
- No DB-level unique constraint on `classSubjects` (classId, subjectId,
  semesterId) - a nullable `semesterId` has NULL-distinctness semantics that would
  let duplicate whole-year rows through anyway. Duplicate prevention is at the API
  layer, scoped per semester (a class can legitimately have the same subject
  assigned separately per semester).
- `classTeachers`/`subjectTeachers` have no PUT route - reassignment is delete +
  recreate, since they're pure join records.

## Full-app audit remediation (2026-07-30, see `FULL-APP-AUDIT.md` at repo root)

Sections 1-3 of the remediation plan (`~/.claude/plans/whimsical-painting-turtle.md`)
are done and live-verified. Notable schema/route changes:

- **`schoolSettings` table added (migration `0011`)** - one row per tenant,
  unique on `tenantId`. Replaces a `let memorySettings` module-level object in
  `src/app/api/settings/route.ts` that was shared across every tenant in the
  process (unauthenticated cross-tenant read/write - see audit Section 1.2).
  `POST` upserts via `onConflictDoUpdate` on `tenantId`.
- **`/api/students/photos`, `/api/settings`, `/api/settings/access-reset`** now
  all require `requireRequestContext`/`requireTenant` - previously had zero
  auth. `students/photos` still has no real photo-storage backend (returns an
  empty/real-shaped response, not mock data) - that's a separate infra decision
  (Section 5.3 of the plan), not bundled in here.
- **Login page** (`src/app/[locale]/(auth)/login/page.tsx`) now redirects to
  the actual `locale` from the URL instead of a hardcoded `/fr/dashboard`, and
  the demo-credential autofill buttons are gated behind
  `process.env.NODE_ENV !== 'production'`.
- **Sidebar miswiring fixed**: "Bulletins Massar" now points at
  `dashboard/documents/generator` (the real `ReportCardGeneratorView`) instead
  of `dashboard/documents/report-cards` (which rendered the classes manager).
  The "Matières & Program." nav parent was renamed "Matières & Classes" and
  repointed at `dashboard/academics/classes` - `dashboard/academics/programs`
  was a byte-identical duplicate of the classes page and has been deleted.
- **CNDP F211 page fixed**: `dashboard/settings/cndp/page.tsx` was importing
  `SettingsView` (copy-paste bug). The real CNDP content, previously stranded
  in an orphaned dead-tree duplicate, now lives at
  `src/features/settings/ui/cndp-view.tsx` and is imported correctly.
- **Route-collision dead file removed**: `src/app/[locale]/(dashboard)/page.tsx`
  and `src/app/[locale]/page.tsx` both resolved to the same URL (`(dashboard)`
  is a route group, adds no URL segment); `[locale]/page.tsx`'s redirect always
  won, so the static, fabricated-data "Executive Command Center" page was
  permanently dead code. Deleted.
- **All 14 remaining orphaned dead-tree duplicate pages deleted** (the
  no-`/dashboard`-prefix twins of `students`, `academics/{assessments,classes,
  groups,programs}`, `finance/invoices`, `attendance`, `communication/{reminders,
  templates}`, `documents/report-cards`, `analytics`, `settings`) - confirmed
  zero incoming `Link`/`href` references before deletion, and confirmed the
  URLs 404 post-deploy while the live `dashboard/`-prefixed twins still 200.

**Section 4 done and live-verified** (2026-07-30): wired all 8 pages that had
real, authorized backends sitting unused behind static UI - finance invoices
list, payment entry, attendance, student transfers, admissions kanban,
access-reset, promotions, matricules. Notable route changes made to support
this:
- `GET /api/finance/invoices` now enriches rows with `className`/`sectionName`
  (left-join `classSections`/`classes`/`sections`) and a resolved primary
  `guardianName` (one extra batched query, not N+1 - same pattern as
  `/api/dashboard/summary`).
- `GET /api/finance/payments` added (previously POST-only) - lists recent
  payments joined to student/invoice.
- `GET /api/academics/class-sections` now returns `className`/`sectionName`
  alongside the raw IDs.
- `GET /api/students` gained a `classSectionId` query param (exact section,
  vs. the existing `classId` which spans all sections of a class) and its
  `GET`/`GET /api/academics/classes` now allow `teacher` in addition to
  `school_admin` - both were `school_admin`-only despite `/api/attendance`
  already allowing teachers, which would have made the attendance page
  unusable for the role it's built for.
- `promotions-view.tsx`/`matricules-view.tsx`/`admission-requests-view.tsx`
  were significantly simplified from their original fully-fictional UI (fake
  grades/rankings/workflow/doublon-detection/source-funnel-charts) down to
  what the real backend actually supports - a single-shot batch class
  promotion, a naming-series "next matricule" generator (note: its GET has a
  side effect - it increments the series counter - so the UI only calls it on
  explicit button click, never on page load), and a 4-column kanban matching
  the real `applicants.status` enum (`applied`/`in_review`/`approved`/
  `rejected`) instead of an invented 5-stage sales funnel.
- Verified live: full admissions lifecycle (create -> in_review -> approve ->
  real `user` row created), promotions round-trip, tenant isolation on every
  modified/new route (Atlas vs. Lango).

**Section 5 done and live-verified** (2026-07-30): `GET /api/students?id=`
added (student profile page, real detail + joined guardians/attendance-30d/
payments/balanceDue); `POST /api/students/import` added (real CSV import,
resolves free-text class labels against real classSections by name); photos
stayed deferred per the plan (needs a real file-storage decision, not a CRUD
route - Section 1 already closed its auth hole). Both student and teacher
directory tables were missing a link to their own `[id]` profile pages
(confirmed via grep - zero references) - added.

**Section 6 partially done**: `GET /api/teachers?id=` added (real detail +
`classTeachers`-derived assigned classes with real student counts);
`POST /api/teachers/import` replaced the hardcoded `importedCount: 71` stub
with a real CSV import (shares the CSV parser now extracted to
`src/libs/csv.ts` - no new dependency, used by both student and teacher
import views).

**Section 6.1 (assessment creation flow) and 6.4 (optional-subjects) are
explicitly deferred, not built** - both need a real design pass first, same
tier as photos/super-admin, not a quick CRUD add:
- The assessment schema (`gradingScales` -> `assessmentCriteria` ->
  `assessmentPlans` -> `assessmentPlanCriteria` -> `assessments` ->
  `assessmentResults` -> `assessmentResultDetails`) is a full weighted-rubric
  grading engine with zero existing UI, API, or seed data anywhere. More
  importantly: **`assessmentPlans` and `assessments` have no column linking
  them to a class or subject at all** (`assessmentPlans.courseId` points at
  the dead LMS `courses` table, not the real `classSubjects`) - so "which
  class is this assessment for" isn't answerable from the current schema.
  Wiring grade entry needs a schema decision (likely a `classSubjectId` or
  `classSectionId` column added to `assessmentPlans`) before any route can be
  written, not just a missing endpoint.
- Optional-subjects has no dedicated schema at all beyond the existing
  `classSubjectType` enum (`compulsory`/`elective`) already on
  `classSubjects` - what "optional subjects" should actually model (student
  choice, capacity limits, elective groups) needs a real decision, not
  inference from the fully-fake UI that exists today.

**Section 7 mostly done**:
- `/api/finance/expenses` (full CRUD) added against the already-real `expenses`
  table; `expenses-view.tsx` simplified from a fully-fabricated
  vendor/approval-workflow UI (no such concept in the schema - only
  `category`/`amount`/`date`/`description`/`receiptUrl`) down to what's real.
- `/api/finance/fee-structures` (full CRUD) added against `feeStructures`.
  **Note**: `feeStructures.programId` is its only FK and it points at the
  dead LMS `programs` table - there is no real link from a fee structure to
  a class. `pricing-structures-view.tsx` was simplified accordingly (flat
  named pricing plans with an amount, not "per-class structures with
  itemized transport/cantine/discounts/payment-schedule" - none of that has
  schema backing; `feeComponents`/`feeCategories` exist but were left
  unbuilt, itemized-component management is a separate follow-up).
- `GET /api/finance/invoices?id=` added (real detail: student/class/guardian,
  real `invoiceItems` if any exist, real `payments` history). Existing
  invoices have zero `invoiceItems` rows (nothing has ever written to that
  table) - the UI falls back to showing the invoice's flat `amount` as a
  single line when `items` is empty, rather than a blank table.
- `GET /api/analytics` added (new route, reuses `/api/dashboard/summary`'s
  parallel-aggregate-query pattern): real student/teacher/class counts, a
  real 6-month new-enrollment trend (`user.createdAt` grouped by month, since
  there's no separate admission-date field), real 30-day attendance rate,
  and a real invoiced/collected/expenses-by-month series. `analytics-view.tsx`
  dropped the "moyenne générale"/grade-distribution/cycle-segmented
  ("Primaire/Collège/Lycée") sections entirely - grades aren't modeled yet
  (see Section 6.1 note) and `user.cycle` is never populated for students.

**Section 7.5 (communication/SMS) and 7.6 (documents/generator PDF) are
explicitly deferred, not built** - same tier as photos/assessments/
super-admin:
- Communication needs a real schema (templates, send-log) *and* a decision
  on an actual SMS provider/gateway (which one, API keys, cost) before any
  route is meaningful - building fake schema against no chosen provider
  would just be a different flavor of the same "looks done, isn't" problem
  this whole audit was about.
- The report-card generator (`dashboard/documents/generator`) needs real
  grade data to render, which is blocked on the same assessment-schema gap
  as Section 6.1 (no class/subject link on `assessmentPlans`/`assessments`).
  It also needs a PDF-generation approach (no such library installed) -
  another design decision, not a quick add.

**Sections 8-12 done and live-verified end-to-end via real HTTP** (2026-07-31),
closing every remaining item from the plan:

- **Section 8 (super-admin)**: scope is schools + plan tier only, per explicit
  user decision - no payment processing/invoicing/usage metering (would
  duplicate the school-level finance module and still need a real payment
  provider). Added `planTier`/`subscriptionStatus` enums to the existing
  `tenants` table (migration `0013`) rather than a parallel `schools` table.
  New `requireSuperAdmin(context)` helper (`src/libs/api/context.ts`) -
  deliberately skips `requireTenant`, since `super_admin` has `tenantId: null`
  by design and must see every tenant. `POST /api/super-admin/schools` creates
  the tenant's first admin the same way `seed.ts` does: `db.insert(account)`
  with a pre-hashed password (`hashPassword` from `better-auth/crypto`), not
  Better Auth's HTTP signup API. Verified live: list/create/update, a fresh
  tenant's admin can log in and sees zero cross-tenant data, `school_admin`
  gets `403` on these routes.
- **Section 9 (assessments)**: `assessmentPlans.classSubjectId` added
  (migration `0012`, nullable FK -> `classSubjects`, `onDelete cascade`) -
  this was the missing link Section 6.1 flagged as blocking grade entry.
  `POST /api/academics/assessment-plans` lazily find-or-creates a single
  "Standard /20" `gradingScales` row per tenant on first use (no scale-editor
  UI exists, and the FK is `NOT NULL`). New `assessment-sessions` route
  manages the `assessments` table itself (named to avoid colliding with the
  pre-existing `assessments/route.ts`, which was already real and handles
  grade-entry/`assessmentResults` - see Section 6.1's note, that part turned
  out already built). Verified live: plan -> session -> batch grade entry ->
  `assessmentResults` persists with correct Moroccan mentions (`Bien`,
  `Insuffisant`, etc. via `getMoroccanMention`).
- **Section 10 (optional-subjects)**: new `electiveGroups`/
  `electiveGroupSubjects`/`studentElectiveChoices` tables (migration `0014`) -
  models real per-student elective choice, not just the existing
  `classSubjectType = 'elective'` marker (which only said a subject *could* be
  elective, never which students picked what). `studentElectiveChoices` has
  **no DB-level unique constraint** - `maxChoices > 1` must stay legal, so
  enforcement is API-side (count existing choices before insert). Verified
  live: group with 2+ subjects, `maxChoices` rejection on the 2nd choice past
  the limit, tenant isolation.
- **Section 11 (communication/SMS)**: new `smsTemplates`/`smsMessages` tables
  (migration `0015`). Per explicit user decision, `POST
  /api/communication/messages` is a **log-only stub** - it writes a real row
  and marks it `status: 'sent'` immediately, it never calls an external
  carrier (no provider credentials exist yet). The UI
  (`sms-reminders-view.tsx`) shows a visible "Mode simulation" banner so this
  never silently looks like real sending. Verified live: real `smsMessages`
  row with `status='sent'`, tenant isolation on the log.
- **Section 12 (student photos)**: real local-disk storage via a Docker named
  volume (`schoolos_uploads:/app/uploads`), not S3 - works with zero external
  cloud credentials, swappable later. Files are tenant-namespaced on disk
  (`/app/uploads/{tenantId}/{studentId}.{ext}`) so a path-guessing attempt
  can't cross tenants even before the DB check runs. `user.photoUrl` (existing
  column, previously unused) now stores just the filename. Verified live:
  upload, retrieve, a second tenant gets `404` (not another tenant's photo)
  when guessing a valid student ID, and the file survives an `app` container
  restart (volume persistence confirmed, not just assumed).

### Bug found and fixed during Section 8-12 verification: stale `migrate` image

`docker-compose.yml` builds `app` and `migrate` as **separate images** from
the same `Dockerfile` (`migrate` uses `target: migrator`). Rebuilding `app`
(`docker compose build app`) does **not** rebuild `migrate` - they have
independent build caches. Migrations `0012`-`0015` were generated and the
`Schema.ts` code was correct, but `docker compose up -d` ran the *old* cached
`migrate` image (which only had migrations up to `0011` baked into its
`COPY migrations ./migrations` layer), reported "migrations applied
successfully" truthfully - for the 0-11 range it actually had - and silently
left `0012`-`0015` unapplied. Live `INSERT`s then failed with Postgres `42703`
(`column "class_subject_id" of relation "assessment_plans" does not exist`)
despite the schema code and migration files both being correct.

**Root cause confirmed by**: comparing `migrations/meta/_journal.json` (16
entries, `0000`-`0015`) against the live `drizzle.__drizzle_migrations`
tracking table (only 12 rows) - a count mismatch - then confirming via
`docker compose run --rm --entrypoint sh migrate -c "ls /app/migrations"`
that the image genuinely only contained files up to `0011`.

**Fix**: `docker compose build migrate` (foreground) before every
`docker compose up`, whenever new migration files were added since the last
`migrate` build - not just `docker compose build app`. **Lesson for future
sections**: after adding migrations, verify the *migrate* image specifically
picked them up (`docker compose run --rm --entrypoint sh migrate -c "ls
/app/migrations"`), not just that `app` built and migrations *reported*
success - a stale `migrate` image reports success truthfully while silently
skipping the new files.

## Known gap: teacher bulk import

`src/app/api/teachers/import/route.ts` is unchanged - still returns a hardcoded
fake success message and was not wired to `user`. Nothing in the UI calls it
(`teachers-bulk-import-view.tsx` has no fetch to this route either), there is no
xlsx/csv parsing library installed, and there is no defined column-mapping spec.
Making it real is a new file-upload-and-parse feature, not a port of existing logic -
scope it separately when this becomes an active requirement.

## Sections 13-20 (second-pass remediation, 2026-07-31)

A second, independent deep audit (4 parallel research passes reading actual
component/route source, not names) found 18 pages still hardcoded/partial
after Sections 1-12, plus two gaps missed entirely (admission-wizard document
upload, teacher photo upload). Plan: `~/.claude/plans/whimsical-painting-turtle.md`
("Second-pass remediation"). All done and live-verified end-to-end via real
HTTP, including two flows verified with actual authentication (a newly-created
parent account really logging in; a real teacher double-booking conflict
actually being detected).

- **Section 13 (quick wins)**: `syllabus-view.tsx` swapped for the shared
  `ComingSoonView` (moved from `super-admin/ui/coming-soon-view.tsx` to
  `src/components/shared/coming-soon-view.tsx` since it's now used by two
  domains). `staff-view.tsx` wired to the already-real `/api/users` (added
  `employeeId`/`specialization` to its response). `students-list-view.tsx`
  and `teachers-manage-view.tsx` had their `usersMockData`/`studentsMockData`/
  `teachersData` fallback seeds removed entirely (all three mock-data files
  and the now-empty `src/features/{auth,students,teachers}/data/` dirs
  deleted) - `handleCreateStudent` now calls the real
  `/api/students/matricules` reservation endpoint instead of
  `Math.random()`. `teachers-manage-view.tsx`'s documents-compliance donut
  was made real (computed from `documents.contract/cin/diploma` per teacher,
  already-fetched data) instead of deleted like the daily-workload bar chart
  (which had no real per-day backing at all). `finance/invoices` "Nouvelle
  facture" now opens a real create dialog (student search-picker + the
  already-real `POST /api/finance/invoices`); "Download" opens the invoice
  detail page with a real `window.print()` button - no PDF library added.
- **Section 14 (grading-engine wins)**: `calculateMoroccanAverage`/
  `calculateClassRanks` (`src/libs/grading/moroccan-grade-engine.ts`) were
  real and unit-tested but never called from any route - now wired into 3
  new endpoints: `GET /api/academics/class-results?classSubjectId=` (real
  rankings/mentions, `academics/results` page), `GET
  /api/academics/assessment-sessions` extended with `className`/
  `subjectName`/`gradedCount` (re-skinned `academics/evaluations` as a thin
  real list instead of duplicating the assessment concept), and `GET
  /api/academics/classes/roster?id=` (composite: real roster + 30-day
  attendance rate + invoice balance + average grade, joining 4 existing
  tables) for `academics/classes/[id]` - this page was also completely
  unreachable before (zero incoming links anywhere) - added a "Voir la
  fiche" link from `classes-view.tsx`.
- **Section 15 (upload generalization)**: extracted
  `src/libs/api/uploads.ts` (`saveUploadedFile`/`readUploadedFile`/
  `contentTypeFor`) from the student-photos route's inline logic, since the
  same tenant-namespaced-local-disk pattern is now used by 4 routes.
  `POST/GET /api/teachers/photo` mirrors the student one, scoped to
  `role = 'teacher'` (fixed `toApiTeacher`'s `avatarUrl` to build a real
  served URL instead of returning the raw stored filename). New
  `studentDocuments` table (migration `0016`, `documentType` enum:
  photo/birth_certificate/school_certificate/guardian_cni/bulletin) +
  `POST/GET /api/students/documents`. **Course-correction found mid-build**:
  the plan assumed the admission wizard's step 3 could upload these - it
  can't, since `POST /api/students/admissions` only creates an `applicants`
  row, and a real `studentId` (`user.id`) doesn't exist until the kanban's
  approve action converts it. The wizard's existing "Bientôt"-disabled state
  was already honest and correct, left untouched; the real upload UI was
  built into the student profile page's pre-existing "Documents" card
  instead (real `studentId` available there).
- **Section 16 (audit logs)**: `auditLogs` table + `recordAudit()` were
  already real, called from 34 route files - only `GET /api/audit-logs` was
  missing. `school_admin` sees only their tenant's rows, `super_admin` sees
  all (matches the `requireSuperAdmin` carve-out precedent). Dropped the
  mock UI's `ip`/`oldValue`/`newValue`/`severity` columns - no schema home,
  not faked.
- **Section 17 (settings/onboarding)**: added `ice`/`legalStatus`/
  `directorName` columns to `schoolSettings` (migration `0017`). New `POST/GET
  /api/settings/logo` (writes/serves `tenants.logoUrl`, same upload helper).
  `school-onboarding-view.tsx` rewired to load/save real `schoolSettings`
  instead of `defaultValue="Groupe scolaire Atlas"` etc.; its "1248 élèves/42
  classes/87 enseignants" fake stats replaced with real counts from
  `/api/dashboard/summary`. **Two pages found during this section that
  weren't in the approved plan** (`settings/attendance`,
  `settings/cndp`) were swapped for the honest placeholder instead of
  silently expanding scope: `attendance-settings-view.tsx`'s lateness
  threshold/justification rules/teacher permissions/approval workflow/SMS
  alert rules have no schema anywhere; `cndp-view.tsx` asserted a specific
  fabricated CNDP Law 09-08 filing reference/date - not just mock UI data
  but an unverified legal-compliance claim, treated as higher-risk than
  ordinary mock data.
- **Section 18 (access-reset)**: real parent-portal password rotation, not a
  redeemable OTP - this app has no OTP-login flow, only Better Auth
  email/password, so "code" is a real temp password (never persisted in
  plaintext, same as the Section 8 super-admin flow). New
  `accessResetRequests` table (migration `0018`) tracks request
  status/history; `guardians.userId` (pre-existing, nullable, previously
  never populated by anything) is now set on first use - creates a real
  `user`(role=`parent`)+`account` row if the guardian has none yet, otherwise
  rotates the existing account's password. Verified live with actual
  authentication: a freshly-reset guardian account really logs in with the
  generated password.
- **Section 19 (finance reports)**: `GET /api/finance/reports` (same
  parallel-aggregate pattern as `/api/analytics`) replaces 100% hardcoded
  KPIs/charts in `financial-reports-view.tsx`. Multi-campus dropped entirely
  (confirmed via schema grep: `tenants` has no campus/branch sub-entity, one
  tenant is one school).
- **Section 20 (timetable + conflicts, the largest section)**: the
  pre-existing `timetableSlots`/`rooms` tables were confirmed dead LMS
  boilerplate (`studentGroupId` -> `studentGroups` -> `courses`/
  `academicYears`, `roomId` -> `rooms` -> `buildings` - none of that chain
  populated by this app's real model). Rather than resurrecting 4 more dead
  tables, added a clean `classScheduleSlots` table (migration `0019`)
  linking directly to `classSections`/`classSubjects`/`user`, with a plain
  text `roomLabel` (room *management* was out of scope - only conflict
  detection on the label matters). `GET/POST/PUT/DELETE
  /api/academics/timetable-slots` (full CRUD) + `GET
  /api/academics/timetable-conflicts` (real overlap detection: same day +
  overlapping time range + shared teacher/room/class-section - string
  comparison on zero-padded `HH:MM` is safe for chronological ordering, no
  time-parsing needed). `academics/schedule` rebuilt as a real per-class-
  section weekly builder (day-grouped agenda list, not a pixel-grid
  calendar - simpler, still a real functional weekly schedule).
  `academics/conflicts` lists real detected conflicts with a link back to
  the schedule builder. Verified live: created two overlapping slots for the
  same teacher in different sections, confirmed the conflict was detected;
  removed the overlap, confirmed it cleared.

**Bug found and fixed during Section 20 schema design**: none - the dead-table
discovery was caught during design (reading `Schema.ts` before generating the
migration), not live-testing, avoiding a repeat of the Section 8-12 stale-
migrate-image class of issue.

## Phase 7 — Sections 32 + 33 (v2 Timetable Polish & CSV Export, 2026-07-31)

Completed Phase 7 of `V2-ROADMAP.md` (Timetable Polish, Room Utilization & Analytics):
- **Section 32.5**: Built `GET /api/academics/room-utilization` aggregate endpoint.
- **Section 32.6**: Built `POST /api/academics/timetable-slots/copy` bulk duplication endpoint.
- **Section 33.4**: Created shared CSV export utility in `src/libs/csv-export.ts`.

## Attendance module — foundation fix + flags/SMS (2026-07-31, see `ATTENDANCE-IMPLEMENTATION-PLAN.md`)

**Section 1 (schema cleanup):** Deleted `attendanceRegisters`, `attendanceEntries`,
`attendanceAuditEvents` from `Schema.ts`/`Relations.ts` entirely (zero writers
anywhere in the codebase, confirmed by grep; `attendanceRegisters.classId` FK'd
to the dead `studentGroups` LMS table — same class of bug as `timetableSlots
.studentGroupId` in Section 20, resolved the same way: delete rather than patch).
`attendanceFlags.attendanceEntryId` dropped (flags now carry `studentId` + `type`
+ `detectedAt`/`resolvedAt` only — sufficient, no register to point back to).
Kept `attendanceSummary`, `attendanceExcuses`, `attendanceFlags` — all real, now
migrated. Migration `0026_add_attendance_summary_excuses_flags.sql`.

**New bug class found and fixed: drizzle-kit snapshot desync.** `migrations/meta/`
had snapshot files only through `0019_*.json` — migrations `0020` through `0025`
existed as `.sql` files (and were genuinely already applied to the live DB, per
`\dt`) but were never generated through `drizzle-kit generate`, so no matching
snapshot was ever written for them. Running `drizzle-kit generate` for this
section's actual attendance changes therefore diffed against the stale `0019`
snapshot, not real DB state, and produced a `0026` migration that redeclared
~15 already-existing tables/columns/types (`announcements`, `assignments`,
`cndp_filings`, `inquiries`, `meeting_slots`, `online_exams` and their enums,
plus `user.failed_login_count`/`locked_until`/`must_change_password`) alongside
the genuinely new attendance additions. `docker compose up migrate` failed with
`type "assignment_submission_status" already exists`.

**Fix, without hand-writing migration SQL** (a hand-edited migration once
corrupted this project's snapshot chain before — see the incident this note
originally opened with): wrote each of the 83 generated statements into its own
`DO $$ ... EXCEPTION WHEN duplicate_object OR duplicate_table OR duplicate_column
THEN RAISE NOTICE ... END $$` block and ran that against the live DB. Every
statement that hit an "already exists" conflict was a genuine pre-existing
object (verified: none were column-level mismatches, no other error class
appeared) — 6 real new tables/columns applied, ~40 duplicates safely skipped.
Computed the migration file's real sha256 (`crypto.createHash('sha256')` over
the raw `.sql` text, matching `drizzle-orm/migrator.js`'s own hashing) and
inserted it into `drizzle.__drizzle_migrations` so `docker compose up migrate`
now reports `[✓] migrations applied successfully!` cleanly and idempotently on
re-run — confirmed live. **The `migrations/meta/` snapshot gap for 0020-0025
still exists** — the next hand-authored (non-`generate`d) migration in this repo
will hit the same desync and need the same statement-by-statement treatment.
Real fix is to stop hand-authoring `.sql` migrations without a matching
`drizzle-kit generate` pass, not something this section could safely resolve
retroactively without more invasive snapshot surgery.

**Sections 2-3 (flag detection + log-only SMS):** New `src/libs/api/
attendance-flags.ts` — `detectAndRecordFlags()` called from `POST /api/
attendance` right after `recalculateStudentAttendanceSummary`, in the same
transaction. `UNJUSTIFIED_ABSENCE` (absent + no approved excuse for that date),
`CONSECUTIVE_ABSENCE` (3 consecutive non-weekend school days all absent — no
holiday calendar exists anywhere in this app yet, so only weekends are
skipped), `REPEATED_LATE` (>=5 late marks in the calendar month), each deduped
against existing `OPEN` flags. `resolveUnjustifiedAbsenceFlagsForDate()` called
from the excuse-approval `PATCH` — flags carry no date column, so resolution
matches on `detectedAt`'s calendar date against the excuse's date (safe because
flags are always detected synchronously the same day the absence is recorded).
New `GET /api/attendance/flags`. SMS: `POST /api/attendance` resolves the
student's primary guardian via `guardianStudents.isPrimaryContact`, inserts a
real `smsMessages` row (`status: 'sent'` immediately, log-only, same pattern as
every other SMS feature in this app), silently skips if no guardian is linked.

**Live-verified** (Lango tenant, `admin@lango.ma`): marked a real student
absent → real `UNJUSTIFIED_ABSENCE` flag + real SMS log row appeared; submitted
+ approved a real excuse for that date → flag flipped to `RESOLVED`, attendance
rate recalculated correctly; marked a second student absent 3 consecutive real
weekdays → real `CONSECUTIVE_ABSENCE` flag appeared. Confirmed tenant isolation
(Atlas session saw zero Lango flags/excuses). SMS-guardian test required
inserting a temporary guardian/`guardianStudents` link (none exists in seed
data — `guardian_students` has 0 rows app-wide, a pre-existing gap, not part of
this section's scope) — all test data (attendance rows, excuse, flags, SMS row,
temp guardian + link) deleted after verification.

**Sections 4-6 (UI):** `/dashboard/attendance/excuses` (status-tab filtered
excuse review, approve/reject wired to the real `PATCH` route) and
`/dashboard/attendance/audit` (director KPI cards + missing-register queue
with a real "send reminder" action) built and added to the sidebar under a new
"Présence" submenu. `student-attendance-heatmap.tsx` (31-day calendar grid,
new `GET /api/attendance/heatmap?studentId=&month=`) embedded on
`student-profile-view.tsx` alongside the existing 30-day list card. **Section
4.3's document-review drawer**: `attendanceExcuses.documentUrl` is a plain URL
field with no real upload endpoint behind it (confirmed — POST only ever
accepted a URL string, never a file); the excuses view shows the link when
present and "Aucun document" otherwise rather than building a fake upload
button, per this session's honesty convention.

**Section 7 (polish):** Extracted the inline QR modal in `attendance-view.tsx`
into `qr-scanner-modal.tsx` (behavior-identical, pure presentational split).
Confirmed zero remaining references anywhere in `src/` to the deleted
`attendanceMode`/`attendanceRegisterStatus`/`PER_SESSION`/`DAILY` vocabulary —
nothing to clean up. **Skipped 7.2 (auto-save draft)** — the plan itself
flagged this as genuinely optional ("the current single-session batch-submit
flow is honest and functional without it"); not built.

**Live-verified** (Lango tenant): `/dashboard/attendance/excuses`,
`/dashboard/attendance/audit`, `/dashboard/attendance` (post-QR-extraction
regression check), and a real student profile page (heatmap embed) all
return real `200`s post-rebuild. `GET /api/attendance/audit-summary` returns
honest zeros/empty arrays on a clean tenant (no fabricated KPIs). Marked a
real student present/late on two real dates, confirmed
`GET /api/attendance/heatmap` reflected exactly those two records with
correct statuses; test data cleaned up after.

## Attendance module — two follow-up fixes (2026-07-31, same day)

Prompted by a user question cross-checking the attendance module against the
ESchool reference repo and product mockups: two pillars were flagged as gaps
and needed correcting.

**Guardian-student linking was mis-diagnosed as missing — it wasn't.**
`POST/DELETE /api/students/parents/link` and the "Lier un élève" modal in
`parents-guardians-view.tsx` already existed (built in earlier work, found on
closer inspection). The actual gap: newly-created links never set
`isPrimaryContact`, so the attendance SMS resolver (which filtered on
`isPrimaryContact = true`) would never find a real guardian even after a real
link existed. Fixed two ways: (1) `link/route.ts` now defaults a student's
*first* linked guardian to `isPrimaryContact: true`; (2) the SMS resolver in
`attendance/route.ts` now orders by `isPrimaryContact desc` and takes the top
match instead of requiring it, so it's robust to any pre-existing links that
predate this default. Live-verified: created a real guardian, linked via the
real endpoint, confirmed `is_primary_contact = true` in the DB, marked that
student absent, confirmed a real SMS row reached that guardian's phone.

**Lateness duration ("retard") genuinely didn't exist** — `status: 'late'`
was a bare category with no minutes tracked anywhere (the field existed only
on the dead `attendanceEntries` table deleted earlier this session, which had
zero writers even before deletion). Added `attendance.late_minutes`
(nullable integer, migration `0027_add_attendance_late_minutes.sql` — a
single clean `ALTER TABLE` statement, confirming the drizzle snapshot desync
from `0026` is now fixed going forward). Wired: `POST /api/attendance`
accepts optional `lateMinutes` (only stored when `status === 'late'`);
surfaced in `GET /api/attendance`, `GET /api/attendance/heatmap`, and the
student-detail route's `last30Days`. UI: `attendance-view.tsx` shows a
minutes input inline when a student's status is set to "Retard"; the
student-profile 30-day list and the heatmap tooltip both show
"Retard (N min)" when a duration was recorded. Live-verified: marked a real
student late with `lateMinutes: 12`, confirmed it round-tripped through
`GET /api/attendance` unchanged.

Both fixes: `npx tsc --noEmit` clean, `docker compose build app` + `migrate`
both succeeded, migration applied cleanly on the first try (no snapshot
conflicts), all test data cleaned up after verification.





