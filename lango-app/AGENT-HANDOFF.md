# 🚀 SchoolOS Master Project Handoff & Prompt

> **Stale flag (2026-08-03):** this file predates the Phase 2-7 work
> (finance GL, HR/payroll, CRM, portals) landed since 2026-08-02 - e.g. the
> account-lockout gap it describes below is closed. The root `AGENT-HANDOFF.md`
> and `MASTER_ROADMAP_AND_TRACKER.md` also claim canonical status and disagree
> with this file. Don't trust any of them blind - check `git log` and run the
> test suite. Consolidating into one doc is an open task, not done yet.

> **Read this file first, always.** It is the single canonical entry point
> for this project's current state. Everything below "Status as of 2026-07-31
> (second pass)" is historical — kept for provenance, not required reading.
> A full doc index with a one-line status per file is at the bottom.

## ⭐ Status as of 2026-07-31: Dashboard Analytics & Ramom School UI Widgets Shipped

### What shipped this pass
Full dashboard visual & analytics upgrade matching Ramom School reference designs for both School Admin and Super Admin:

- **Metric Strength Grid (`strength-metric-cards.tsx`)**: 4-card blue Total Strength row (Employees, Students, Parents, Teachers) + 4-card red Operational Interval row (Admissions, Invoices/Vouchers, Classes/Transport, Rooms/Sections).
- **Financial Donut (`income-expense-donut.tsx`)**: Recharts Donut chart displaying "Income vs Expense Of [Month]" (Collected vs Remaining).
- **Annual Fee Summary (`annual-fee-summary-chart.tsx`)**: Recharts Area/Line chart for Jan - Dec showing Total Invoiced, Collected, and Remaining.
- **Student Distribution Donut (`student-quantity-donut.tsx`)**: Recharts Donut chart showing student breakdown by level/cycle & branch.
- **Weekly Attendance Inspection (`attendance-inspection-chart.tsx`)**: Recharts Bar Chart comparing Student vs Employee attendance across recent dates.
- **Interactive Calendar (`dashboard-calendar-widget.tsx`)**: Monthly interactive calendar with view controls and event banners (vacations, holidays, exams).
- **Birthday Tracker (`birthday-tracker-widget.tsx`)**: Today's birthday card for students and staff.
- **Super Admin All Branch Dashboard (`/api/super-admin/summary`)**: Cross-tenant aggregated summary backend and UI view (`super-admin-dashboard-view.tsx`).
- **School Admin Single Branch Dashboard (`/api/dashboard/summary`)**: Single-tenant summary backend and UI view (`dashboard-view.tsx`).

---

## ⭐ Status as of 2026-07-31 (previous pass): Attendance module built to spec, one real audit debt outstanding

### What shipped this pass
Full attendance module — planned in `ATTENDANCE-IMPLEMENTATION-PLAN.md`,
completed and live-verified end-to-end (real HTTP, real DB checks, test data
cleaned up after). See `MIGRATION-NOTES.md` for the play-by-play and
`attendance-ui-comparison/` for a mockup-vs-reality gap analysis that drove
the second half of this pass.

- **Foundation**: dropped 3 dead LMS tables (`attendanceRegisters`/
  `attendanceEntries`/`attendanceAuditEvents` — zero writers), migrated
  `attendanceSummary`/`attendanceExcuses`/`attendanceFlags` for real.
- **Flag detection**: `UNJUSTIFIED_ABSENCE`/`CONSECUTIVE_ABSENCE`/
  `REPEATED_LATE`, computed synchronously on write, deduped, with severity
  (Critique/Élevé/Moyen) and staff assignment + internal notes.
- **Event-driven SMS**: log-only (this app's established honest-simulation
  convention — see `smsMessages` schema comment), fires on absence, resolves
  guardian via `guardianStudents` ordered by `isPrimaryContact`.
- **Excuses workspace**: approve/reject with a **mandatory reason on
  reject** (was previously silently unrecorded — real gap, now fixed), real
  PDF/image document upload (tenant-namespaced, served back with correct
  content-type — was previously a bare URL string).
- **Director audit dashboard**: real KPIs, missing-register detection off
  real `classScheduleSlots` (Section 20 dependency).
- **Register lock/reopen lifecycle**: submitting attendance for a
  class+date+period creates and **locks** a register (reference format
  `REG-{date}-P{period}-{classId8}`); further writes 409 until an admin
  reopens with a mandatory reason; resubmit requires a correction note, then
  re-locks. New table `attendanceRegisters`, helper
  `src/libs/api/attendance-registers.ts`.
