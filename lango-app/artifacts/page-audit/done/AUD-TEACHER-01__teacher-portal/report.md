# AUD-TEACHER-01 — Teacher Portal — Executor Report

## 1. Handoff Metadata

- Executor: Agent B (opencode-1)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-b/AUD-TEACHER-01`
- Implementation SHA(s): `2cc5ea9bdb1800fa6f41a581bb03efbb881537d0`
- Hub item: `task:AUD-TEACHER-01` (plus `task:port-3447`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-TEACHER-01__teacher-portal/`

## 2. Scope

### Pages audited

| # | Route/Page | Role(s) | Purpose | Result |
|---|---|---|---|---|
| 1 | `/dashboard/teacher` | teacher | Self-service home: today, weekly timetable, classes/rosters | FIXED (F-01, F-03, F-04, F-05, F-09) |
| 2 | `/dashboard` | teacher | Module home → redirects to `/dashboard/teacher` | PASS |
| 3 | `/dashboard/academics/teacher-schedule` | teacher | Published "my schedule" | FIXED (F-06, F-07) |
| 4 | `/dashboard/attendance` | teacher | Attendance register (frozen core, read-only audit) | PASS + FC-1 documented |
| 5 | `/dashboard/academics/results` | teacher | Class results/ranking/mentions | FIXED (F-02, picker) |
| 6 | `/dashboard/students` | teacher | Student directory | FIXED (F-08) |
| 7 | `/dashboard/students/parents` | teacher | Guardians directory | PASS |
| 8 | `/dashboard/reports` | teacher | Report centre (advanced-reporting addon) | PASS |
| 9 | `/dashboard/transport` | teacher | Transport overview (addon) | PASS |
| 10 | `/dashboard/transport/trips` | teacher | Trips of the day (addon) | PASS |
| 11 | `/dashboard/transport/boarding` | teacher | Boarding pointage (addon) | PASS |
| 12 | `/dashboard/academics/teacher-availability` | teacher | Self-service availability | PASS (expected 403 `/api/teachers` documented, F-10) |
| 13 | `/dashboard/academics/grades/entry` | teacher | Standalone grade entry | PASS |
| 14 | `/dashboard/academics/assessment/marksheet` | teacher | Exam marksheet | PASS |
| 15 | `/dashboard/academics/assessment/homework` | teacher | Homework console | PASS |
| 16 | `/dashboard/academics/live-class` (+`/new`, `/[id]`, `live-class-reports`) | teacher | Live classrooms | PASS |

Full tiered inventory incl. filtered-out modules and deep links:
`evidence/route-inventory.md`.

### Explicitly out of scope

- Student portal (`/dashboard/student/*`) and parent portal — other lanes; note:
  their home/timetable APIs still read the legacy `timetable_slots` table
  (same defect class as F-01, reported as follow-up, not fixed here).
- Finance, HR/Workforce, Communication, Library, Super-admin — not teacher-reachable.
- Attendance Core fixes (frozen) — contradictions documented only.
- Transport addon deep behaviour beyond the teacher landing path.

### Frozen dependencies not modified

- Attendance Core (aggregate/summary/registers/QR canonical path) — read/test only.
- Timetable generator/solver semantics and `class_schedule_slots` writer
  paths (`timetable-versions`, `timetable-slots` POST/PUT/DELETE) — untouched.
- `libs/api/teacher-scope.ts` — consumed, not modified (its internal
  `todayIso()` boundary is a noted follow-up, see §11).

## 3. Workflow Understanding

1. A teacher signs in and `resolveLandingPath` sends them to `/dashboard/teacher`
   (the generic `/dashboard` summary API is school_admin-only).
2. The sidebar for staff roles renders `GET /api/portal/manifest`, already
   capability- and addon-filtered. Teachers see: dashboard, attendance,
   students, academics→teacher-schedule, grading→results, guardians, reports
   (addon), transport (addon), plus the self-service "Enseignant" entry.
3. The teacher home aggregates three self-scoped endpoints
   (`/api/teacher/me/{home,timetable,classes}`), all guarded by
   `requireTeacherContext` (`role='teacher'` + tenant).
4. Results: the teacher picks a class-subject and
   `/api/academics/class-results` computes the Moroccan /20 weighted average,
   rank and mention from `assessment_results` via
   `libs/grading/moroccan-grade-engine`.
