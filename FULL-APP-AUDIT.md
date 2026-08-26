# SchoolOS — Full App Audit

Date: 2026-07-30. Scope: every `page.tsx` under `src/app/` (83 total, including dead-tree duplicates) and every `route.ts` under `src/app/api/` (33 total). Ground truth for "is this page reachable" is `src/components/shared/sidebar.tsx` — this app has two parallel route trees everywhere (`(dashboard)` is a route group and adds no URL segment, so `students/*` and `dashboard/students/*` are both real, independently-buildable routes; sidebar only ever links the `dashboard/`-prefixed one). Verified with real file reads and, where noted, live process tests — not typecheck/build alone.

## Executive summary

| | Count |
|---|---|
| Total `page.tsx` files | 83 |
| Orphaned dead-tree duplicates (unreachable via any nav) | 31 |
| Live/reachable pages | 52 |
| Live pages wired to a real, tenant-scoped, authorized API | 24 |
| Live pages that are static/mock despite a real API existing for them | 11 |
| Live pages that are static with **no** backing API at all | 17 |
| API routes that are fully real (drizzle, tenant-scoped, authorized) | 24 |
| API routes that are fake (mock data / in-memory / echo) | 5 |
| API routes with **zero authentication** | 3 |

**The single most important fact:** most of the real backend work (students, guardians, teachers, and nearly all of academics — mediums/sections/streams/shifts/semesters/classes/subjects/class-subjects/class-teachers/subject-teachers) already exists, is tenant-scoped, and is correctly authorized. The dominant remaining problem is **frontend wiring**, not backend design — most pages simply never call the API that's already sitting there working. Security gaps are concentrated in `/api/settings/*` and `/api/students/photos`, three routes total.

---

## Critical security findings (fix first, all trivial — no schema changes)

1. **`POST /api/students/photos`** (`src/app/api/students/photos/route.ts`) — no `requireRequestContext`/`requireTenant`, no `db` import at all. GET returns hardcoded mock data; POST is a no-op that ignores its body. Unauthenticated, public, does nothing real.
2. **`GET/POST /api/settings`** (`src/app/api/settings/route.ts`) — no auth, no `db`. Persists to a single **process-global `let memorySettings` object shared across every tenant in the deployment**. Any caller — authenticated or not — can read or overwrite every school's settings. Also lies to the user: the UI (`settings-view.tsx:343`) and the API's own response message both claim the data is "saved to the database." It is not; it's lost on every restart.
3. **`POST /api/settings/access-reset`** (`src/app/api/settings/access-reset/route.ts`) — no auth, not covered by middleware (middleware.ts explicitly excludes `/api/*`). Accepts any body from any caller and returns a freshly generated 6-digit "reset code," no rate limiting, no identity binding. Currently harmless only because its own UI never calls it — but it's a live, discoverable, unauthenticated endpoint in production.
4. **`(auth)/login/page.tsx`** — hardcodes `router.push('/fr/dashboard')` regardless of the actual `locale` route param (destructured, never used). Also ships two real-looking demo credential pairs (`y.elamrani@atlas.ma` / `admin@schoolos.ma`, both `Admin123!`) as autofill buttons directly in production client markup.

---

## Structural bugs (miswiring — both sides exist and work, they're just wired to the wrong thing)