- **Real QR camera scanning**: `getUserMedia` + `BarcodeDetector`, manual
  matricule entry kept as fallback (previously the "QR scanner" was manual
  entry only, styled to look like a scanner).
- **Student attendance heatmap**: real 31-day grid on the student profile,
  now includes lateness duration in the tooltip.
- **Lateness duration**: `attendance.lateMinutes` — previously "Retard" was
  a bare status label with no duration tracked anywhere.

### One real, pre-existing bug found and fixed
`attendance.studentGroupId`'s foreign key pointed at the dead `studentGroups`
table, but the real browser UI has always sent a `classes.id` there —
**every real attendance save from the actual UI was silently 409ing this
whole session**, undetected because prior live-verification always used
curl payloads that omitted that field. Fixed: FK now points at `classes.id`.
Confirmed live. This is the kind of bug that only surfaces when you test the
actual UI path, not just the API in isolation — worth remembering for future
verification passes.

### Security level: same model as documented in `ARCHITECTURE.md`, one known gap
Every new attendance route follows the established pattern
(`requireRequestContext` → `requireTenant` → Zod `.strict()` → tenant-scoped
query → `recordAudit()` on mutations) and was tenant-isolation-checked.
**One gap carried forward, still open, not touched this pass**: account
lockout is half-built — `user.failedLoginCount`/`lockedUntil` columns exist,
`POST /api/users/unlock` lets an admin manually clear them, but **nothing
increments `failedLoginCount` or sets `lockedUntil` on an actual failed
login** (grepped `src/libs/auth.ts` and the whole `src/app/api/auth` tree —
zero hits, no Better Auth hook wired). First flagged in
`V2-INDEPENDENT-AUDIT.md`; re-confirmed still open on 2026-07-31. This is the
single highest-priority security item outstanding in the app.

### What's still hardcoded / fake — the UX-interactivity plan was written but never executed
`UX-INTERACTIVITY-AUDIT-AND-FIX-PLAN.md` (written 2026-07-31, earlier this
session) diagnosed these; **re-verified on 2026-07-31 that none of them were
ever fixed** — the plan exists but execution never happened:

| Item | File | Verified state |
|---|---|---|
| Global header search | `src/components/shared/header.tsx:78-80` | Input has no `value`/`onChange` — fully decorative on every page |
| Users list pagination | `src/features/auth/ui/users-manage-view.tsx:305` | Still the literal string `"Affichage de 1 à..."`, no `DataTable`, no real paging |
| Fake dead settings page | `src/features/settings/ui/users-roles-view.tsx` | Still exists, still 100% fabricated data, still unreachable (no route renders it) — a landmine if someone wires it up without rebuilding it for real |
| Report card generator | `src/features/academics/ui/report-card-generator-view.tsx` | Zero `fetch()` calls — still fully fake despite real grade data (`assessmentResults`) existing since Section 9 |
| B1-B5 items (dashboard deep-links, invoice download button, pagination on ~10 other tables, super-admin plan filter) | see the plan file | Not re-verified individually this pass — assume still open unless checked |

### Dashboard/analytics polish deliberately deferred (not gaps, just lower ROI)
From `attendance-ui-comparison/00-index.json`: trend deltas, 7-day charts,
"classes with lowest attendance" ranking, an "interventions récentes"
activity feed, a redesigned SMS queue page, a dedicated audit-journal page,
a teacher "today's agenda" landing view, and empty-state visual polish.
These are richness on top of working features, not missing capability —
picked up only if there's specific demand.

### What to do next (priority order)
1. **Account lockout increment logic** (security gap, small, well-scoped —
   wire a Better Auth hook or middleware check on sign-in failure).
2. **Execute `UX-INTERACTIVITY-AUDIT-AND-FIX-PLAN.md`** as written — it was
   never actioned. Start with A2 (users pagination, unblocks the same fix
   for ~10 other tables) then A1 (header search) then A3 (delete the dead
   fake page) then A4 (report cards, biggest single item).
3. Net-new feature work per user request — nothing else is a known gap.

---

## 📌 Project Overview & Identity
- **Project Name**: **SchoolOS** — Moroccan Multi-Tenant K-12 & Language Center Management SaaS
- **Workspace Location**: `c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\lango\lango-english-center-project-fully\lango-app`
- **Tech Stack**: Next.js 16 App Router (Turbopack, i18n French/Arabic/English), Drizzle ORM, PostgreSQL 17 (Docker Compose + Local), Better Auth (Email/Password Authentication), Tailwind CSS v4, Lucide React, Vitest.