5. Attendance: `/dashboard/attendance` marks the register for the teacher's
   own sections (frozen canonical aggregate powers the Assiduité column).
6. Students/guardians directories are tenant(+branch)-scoped; the server strips
   finance/PII fields for teachers, and (after this campaign) also the
   school-wide overdue aggregate and its UI.

Source of truth for the schedule: the **published `class_schedule_slots`
version of the default session** (`/api/academics/timetable-slots` resolves it;
`libs/api/school-day.ts` uses the same table as the canonical instructional-day
source). `timetable_slots` is legacy (seed-only; labelled
`legacy_timetable_slots` in `teacher-service.ts:741`).

## 4. Findings

| ID | Severity | Page/Workflow | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| F-01 | High | `/dashboard/teacher` home + timetable tabs | Read the legacy `timetable_slots` table the product never writes → empty schedule in any real tenant; contradicted the published timetable in seeded data | `evidence/runtime-probes.md` §2; baseline screenshots | Fixed |
| F-02 | High | `/dashboard/academics/results` | Cross-class IDOR: teacher could read ranked rosters (names/averages/mentions) of **all 43** class-subjects; picker listed all | probe `43/43 readable`; `evidence/runtime-probes.md` §1 | Fixed |
| F-03 | Medium | `/dashboard/teacher` classes | "Mes classes" only counted homeroom (`class_teachers`) rows: prof.07 saw 1 of 12 taught sections; a subject-only teacher saw 0 | baseline vs final home screenshots | Fixed |
| F-04 | Low | `/dashboard/teacher` (S-47) | Lone "—" rendered in class card ("— · 17 élève(s)") | baseline home screenshot | Fixed |
| F-05 | Low | `/api/teacher/me/home` | "Today" used server-local `getDay()` + UTC `toISOString()` instead of Casablanca business day | code trace; canonical helper `casablancaTodayIso` exists | Fixed |
| F-06 | Low | `/dashboard/academics/teacher-schedule` | Float artifact `10.999999999999998h de cours par semaine` | baseline schedule screenshot | Fixed |
| F-07 | Low | `/dashboard/academics/teacher-schedule` | Slots sorted lexicographically ("10:00" before "8:00") | baseline schedule screenshot | Fixed |
| F-08 | Medium | `/dashboard/students` | Teacher saw school-wide finance: KPI `905 500 MAD · 46 élèves`, plus every row labelled "À jour" (amounts zeroed server-side → a lie) and finance columns in the teacher CSV export | baseline students screenshot; API probe | Fixed |
| F-09 | Info | `/dashboard/teacher` timetable tab | Week started on Sunday (empty first card) while the school week/schedule page is Monday-first | final vs baseline home screenshots | Fixed |
| F-10 | Info | `/dashboard/academics/teacher-availability` | `/api/teachers` 403 for teachers (owner-picker probe) | sweep flag; guard handles failure and falls back | Logged — by design (self-service mode), not a defect |
| FC-1 | Blocker-candidate | `/dashboard/attendance` | `attendance_summary` rows show rate > 100 % (32 rows; negative `total_absent`) | `evidence/frozen-contradictions.md` | Documented (frozen) |
| FC-2 | Blocker-candidate | Attendance onsite | Timezone window shift (already logged pre-campaign) | `evidence/frozen-contradictions.md` | Documented (frozen) |

## 5. Fixes Implemented

### F-01 — Teacher portal reads the canonical published timetable
- Root cause: `/api/teacher/me/{home,timetable}` queried `timetable_slots`,
  written only by `scripts/seed-full.ts`; the product publishes
  `class_schedule_slots` via `timetable_versions`.
- Fix: new `features/teacher/server/teacher-portal.ts` resolves the default
  session's published version (same rule as `/api/academics/timetable-slots`)
  and serves `class_schedule_slots` scoped by `teacherId`+`tenantId`; room
  falls back to the canonical `room_label`; empty strings render as no line.
- Why domain-correct: one timetable truth for teacher pages, matching the
  generator/conflicts/room-registry and the purpose-built schedule page.
- Files: `src/features/teacher/server/teacher-portal.ts` (new),
  `src/app/api/teacher/me/home/route.ts`, `.../timetable/route.ts`.
- Regression risk: low; both routes are teacher-only and read-only.