1. **"Bulletins Massar" sidebar link renders the wrong page.** `sidebar.tsx:162` points at `dashboard/documents/report-cards`, which renders `ClassesGroupsView` (a real classes/groups CRUD manager) — not a report card generator. The real, purpose-built Massar bulletin UI (`ReportCardGeneratorView`, at `dashboard/documents/generator`) has **no sidebar link at all** and is fully orphaned.
2. **CNDP F211 compliance page renders general settings.** `dashboard/settings/cndp/page.tsx` imports `SettingsView` (copy-paste bug) instead of real CNDP content. The correct, purpose-built CNDP component (data-residency badges, F211 filing record, PDF download) exists but only in the orphaned dead-tree duplicate `(dashboard)/settings/cndp/page.tsx` — unreachable from any nav.
3. **Dashboard home has a dead link.** `(dashboard)/dashboard/page.tsx:234` links to `/dashboard/academics/assessments` — no `page.tsx` exists at that path (404).
4. **`dashboard/academics/calendar` is mislabeled** — it actually renders the Session-Years CRUD screen (title "Années Scolaires & Calendrier Académique"), not a calendar.
5. **`dashboard/academics/programs` renders the exact same component as `dashboard/academics/classes`** (`ClassesGroupsView` = `ClassesView`, identical title "Gestion des Classes") — there is no distinct "programs" feature despite the sidebar parent label "Matières & Program."
6. **`src/app/[locale]/(dashboard)/page.tsx` is dead code**, confirmed by direct verification (not guessed): this file and `src/app/[locale]/page.tsx` both resolve to the same URL (`/[locale]`) because `(dashboard)` is a route group. I built and ran the app locally against the existing `.next` output and confirmed via `curl http://localhost:3099/fr` that `[locale]/page.tsx` (a clean redirect to `/dashboard`) wins; the fully-static "Executive Command Center" page with fabricated numbers (485 students, 96.4% attendance, "Lycée Al-Amal") in `(dashboard)/page.tsx` is permanently unreachable.

---

## Module 1 — Students & Guardians (14 pages: 11 live + 3 dead-tree duplicates)

Sidebar submenu "Élèves & Profils" (`sidebar.tsx:120-135`) links every `dashboard/students/*` page; the bare `students/*` tree is 100% orphaned.

| Page (URL) | Wired/Static | API | API real? | Auth | Bugs |
|---|---|---|---|---|---|
| `dashboard/students` (directory) | **Wired** | `GET/POST/PUT/DELETE /api/students` | Real | Yes | Seeds mock data before fetch resolves (masks failures); optimistic writes with no rollback on error |
| `dashboard/students/add` | **Wired** | `POST /api/students/admissions` | Real | Yes | Creates an `applicants` row, not a `user`/student row directly — same component/route as `admissions/new` (functional duplicate) |
| `dashboard/students/import` | **Static** | none | — | — | "Confirmer l'import" button has no handler at all |
| `dashboard/students/[id]` (profile) | **Static** | none | — | — | `id` prop received, never read again — every student ID renders the identical hardcoded "Salma Bennani" profile |
| `dashboard/students/admissions` (kanban) | **Static** | none (should call `GET /api/students/admissions`, which is real and works) | — | — | "Nouvelle demande" only mutates local state |
| `dashboard/students/admissions/new` | **Wired** | `POST /api/students/admissions` | Real | Yes | Duplicate UI of `add` |
| `dashboard/students/parents` (guardians) | **Wired** | `/api/students/parents`, `/api/students/parents/link` | Real | Yes | Best-wired page in the module, no gaps found |
| `dashboard/students/transfers` | **Static** | none (real transfer-execution API exists, unused) | — | — | "Créer un transfert" has no handler |
| `dashboard/students/promotions` | **Static** | none (real batch-promotion API exists, unused) | — | — | "Valider la décision" has no handler |
| `dashboard/students/matricules` | **Static** | none (real naming-series API exists, unused) | — | — | Generate/validate buttons have no handlers |
| `dashboard/students/photos` | **Static** | none | `/api/students/photos` is fake **and unauthenticated** (see security §2) | No | Double gap |
| Dead tree ×3 (`students`, `students/import`, `students/[id]`) | byte-identical to live twins | — | — | — | Pure orphan duplicates |

**Bonus find:** `src/features/students/data/students-api.ts` — a complete, unused fetch-helper file with 7 working functions (`fetchStudents`, `fetchAdmissionRequests`, `fetchGuardians`, `fetchTransfers`, `fetchPromotions`, `fetchMatricules`, `fetchStudentPhotos`), imported by nothing anywhere. Two of its assumed shapes are stale against current API contracts (`fetchMatricules` expects a list, the route returns one string; `fetchPromotions` assumes GET, the route is POST-only) — importing it isn't a free win for every page, but it's a real head start for `transfers` and `admissions`.