---

## 🏆 Completed Achievements (100% Built & Verified)
1. **Database Schema & Multi-Tenancy**: 24+ Drizzle tables (`tenants`, `user`, `session`, `account`, `verification`, `mediums`, `sections`, `classes`, `class_sections`, `subjects`, `class_subjects`, `class_teachers`, `subject_teachers`, `academic_years`, `academic_terms`, `applicants`, `admission_campaigns`, `student_transfers`, `student_promotions`, `attendance`, `assessments`, `grades`, `invoices`, `payments`, `audit_logs`). Multi-tenant row isolation via `tenant_id`.
2. **Academic Structure & Core Engine**: 10 complete UI views (`mediums`, `sections`, `streams`, `shifts`, `semesters`, `classes`, `subjects`, `class-subjects`, `class-teachers`, `academic-calendar`).
3. **Student Lifecycle**: Admissions approval state machine (`/api/students/admissions`), Guardian-Student linking picker (`/api/students/parents/link`), Student transfers (`/api/students/transfers`), Batch promotions (`/api/students/promotions`), Matricules generator (`AAM-2425-XXXX`).
4. **Attendance & Moroccan Grade Engine**: Dual-mode attendance API (`/api/attendance`), `/20` Moroccan Grade Engine (`src/libs/grading/moroccan-grade-engine.ts`), passing 5/5 Vitest unit tests.
5. **Finance & SMS Adapter**: Invoices API (`/api/finance/invoices`), Payments API (`/api/finance/payments`), Moroccan SMS adapter (`src/libs/sms/moroccan-sms-adapter.ts`).
6. **Better Auth & Impeccable Design System Login**: Fixed Drizzle timestamp mode (`mode: 'date'`), built high-contrast editorial login page (`/impeccable` design rules: `#FBF9F5` warm paper, `#111827` dark ink, `#CC8800` amber accent).
7. **Docker Infrastructure**: `docker-compose.yml` with Postgres 17 (port 5432 exposed), Drizzle Migrator (Exit 0), and Production App container.

---

## ⚠️ Current Task & Issues to Resolve

**Note (2026-07-31): Issues 1 and 2 below predate the full-app audit
remediation (see status block above this one) and are superseded -
`sidebar.tsx` now gates `superAdminNavItems` on `userRole === 'super_admin'`
and `dashboard/students/add/page.tsx` renders `StudentAdmissionView` wired to
`POST /api/students/admissions`. Kept here for history; not active blockers.**

### Issue 1: Super Admin Menu Leak in School Admin Session
- **Symptom**: When logged in as a School Director (`y.elamrani@atlas.ma` / `school_admin`), the left sidebar still shows the `PLATEFORME SUPER ADMIN` menu block (`Tableau de bord Super Admin`, `Écoles Clients`, `Abonnements & Tarifs`, etc.).
- **Root Cause**: `Sidebar` defaults to rendering `superAdminNavItems` when client-side session state is unpopulated or in fallback mode, and mock header/sidebar data includes hardcoded super admin badges.

### Issue 2: Student Enrollment Route (`/fr/dashboard/students/add`)
- **Symptom**: Clicking `+ Inscrire un élève` or Quick Actions needs to load the dedicated 4-step `StudentAdmissionView` wizard without conflicting with dynamic route `[id]`.

---

## ✅ Status as of 2026-07-31: Full-app audit remediation complete