### F-02 — Subject-level teacher scoping for class results and picker
- Root cause: `/api/academics/class-results` allowed `teacher` and looked up
  `classSubjects` tenant-wide; `/api/academics/class-subjects` GET had no
  teacher narrowing. `classSubjectId` is client-supplied.
- Fix: both routes now use the canonical current-assignment scope
  (`getTeacherClassSubjectPairs`) — results 403 for a foreign subject, picker
  returns only own subjects (empty list, not all, for an unassigned teacher).
  `school_admin` keeps the whole-school view (verified 43/43, 200).
- Why domain-correct: mirrors `grade-entry`'s established rule ("a teacher may
  only mark students in the sections they teach") and the subject-level
  boundary documented in `marksheet-access.ts`.
- Files: `src/app/api/academics/class-results/route.ts`,
  `src/app/api/academics/class-subjects/route.ts`.
- Regression risk: teachers see fewer picker options (intended); admin,
  accountant, receptionist paths unchanged (role check is `teacher`-only).

### F-03 + F-04 — "Mes classes" counts every taught section, no lone dash
- Root cause: the home/classes queries joined only `class_teachers`;
  `TeacherPortalView` rendered `subjects.join(' · ') || '—'`.
- Fix: `listTeacherClasses`/`listTeacherRosters` use
  `getTeacherClassSectionIds` (homeroom + current subject assignments, default
  session aware); the card/tab hide the subject line when empty.
- Files: `features/teacher/server/teacher-portal.ts`,
  `features/teacher/ui/TeacherPortalView.tsx`,
  `src/app/api/teacher/me/classes/route.ts`.
- Regression risk: low; strictly more truthful data for the same widgets.

### F-05 — Casablanca business day for "today"
- Fix: `teacherTodayIso()`/`teacherTodayWeekday()` use
  `libs/finance/today.casablancaTodayIso` + `libs/api/school-day.weekdayNameFor`.
- Files: `features/teacher/server/teacher-portal.ts`,
  `src/app/api/teacher/me/home/route.ts`. Regression risk: low.

### F-06 + F-07 + F-09 — Schedule presentation truth
- Fix: minutes-based chronological sort (handles unpadded `8:00`), hours
  rounded to one decimal, timetable tab ordered Monday-first.
- Files: `features/academics/ui/teacher-schedule-view.tsx`,
  `src/app/api/teacher/me/timetable/route.ts`. Regression risk: low.

### F-08 — Remove the finance leak from the teacher student directory
- Root cause: the API zeroed per-student amounts for `teacher` but returned the
  tenant-wide overdue aggregate, and the UI always rendered the finance KPI,
  finance column and finance rows (so teachers saw a fake "À jour" per row).
- Fix: `hasCapability(..., 'finance.read')` gates the aggregates server-side and
  the CSV columns; `can('finance.read')` hides the KPI card, desktop column,
  mobile block, drawer rows (2) while keeping `colSpan`/skeletons correct.
  `school_admin`/`accountant` unchanged (admin probe: `1000 MAD` still shown).
- Files: `src/app/api/students/route.ts`,
  `features/students/ui/students-list-client.tsx`.
- Regression risk: medium-low; gated by an existing capability, never by role
  names, so custom grants keep working.

## 6. Security / Isolation / Permission Audit

- Tenant isolation: every new/changed query filters `eq(..., tenantId)`;
  `npm run check:isolation` PASS with zero warnings in touched files (828 files
  scanned). `/api/teacher/me/*` additionally binds `teacherId = ctx.userId`.
- Branch isolation: untouched paths keep their branch filter; the portal reads
  have no branch column, no branch logic was added or weakened.
- Page guard: all audited pages run `requireServerPage`
  (`teacher` role or the capability matching the nav item); guard ↔ nav parity
  holds for the teacher-effective manifest (see inventory).
- API capability/role guard: `/api/teacher/me/*` `requireTeacherContext`
  (role teacher + tenant); class-results/class-subjects require the teacher
  role plus (new) subject-level assignment; students/transport/reports enforce
  their allowlists (teacher 403 on `/api/teachers`, `/api/transport/allocations`).
- Add-on/entitlement: reports and transport entries only render when the addon
  is enabled (manifest `addonId`), verified in the audit tenant.