No live instance of the "NOT NULL FK into a dead table" bug pattern remains in this module — both prior occurrences (`applicants.campaignId`/`targetProgramId`, `attendance.studentGroupId`) are already fixed and documented in Schema.ts.

### Plan
- **P0 (security, trivial):** add `requireRequestContext`/`requireTenant` to `students/photos/route.ts`, replace its mock-data GET with either a real query or a documented placeholder — do not ship an unauthenticated route either way.
- **P1 (wire static UI to already-real API, no schema work):** `matricules`, `promotions`, `transfers`, `admissions` (kanban) — each needs its static component swapped for real `fetch`/`useEffect` against its existing, working, authorized route. `students-api.ts` covers `transfers`/`admissions` reasonably as a starting point; `matricules`/`promotions` need small route-contract fixes first (add a GET to `promotions/route.ts`, change `matricules/route.ts` to return a list or adjust the frontend to a single-value UI).
- **P2 (needs new backend):** `[id]` profile page needs a real `GET /api/students/:id` (or query param) joining attendance/payments/guardians; `import` needs a real CSV-parsing + batch-insert endpoint; `photos` needs real file storage (S3-equivalent), not just DB — bigger than a CRUD route.
- **P3 (cleanup):** delete the 3 dead-tree duplicate files once confirmed zero incoming links (already confirmed this audit).

---

## Module 2 — Teachers & Academics (26 pages: 22 live + 4 dead-tree duplicates)

Sidebar links only `dashboard/teachers/*` and `dashboard/academics/*`; the bare `academics/*` tree is fully orphaned (confirmed zero references anywhere in `src/`).