The full-app audit (`~/.claude/plans/whimsical-painting-turtle.md`, 12
sections) is done and live-verified end-to-end via real HTTP - not just
typecheck/build. Full detail per section is in `MIGRATION-NOTES.md` ("Full-app
audit remediation" + "Sections 8-12" entries). Summary:

- **Sections 1-7** (security fixes, miswiring, dead-code removal, wiring
  already-real APIs, students/teachers/finance/attendance/analytics backends):
  done in an earlier pass this session.
- **Sections 8-12** (super-admin schools+plan-tier, assessment/grading engine,
  optional-subjects elective groups, log-only SMS, real photo storage): done
  this pass. All five live-verified: real create/read/update round-trips,
  tenant isolation (Atlas vs. Lango vs. a freshly-created test tenant), and
  role-based `403`s where expected.
- **One real infra bug found & fixed mid-verification**: the `migrate`
  service builds a separate Docker image from `app` (same Dockerfile,
  different `target`) with its own build cache - `docker compose build app`
  does not rebuild it. Migrations `0012`-`0015` sat unapplied in the live DB
  for a while despite `migrate` reporting success, because it was running a
  stale cached image. Full root-cause + fix in `MIGRATION-NOTES.md`. Anyone
  adding a new migration must `docker compose build migrate` explicitly, not
  just `docker compose build app`.
- Deferred/out of scope by explicit user decision, not oversight: SMS sending
  never calls a real carrier (log-only, banner-flagged in the UI); super-admin
  has no billing/invoicing/usage-metering; student photos are local-disk
  (Docker volume), not S3.

---

## ✅ Status as of 2026-07-31 (second pass): remaining hardcoded/mock data closed

A second, independent deep audit found 18 more pages still hardcoded or
partial after the first 12-section pass, plus two gaps that pass missed
entirely (admission-wizard document upload, teacher photo upload). Plan:
`~/.claude/plans/whimsical-painting-turtle.md` ("Second-pass remediation").
Done and live-verified end-to-end via real HTTP, including two flows
verified with actual authentication working (a freshly-created parent
account really logging in with its generated temp password; a real
double-booked-teacher conflict actually being detected and then clearing
once resolved). Full detail per section in `MIGRATION-NOTES.md` ("Sections
13-20").

Summary: Sections 13-19 were mostly wiring already-real backends or small
additive schema (student documents, access-reset, finance reports, school
settings extensions). Section 20 (timetable/scheduling + conflict
detection) was the large one - the pre-existing `timetableSlots`/`rooms`
tables turned out to be dead LMS boilerplate (same class of issue as
`courses`/`programs` elsewhere), so a clean `classScheduleSlots` table was
added instead of resurrecting 4 more dead tables.

Two pages were found mid-pass that weren't in the approved plan
(`settings/attendance`, `settings/cndp`) - rather than silently expanding
scope, both got the honest "coming soon" placeholder treatment instead of a
half-real rebuild. `cndp-view.tsx` in particular was flagged as higher-risk
than ordinary mock data: it asserted a specific, fabricated CNDP Law 09-08
compliance filing reference and date, not just a fake number on a chart.

No known open gaps remain from either audit pass. Next work is net-new
feature requests, not remediation.

---

## 📚 Full documentation index (28 files at repo root, 2026-07-31)

**Live / keep reading:**

| File | Purpose |
|---|---|
| `AGENT-HANDOFF.md` | This file — canonical current-state entry point |
| `ARCHITECTURE.md` | Multi-tenant security model, query-scoping rules, teacher-scoping, file-storage pattern — still accurate, read before writing any API route |
| `CLAUDE.md` | Project-specific agent rules (module index, command rules) |
| `CHANGELOG.md` | Real project changes now logged at the top (Keep-a-Changelog style); old boilerplate release history kept below for provenance, not relevant to this project |
| `MIGRATION-NOTES.md` | Every migration this session, in order, with root-cause writeups for the two Docker build-cache incidents and the drizzle snapshot-desync incident — read before touching migrations |
| `attendance-ui-comparison/` (dir) | 14 JSON files + index comparing product mockups to the real attendance module, per-page gap lists with priority/effort |
| `future-implementation/` (dir) | Specced-but-not-started features, one subfolder each. Read before assuming a feature doesn't exist as a requirement just because there's no code for it. `subscription-licensing/` — SchoolOS as a licensed SaaS with per-addon activation, sold across Morocco and internationally (big, genuinely deferred). `two-factor-authentication/` — TOTP/backup-codes/trust-device login hardening; turned out cheap since Better Auth already ships an official `two-factor` plugin, but deliberately deferred too (decided 2026-08-01) — pick up whenever it's wanted, not blocked on anything. `inventory-management/` — product catalog/suppliers/purchases/school-shop sales/equipment loans, genuinely new scope (no existing schema overlap), listed as a candidate in `src/addons/registry.ts`. `human-resources-employee-management/` — advanced HR addon: departments, designations, rich employee profiles, employment lifecycle/offboarding, HR documents, and workforce reporting. The app already has real tenant-scoped staff accounts and a basic roster, so the plan explicitly keeps basic accounts/roles/login deactivation/teacher management in core and places only the employment/organization layer behind the addon. `card-and-admit-card-management/` — visual template designer plus student/employee ID cards and physical-exam admit cards, including secure QR verification, immutable template versions, issue/reprint/revoke lifecycle, asynchronous bulk jobs, and print-sheet/duplex logic. The plan selects MIT-licensed `pdfme` as the primary technical reference, with LibreBadge and ID-Cards-Generator as inspiration only; it also documents the missing physical exam candidate/room/seat model. `certificate-management/` — student/employee certificate definitions, evidence-based eligibility, request/approval, visual templates, immutable issuance, bulk jobs, delivery, correction/replacement/revocation, and secure public verification. It reuses a neutral pdfme document engine but is independently licensed from Card Management. The legacy `certificates` table is explicitly not a foundation because it points into the dead LMS course chain. Open Badges 3.0 is a future interoperability reference; blockchain is deliberately excluded from v1. `custom-domain/` — per-school branded URLs; follow-on to `subscription-licensing/` (needs plan-tier gating to exist first), needs real routing/DNS/SSL infra work, not just a new page — this app currently has zero domain-based routing (verified in `src/middleware.ts`). `school-website-cms/` — per-school public marketing site (pages/menu/gallery/news/theme colors), also meant to eventually power SchoolOS's own `(marketing)` site; biggest of the four so far — explicitly recommends fixed page types over a generic page-builder to keep scope bounded. Third in the `subscription-licensing` → `custom-domain` → `school-website-cms` sequence. `lead-crm-and-broadcast-messaging/` — **the CRM half is unusually far along**: real `inquiries`/`inquiryFollowUps` schema, real public lead-capture endpoint (rate-limited + bot-protected), real convert-to-student logic already exist — only the admin UI is missing. The broadcast-messaging half (WhatsApp/Telegram/Messenger/Email) is genuinely 0% built, no email infra exists at all. Read before assuming inquiries/CRM don't exist — the backend is real, just invisible. `admission-and-student-model/` — **different from the others: gaps in core, already-shipped functionality**, not a new addon. The admission wizard's document-upload step is decorative (no upload code at all), no student login gets created on approval, and guardian info is flat duplicate text instead of a real link. Also explicitly lists reference-product fields (Caste, Category/quota, Religion-as-default, "State") that were deliberately excluded as inapplicable to a Moroccan context — read the reasoning before assuming they were just missed. |
| `future-implementation/payroll-and-workforce-operations/` | Separate `payroll-workforce` addon: Morocco-first effective-dated payroll rules, salary components/structures/assignments, deterministic pay runs, payslips, posting/payment/reconciliation, salary advances, employee leave policies/balances/requests, and awards. It depends technically on the Human Resources employee-profile foundation and must not reuse student leave or the generic deletable salary expense as payroll. Frappe HR/OCA are GPL/AGPL inspiration only; MIT Payroll Engine informs versioned rule/trace architecture. Official DGI/MEF, Labour Code, and CNSS/DAMANCOM sources plus professional validation are mandatory before production. |
| `future-implementation/academic-management-enhancement/` | Core Academic hardening plan based on the RamomSchool comparison. Lango already has real classes/sections, class and subject teacher assignments, class-subject curriculum, timetable CRUD/conflicts, and batch promotion. Remaining work is session-scoped class offerings and assignments, teacher schedule as a projection of the published class timetable, timetable version/publish and write-time integrity, assignment history/roles, and a real student placement/promotion ledger. This is deliberately core, not an addon, and must extend the active ESchool-aligned model rather than the deprecated LMS `courses`/`studentGroups`/`timetableSlots` chain. |
| `future-implementation/live-classrooms/` | Separate `live-classrooms` addon for virtual-class scheduling, provider-neutral secure joins, immutable provider events, attendance reconciliation, recordings, and operational/participation reports. BigBlueButton is the recommended education-first provider; LiveKit and Jitsi are documented alternatives. It must not reuse guardian appointment `meetingSlots`, and it must never build its own WebRTC media server. |
| `future-implementation/attachments-book/` | Separate `attachments-book` addon for a reusable academic resource library: attachment taxonomy, class/subject audiences, versioning, resumable quarantine-first uploads, malware scanning, previews/extraction, quotas, reuse backlinks, and analytics. Uppy + tusd is the recommended upload path with a Lango-owned BlobStore abstraction. It must not reuse deprecated `courseAttachments`, and core administrative documents and assignment submissions remain independent. |
| `future-implementation/assessment-and-examination/` | Master plan for Homework/Evaluation Reports and Exam Master as core Academics, plus `online-examinations` as a separately gated addon. Lango already has partial assignment, assessment/result, Moroccan grading, report-card, and MCQ attempt tables/APIs; the plan first closes confirmed authorization, real-file, timing, relational-validation, transaction and answer-key exposure gaps, then adds terms/halls/distribution/schedules/marksheets/moderation/publication, versioned question banks/forms, resilient attempt delivery and QTI 3 portability. All delivery modes post to one shared assessment outcome ledger; the addon never creates a second gradebook. |
| `future-implementation/hostel-management/` | Separate `hostel` addon covering hostel/building/zone/category/room/bed inventory, capacity-safe effective-dated allocation, check-in/out/transfer, nightly roll call, leave/return, visitors, welfare/incidents, inspections, maintenance, charges and reports. Current occupancy is derived from immutable allocation history. OpenEduCat/ERPNext/Gibbon are inspiration only; the domain should be native to Lango and safeguarding/privacy access is mandatory. |
| `future-implementation/student-transport/` | Separate `transport` addon covering versioned routes/stops/service calendars, vehicles/crew/compliance, segment-capacity student allocations, daily trips, QR/NFC/manual rider events, live GPS/ETA/geofences, guardian-safe tracking, incidents/replacement, maintenance and analytics. Recommended architecture is MapLibre UI + separately deployed Traccar telemetry + routing adapter backed by Valhalla/managed service, with optional transparent OR-Tools suggestions. Lango remains authoritative for school transport operations. |
| `future-implementation/attendance-qr-enhancement/` | Core Attendance hardening plan for the already-existing camera QR intake. Replaces raw ID/partial-name matching with opaque revocable badge credentials, registered scanner devices/sessions, immutable accepted/rejected scan evidence, server idempotency, roster/register validation, reports and optional offline reconciliation. Provisional defaults pending user confirmation: teacher/kiosk scans individual badges; student scans stage into the existing register before teacher submit/lock; employee In/Out shares scanning infrastructure but writes a separate Payroll/Workforce ledger. |

**Historical — task complete, kept for context, not action items:**

| File | What it was |
|---|---|
| `V2-ROADMAP.md`, `V2-AGENT-KICKOFF-PROMPT.md` | The V2 roadmap and its kickoff prompt — executed |
| `V2-PHASE-1-REPORT.md` … `V2-PHASE-7-REPORT.md` | Per-phase completion reports for the V2 roadmap |
| `V2-FULL-AUDIT-HANDOFF-REPORT.md`, `V2-INDEPENDENT-AUDIT.md` | Independent verification of V2 completion claims — found the account-lockout gap (still open, see status section above) and a test-harness bug (fixed) |
| `V2-MANUAL-TESTING-GUIDE.md` | Manual test scripts for V2 features |
| `ATTENDANCE-PROMPT-REVIEW.md` | Critical review of an external "master handoff prompt" for attendance work — found 2 path errors and the missing-migration gap before anyone acted on it |
| `ATTENDANCE-AGENT-KICKOFF-PROMPT.md` | Corrected kickoff prompt from that review — superseded by `ATTENDANCE-IMPLEMENTATION-PLAN.md` |
| `ATTENDANCE-IMPLEMENTATION-PLAN.md` | The actual attendance build plan — executed, see status section above |
| `ATTENDANCE-COMPLETION-REPORT.md` | Completion report for the first attendance pass (before the register-lifecycle/QR/document-upload follow-up work) |
| `UX-INTERACTIVITY-AUDIT-AND-FIX-PLAN.md` | **Not historical — still an open action item.** Diagnosed real hardcoded/dead-UI gaps, never executed. See "What's still hardcoded" above. |
| `SERVER_SETUP_AGENT_PROMPT.md` | Server/deployment setup instructions |
| `findings.md`, `progress.md`, `task_plan.md`, `rbac-and-route-fix-plan.md`, `users-students-plan.md`, `sms-build-plan.md` | Earlier-session scratch/planning files (2026-07-29–30) — superseded by the V2 and attendance passes above; kept for history, don't treat as current |
| `README.md` | Boilerplate README from the original `SaaS-Boilerplate` template this project was forked from — not project-specific, not maintained |
# Future implementation note: QR attendance enhancement

See `future-implementation/attendance-qr-enhancement/ATTENDANCE-QR-ENHANCEMENT-PLAN.md`. It replaces raw-ID/partial-name matching with opaque revocable badges, paired devices, scanner sessions, immutable evidence, idempotency, roster/register validation, audit reports, and optional later offline support. Provisional defaults are teacher/kiosk badge scanning and stage-then-submit; employee in/out remains a separate Payroll/Workforce ledger.