- IDOR/object ownership: fixed F-02 (43/43 → 4/4 own; foreign 403) and
  documents the class-subject picker narrowing; single-object lookups remain
  tenant-scoped with 404 on foreign ids.
- Request validation: no new input surfaces; existing Zod parsing untouched.
- Sensitive-data exposure: F-08 removed tenant-wide fee aggregates and
  misleading finance statuses from teachers; CSV export no longer carries
  finance columns for them.
- Audit logging: routes touched are read-only aggregations; no new mutations
  were introduced, so no new audit rows are required. Grade-entry audit logic
  untouched.

Runtime evidence: `evidence/runtime-probes.md` §1–§4.

## 7. Data / DB / Migration Impact

- Tables read: `class_schedule_slots`, `timetable_versions`, `session_years`,
  `class_sections`, `classes`, `sections`, `class_subjects`, `subjects`,
  `subject_teachers`, `class_teachers` (via canonical helper), `user`,
  `invoices` (aggregate only, capability-gated and zeroed for teachers),
  `attendance_summary` (read-only display, frozen).
- Tables written: **none** (no mutations added; no writes during audit).
- Historical data changed: none.
- Migration added: none.
- Migration journal status: unchanged.
- Fresh DB/replay proof: N/A (no schema change).

## 8. Tests

### Focused tests

```text
DATABASE_URL=…/schoolos_audit npx vitest run src/app/api/__tests__/teacher-portal-scope.test.ts
→ 1 file passed; 6/6 tests PASS
```

New suite: `src/app/api/__tests__/teacher-portal-scope.test.ts` — own vs foreign
class-results (200/403), picker narrowing, canonical-only timetable, subject
assignment in "my classes" + today's canonical session, finance aggregate
gate (teacher 0 / admin 1000).

### Runtime reconciliation

```text
teacher prof.07 / /api/academics/class-results?classSubjectId=<foreign> -> 403  (was 200)
teacher prof.07 / /api/academics/class-subjects?pageSize=100             -> 4 own  (was 43)
teacher prof.07 / /api/teacher/me/home   -> myClasses 12, students 200, today canonical (was 1/17/legacy)
teacher prof.07 / /api/students          -> totalOverdueMAD 0 (was 905500)
school_admin     / /api/academics/class-subjects -> 43 (unchanged), foreign results 200 (unchanged)
sweeps: 16 routes × (FR desktop, AR RTL, phone 390, sparse teacher) -> no redirect, no hscroll, no text defects;
        only expected flag: 403 /api/teachers on teacher-availability (self-service fallback)
```

### Static gates

```text
check:types      PASS
check:isolation  PASS (0 warnings in touched files)
check:i18n       PASS
missing-i18n     PASS (0 in 0 files)
check:ui         PASS (ratchet holding; dead controls 38 vs baseline 39 — baseline left untouched)
eslint touched   PASS for all new/rewritten files; pre-existing error counts in the two legacy UI files did not grow
```

### Broader suite

- Run? YES
- Result: `Test Files 6 failed | 217 passed (223)`, `Tests 2 failed | 3197 passed | 9 skipped (3199)`
- Any failures: finance/subscriptions suites only (`refund-linkage`,
  `invoice-lifecycle`, `payment-allocation`, `payment-idempotency`,
  `payment-reversal`, `license-expiry-worker`). See `evidence/gates-and-tests.md`
  for the per-file triage.
- Reproduced on target branch? YES (environmental): `refund-linkage` fails
  standalone on this branch against the shared `schoolos_audit` DB because
  other agents wrote `accounting_adapter_exceptions` rows at 19:19–19:21,
  before the suite ran at 20:19; the other failures are `delete from tenants`
  cleanup blocks from leftover shared-DB rows. None is in a domain this diff touches.

## 9. Visual / UX Evidence

Full manifest: `evidence/screenshot-manifest.md`. Highlights:

| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/baseline-prof07/teacher-fr-teacher.png` | Home before | FR | Desktop | Legacy timetable (1 séance), 1 class |
| `screenshots/final-prof07/teacher-fr-teacher.png` | Home after | FR | Desktop | 12 classes/200 students |
| `screenshots/final-prof07/teacher-fr-home-timetable-tab.png` | Weekly tab | FR | Desktop | Canonical, Monday-first, ordered |
| `screenshots/final-prof07/teacher-fr-home-classes-tab.png` | Rosters | FR | Desktop | Real rosters for all sections |
| `screenshots/baseline-prof07/teacher-fr-academics__teacher-schedule.png` | Before | FR | Desktop | Float artifact + wrong order |
| `screenshots/final-prof07/teacher-fr-academics__teacher-schedule.png` | After | FR | Desktop | `11h`, ordered |
| `screenshots/final-prof07/teacher-fr-results-picker-open.png` | Picker | FR | Desktop | Only 4 own subjects |
| `screenshots/baseline-prof07/teacher-fr-students.png` → `final-prof07` | Directory | FR | Desktop | Finance leak removed |
| `screenshots/final-prof07-ar/teacher-ar-teacher.png` | Home RTL | AR | Desktop | Mirrored layout, Arabic labels |
| `screenshots/final-prof07-phone/teacher-fr-phone-teacher.png` | Home mobile | FR | 390 | Usable, no hscroll |
| `screenshots/final-prof01/teacher-fr-teacher.png` | Sparse teacher | FR | Desktop | Honest empty state, S-47 gone |

## 10. Files Changed

```text
lango-app/src/features/teacher/server/teacher-portal.ts                     (new)
lango-app/src/app/api/teacher/me/home/route.ts
lango-app/src/app/api/teacher/me/timetable/route.ts
lango-app/src/app/api/teacher/me/classes/route.ts
lango-app/src/app/api/academics/class-results/route.ts
lango-app/src/app/api/academics/class-subjects/route.ts
lango-app/src/app/api/students/route.ts
lango-app/src/features/teacher/ui/TeacherPortalView.tsx
lango-app/src/features/academics/ui/teacher-schedule-view.tsx
lango-app/src/features/students/ui/students-list-client.tsx
lango-app/src/app/api/__tests__/teacher-portal-scope.test.ts               (new)
lango-app/artifacts/page-audit/done/AUD-TEACHER-01__teacher-portal/**       (report/evidence/screenshots)
```

`lango-app/tsconfig.json` was transiently modified by `next dev`
(`.next-agentb` includes) and reverted before commit; `.next-agentb/` build
output is untracked and not committed.

## 11. Unresolved / Follow-up Items

- **Student portal home/timetable still read legacy `timetable_slots`**
  (`src/app/api/student/me/home`, `/timetable`; note `student/me/home` also
  indexes `WEEKDAYS[getDay() - 1]`). Same defect class as F-01 outside the
  teacher lane — recommend a `task:` item.
- **`libs/api/teacher-scope.ts` `todayIso()`** uses UTC `toISOString()`; the
  same boundary class as F-05. Shared by grade entry/marksheet — suggested
  follow-up rather than a drive-by change.
- **`/dashboard/academics/teacher-availability`** probes `/api/teachers` as a
  teacher (403) and falls back to self-service. Works; could avoid the request
  when the manifest already knows `teachers.read` is absent. Logged as F-10.
- **check:ui baseline**: dead controls improved 39→38; the baseline file was
  deliberately left untouched to avoid conflicts with other agents' campaigns
  (`scripts/ui-reality-baseline.json` is shared).
- Frozen contradictions FC-1/FC-2 in `evidence/frozen-contradictions.md`
  (release-blocker candidates for the orchestrator; not fixed here).

## 12. Frozen-Module / Cross-Module Impact

- No frozen file was modified. Attendance Core was exercised read-only through
  `/dashboard/attendance` as a teacher; the two contradictions above are
  documented, reproduced and left untouched.
- The canonical timetable writers (`timetable-versions*`,
  `/api/academics/timetable-slots` mutations) were not modified; the portal now
  consumes their published output exactly like the schedule page.
- Shared helpers consumed as-is: `getTeacherClassSectionIds`,
  `getTeacherClassSubjectPairs`, `casablancaTodayIso`, `weekdayNameFor`,
  `hasCapability`. Regression evidence: `teacher-directory-hardening` (29 tests)
  and `student-360-hardening` (31 tests) both pass.
- Students directory changes are capability-gated (`finance.read`), so no
  admin/accountant flow changes; `role-response-shape` and `security` suites pass.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: 2cc5ea9bdb1800fa6f41a581bb03efbb881537d0
OPEN CLAIMS: 0
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