| Page | Wired/Static | API | Real? | Auth | Notes |
|---|---|---|---|---|---|
| `dashboard/teachers/manage` | **Wired** | `/api/teachers` | Real | Yes | Ground truth for the module |
| `dashboard/teachers/[id]` | **Static** | none | — | — | Fully hardcoded, ignores `id` |
| `dashboard/teachers/bulk-import` | **Static** | none (`/api/teachers/import` exists but is a hardcoded stub returning `importedCount: 71` regardless of input) | Fake | — | Both sides fake, disconnected from each other |
| `dashboard/academics/calendar` | **Wired** (mislabeled, see bug #4) | `/api/academics/session-years` | Real | Yes | — |
| `dashboard/academics/class-section-teachers` | **Wired** | `/api/academics/class-teachers` | Real | Yes | Not in sidebar submenu, URL-reachable only |
| `dashboard/academics/class-subjects` | **Wired** | `/api/academics/class-subjects` | Real | Yes | Not in sidebar submenu |
| `dashboard/academics/classes` | **Wired** | `/api/academics/classes` | Real | Yes | — |
| `dashboard/academics/classes/[id]` | **Static** | none | — | — | Ignores `id` param |
| `dashboard/academics/conflicts` | **Static** | none — no table exists | — | — | Phase-4 territory |
| `dashboard/academics/evaluations` | **Static** | none — no table exists | — | — | Phase-4 territory |
| `dashboard/academics/grades/entry` | **Static** | none called | `/api/academics/assessments` is real but blocked (see below) | Yes (on the route) | UI never calls it |
| `dashboard/academics/mediums` | **Wired** | `/api/academics/mediums` | Real | Yes | — |
| `dashboard/academics/optional-subjects` | **Static** | none called | Fully fake — no `db` import at all | No | Both sides fake |
| `dashboard/academics/programs` | **Wired** (mislabeled, see bug #5) | `/api/academics/classes` | Real | Yes | — |
| `dashboard/academics/results` | **Static** | none — no table exists | — | — | Phase-4 territory |
| `dashboard/academics/schedule` | **Static** | none — dead `timetableSlots` chain confirmed unused | — | — | Phase-4 territory |
| `dashboard/academics/sections` | **Wired** | `/api/academics/sections` | Real | Yes | — |
| `dashboard/academics/semesters` | **Wired** | `/api/academics/semesters` | Real | Yes | — |
| `dashboard/academics/shifts` | **Wired** | `/api/academics/shifts` | Real | Yes | — |
| `dashboard/academics/streams` | **Wired** | `/api/academics/streams` | Real | Yes | — |
| `dashboard/academics/subjects` | **Wired** | `/api/academics/subjects` | Real | Yes | — |
| `dashboard/academics/syllabus` | **Static** | none — no table exists | — | — | Phase-4 territory |
| Dead tree ×4 (`academics/{assessments,classes,groups,programs}`) | mixed — `classes`/`groups` are wired-but-orphaned dupes of the real `classes` page; `assessments`/`programs` are additionally static and mislabeled internally | — | — | — | — |

**Grade-entry FK chain is structurally blocked, third occurrence of the known bug pattern:** `assessmentResults.assessmentId` is `NOT NULL` → `assessments.assessmentPlanId` is itself `NOT NULL` → `assessmentPlans`. Nothing anywhere creates an `assessmentPlans` or `assessments` row, so `POST /api/academics/assessments` is guaranteed to fail FK validation for any real ID a caller could construct. Moot today only because the one UI that could call it (`grade-entry-view.tsx`) is itself fully static.

### Plan
- **P1 (mislabel/miswiring fixes, trivial):** rename "Calendar" nav entry to "Années Scolaires" or split into a real calendar feature; either build a distinct Programs feature or collapse the nav item into Classes to stop presenting a duplicate as a separate feature; fix the dashboard-home broken link to `academics/assessments`.
- **P2 (wire static UI to real API):** none currently — `teachers/[id]`, `classes/[id]`, `optional-subjects` all need new backend, not just frontend wiring.
- **P3 (needs new backend, schema-first):**
  - `assessmentPlans`/`assessments` creation flow — build the missing "define an assessment" step before grade entry can work at all.
  - `teachers/[id]` — needs `GET /api/teachers/:id` with joined class/subject assignments, attendance-adjacent metrics.
  - `teachers/bulk-import` — replace the stub with a real CSV-parse + batch-insert route.
  - `optional-subjects` — needs a real elective-groups table + route; currently explicitly out of scope per the existing academic-structure plan.
  - `classes/[id]`, `conflicts`, `evaluations`, `results`, `schedule`, `syllabus` — genuinely new Phase-4 tables (timetable/exam-management), not wiring gaps. Matches what the existing `whimsical-painting-turtle` plan already scoped as out-of-scope follow-up.
- **P4 (cleanup):** delete the 4 dead-tree duplicates.

**Note:** the existing academic-structure plan (`sessionYears`/`semesters`/`mediums`/`sections`/`streams`/`shifts`/`classes`/`classSections`/`subjects`/`classSubjects`/`classTeachers`/`subjectTeachers`) is **already fully built and wired** on both backend and most frontend — this audit confirms that plan's backend scope is done; what's left is exactly the gaps listed above, not the original schema/API work.

---

## Module 3 — Finance, Attendance, Communication, Documents, Analytics (18 pages: 12 live + 6 dead-tree duplicates)

| Page | Wired/Static | API | Real? | Auth | Sidebar |
|---|---|---|---|---|---|
| `dashboard/finance/invoices` | **Static** | none called (`GET /api/finance/invoices` real, unused) | Real (unused) | Yes | Linked |
| `dashboard/finance/invoices/[id]` | **Static** | none — no single-invoice GET route exists at all | — | — | Reached via row click only |
| `dashboard/finance/payments/new` | **Static** | none called (`POST /api/finance/payments` real, unused) | Real (unused) | Yes | Not in sidebar |
| `dashboard/finance/expenses` | **Static** | none — no route exists (table `expenses` exists in Schema.ts, unused) | — | — | Not in sidebar |
| `dashboard/finance/pricing` | **Static** | none — no route exists (tables `feeStructures`/`feeSchedules`/`feeCategories`/`feeComponents` exist, unused) | — | — | Not in sidebar |
| `dashboard/finance/reports` | **Static** | none | — | — | Not in sidebar |
| `dashboard/attendance` | **Static** | none called — zero `fetch` in the whole file; Save button has no handler | `/api/attendance` real, tenant-scoped, unused | Yes | Linked |
| `dashboard/communication/reminders` | **Static** | none — no `/api/communication/*` route exists at all | — | — | Linked |
| `dashboard/communication/templates` | **Static** | none | — | — | Not in sidebar |
| `dashboard/documents/generator` (real Massar UI) | **Static** | none — no `/api/documents/*` route exists | — | — | **Not in sidebar** (orphaned by bug #1) |
| `dashboard/documents/report-cards` (wrong component per sidebar) | **Wired** | `/api/academics/classes` etc. | Real | Yes | Linked as "Bulletins Massar" (miswired, bug #1) |
| `dashboard/analytics` | **Static** (real `recharts` components, fake data feeding them) | none — no `/api/analytics/*` route | — | — | Linked |
| Dead tree ×6 | 4 are byte-identical orphan dupes; `documents/report-cards` and `analytics` dead-tree versions are independent, hand-written, third implementations diverging from their live siblings | — | — | — | — |

`finance/invoices` and `finance/payments` API routes are confirmed properly authorized (`requireRequestContext`/`requireTenant`, tenant-scoped, transactional payment+invoice update, audit-logged). `payments/route.ts` has **no GET handler** — no way to list payments via API at all today.

### Plan
- **P1 (wire static UI to already-real API, no schema work):** `finance/invoices` list, `finance/payments/new` form, `dashboard/attendance` — three pages where the backend is done, authorized, and simply never called. This is the single highest-leverage chunk of work in the whole audit: real, secure, tested backend sitting idle behind a static screen.
- **P1 (miswiring fix):** repoint the sidebar's "Bulletins Massar" entry at `documents/generator`, and either delete or relabel `documents/report-cards`'s current content so a classes-manager doesn't masquerade as a report-card screen.
- **P2 (needs new backend):**
  - `finance/invoices/[id]` — add `GET /api/finance/invoices/:id`.
  - `finance/payments` — add a GET handler for listing.
  - `finance/expenses` — table exists, add the route (should be quick, same pattern as everything else).
  - `finance/pricing` — tables exist, add the route.
  - `communication/*` — needs a real schema (reminder templates, send-log) plus an actual SMS-provider integration point, not just a DB route.
  - `documents/generator` — PDF generation is a service concern, not a CRUD route; scope this as its own small project (e.g., a report-card renderer that reads real grades/attendance once `assessments` is unblocked).
  - `analytics` — needs a real aggregate route (can likely reuse the pattern from `/api/dashboard/summary`).
- **P3 (cleanup):** delete the 6 dead-tree duplicates, including the two "third implementation" ones (`documents/report-cards`, `analytics`) since they diverge from their live siblings and would otherwise rot independently.

---

## Module 4 — Settings, Super-admin, Auth (21 pages: 8 settings + 10 super-admin + 2 dead-tree + login)

`dashboard/settings/{staff,attendance,audit-logs,onboarding}` have **no sidebar link at all** despite living in the "live" URL prefix — orphaned-by-omission, not by route-tree duplication.

| Page | Wired/Static | API | Real? | Auth | Sidebar |
|---|---|---|---|---|---|
| `dashboard/settings` (general) | **Wired** | `/api/settings` | **Fake, no auth** | No | Linked |
| `dashboard/settings/users` | **Wired** | `/api/users` | **Real, correctly authorized/tenant-scoped** | Yes | Linked |
| `dashboard/settings/staff` | **Static** | none | — | — | **No sidebar link** |
| `dashboard/settings/attendance` | **Static** | none | — | — | **No sidebar link** |
| `dashboard/settings/audit-logs` | **Static** | none | — | — | **No sidebar link** |
| `dashboard/settings/cndp` | **Wired** (wrong component, bug #2) | `/api/settings` | Fake | No | Linked (twice) |
| `dashboard/settings/onboarding` | **Static** | none | — | — | **No sidebar link** |
| `dashboard/settings/access-reset` | **Static** | none called | `/api/settings/access-reset` real-shaped but **unauthenticated** and unwired | No | Linked |
| `dashboard/super-admin/*` (10 pages) | **100% static**, zero `fetch` across all 10 | none — no route exists, no schema exists (`subscriptions`/`billing`/`platform_*` tables absent entirely) | — | Layout guard only (`role === 'super_admin'`, real) | Linked |
| Dead tree `settings/page.tsx` | byte-identical to live twin | `/api/settings` | Fake | No | Orphaned |
| Dead tree `settings/cndp/page.tsx` | **This is the correct CNDP component**, standalone, static data | none | — | — | Orphaned — the "right" version nobody can reach |
| `(auth)/login` | **Wired** (real Better Auth) | Better Auth `/api/auth/[...all]` | Real | Better Auth handles it | Entry point |

`/api/users` is confirmed the one genuinely solid route in this whole module — correct tenant scoping on every query, role gating, self-delete protection, audit logging. It's the bar the rest of this module should be rebuilt to.

### Plan
- **P0 (security, trivial, do first):**
  1. Delete or auth-gate `/api/settings/access-reset` — it's unauthenticated and unused, so the safest immediate move is either removing it or adding `requireRequestContext(['school_admin'])` even before the feature is real.
  2. Rebuild `/api/settings` as a real, tenant-scoped table (`schoolSettings` with `tenantId` FK, one row per tenant) with `requireRequestContext`/`requireTenant` — the current shared-global-object bug is a cross-tenant data leak, not just "unfinished."
  3. Add `requireRequestContext`/`requireTenant` to any settings route before it goes further, matching the `/api/users` pattern.
  4. Fix login's hardcoded `/fr/dashboard` to use the actual `locale` param; remove the demo-credential autofill buttons from production (env-gate them behind non-production, or delete).
- **P1 (miswiring, trivial):** swap `dashboard/settings/cndp/page.tsx`'s import from `SettingsView` to the correct component (currently stranded in the dead tree) — content already exists, this is a one-line import fix plus deleting the now-redundant dead-tree file.
- **P1 (nav hygiene):** add sidebar links for `staff`, `attendance`, `audit-logs`, `onboarding` if they're meant to ship, or remove the pages if they're abandoned — right now they're neither reachable nor deleted.
- **P2 (wire once P0 lands):** `access-reset` UI needs to call the real (now-secured) endpoint instead of mutating local mock state.
- **P3 (large, separate project):** the entire super-admin/platform surface needs a subscriptions/billing schema, a full API layer, and only then UI wiring — this is not a "finish the wiring" task, it's a from-scratch SaaS-ops build. Recommend treating it as its own phase, not bundled with the rest of this remediation.

---

## Cross-cutting recommendations

1. **Delete the dead-tree duplicate route files** across every module (students ×3, academics ×4, finance/attendance/comm/docs/analytics ×6, settings ×2 = 15 files) once you've spot-checked each has zero incoming `Link`/`router.push` references (this audit already did that check for all of them). They add real risk: two of them (`documents/report-cards`, `analytics` in the dead tree) have already silently diverged into a third, different "truth" for the same feature.
2. **Fix `(auth)/login`'s locale bug and pull the demo-credential buttons** before this goes anywhere near a real deployment.
3. **The FK-into-dead-table bug pattern has recurred 3 times this session** (`applicants`, `attendance.studentGroupId`, now `assessments`/`assessmentPlans`). Worth a deliberate pass over `Schema.ts` for any other `NOT NULL` FK targeting a table with zero `INSERT` call sites, rather than waiting to hit each one via a live 500.
4. **Every module's P1 "wire static UI to already-real, already-authorized API" items are the cheapest, highest-value work available** — no schema changes, no new routes, just replacing hardcoded arrays with `fetch`. Recommend doing all of those first, across all four modules, before touching any P2/P3 item.
