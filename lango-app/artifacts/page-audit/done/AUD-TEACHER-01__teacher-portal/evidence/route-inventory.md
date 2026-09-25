# AUD-TEACHER-01 — Teacher route inventory

Derived from `src/libs/api/portal-manifest.ts` (`FULL_NAVIGATION` + `filterByPermission`)
cross-checked against the teacher capability set in `src/libs/api/permissions.ts`
(`DEFAULT_ROLE_PERMISSIONS.teacher`) and the sidebar self-service block in
`src/components/shared/sidebar.tsx` (`teacherPortalNav`, ~line 862).

Teacher effective capabilities (verbatim, permissions.ts:299-318):
`students.read`, `academics.read`, `attendance.read`, `attendance.manage`,
`grading.read`, `grading.manage`, `payroll.self.read`, `communication.read`,
`guardians.read`, `reports.read`, `content.manage`, `cards.issue`,
`certificates.issue`, `events.*`, `live.*`, `transport.read`,
`transport.trip.read`, `transport.boarding.manage`.

## Tier 1 — navigation entries the teacher actually sees

| # | Route | Nav item / gate | Page guard | APis used | Purpose |
|---|---|---|---|---|---|
| 1 | `/dashboard/teacher` | self-service (`teacherPortalNav`) + module home | `allowedRoles: ['teacher']` | `/api/teacher/me/{home,timetable,classes}` | Teacher landing: today's sessions, weekly timetable, my classes/rosters |
| 2 | `/dashboard` | `dashboard` (no permission) | RSC redirect via `resolveLandingPath` | — | Redirects teacher to `/dashboard/teacher` |
| 3 | `/dashboard/academics` | `academics` (`academics.read`) | group landing | — | Same teacher-schedule child |
| 4 | `/dashboard/academics/teacher-schedule` | `teacher-schedule` (`academics.read`) | `academics.read` | `/api/academics/timetable-slots` (self-scoped server-side) | Published "my schedule" |
| 5 | `/dashboard/attendance` | `attendance` (`attendance.read`) | `attendance.read` | attendance APIs (frozen Attendance Core) | Register / sessions |
| 6 | `/dashboard/academics/results` | `grading` (`grading.read`) | `grading.read` | `/api/academics/class-subjects`, `/api/academics/class-results` | Class results / ranking / mentions |
| 7 | `/dashboard/students` | `students` (`students.read`) | `students.read` | `/api/students` (+ export) | Student directory |
| 8 | `/dashboard/students/parents` | `guardians` (`guardians.read`) | `guardians.read` | `/api/students/parents` | Guardians directory |
| 9 | `/dashboard/reports` | `reports` (`reports.read` + `advanced-reporting` addon) | `reports.read` | advanced-reporting catalog | Report centre |
| 10 | `/dashboard/transport` | `transport` (`transport.read` + `transport` addon) | `transport.read` | transport overview | Addon overview |
| 11 | `/dashboard/transport/trips` | `transport-trips` (`transport.trip.read`) | `transport.trip.read` | `/api/transport/trips` | Trips of the day |
| 12 | `/dashboard/transport/boarding` | `transport-boarding` (`transport.boarding.manage`) | `transport.boarding.manage` | rider-events/roster APIs | Boarding pointage |

Quick action: `/dashboard/attendance?action=record` (`attendance.manage`).

Filtered out for teacher (verified): `teachers`, `finance`, `communication`
(`communication.send`), `hr` (`hr.read`), `guard`, `reception`, `library`,
`leadership`, `settings`, plus academics children `classes/subjects/schedule/
session-copy/assignments/promotions/readiness` (`academics.manage`).

## Tier 2 — permission-allowed deep links (no nav entry) audited for guard truth

| Route | Page guard | Teacher reachable? | Result |
|---|---|---|---|
| `/dashboard/academics/teacher-availability` | `academics.read` | Yes | Works in self-service mode; `/api/teachers` 403 is expected and handled (documented) |
| `/dashboard/academics/grades/entry` | `grading.manage` | Yes | Honest empty state until an assessment is selected |
| `/dashboard/academics/assessment/marksheet` | `grading.manage` | Yes | Honest empty state + link back to exam list |
| `/dashboard/academics/assessment/homework` | `grading.manage` | Yes | Honest empty state, KPI 0/0 shows "—" |
| `/dashboard/academics/live-class` (+`/new`, `/[id]`) | `live.read` / `live.manage` | Yes | Loads |
| `/dashboard/academics/live-class-reports` | `live.reports.read` | Yes | Loads |
| `/dashboard/attendance/{scanner,badges,audit,excuses,flags,qr-reports}` | `attendance.read|manage` | Yes | Frozen Attendance Core — read/test only |
| `/dashboard/students/[id]`, `/dashboard/students/parents/[id]` | `students.read`, `guardians.read` | Yes | Role-field-filtered server-side (finance/PII stripped for teacher) |

Not teacher-reachable (verified 403 or redirect): `/dashboard/finance*`,
`/dashboard/hr*` (no `hr.read`), `/dashboard/settings*`, `/dashboard/teachers`.

## Runtime inventory verification (schoolos_audit, prof.07@atlas.ma)

- Sidebar rendered (see `screenshots/final-prof07/teacher-fr-teacher.png`):
  Tableau de Bord, Prise de Présence, Élèves & Profils, Structure Académique
  (→ Emploi du temps enseignant), Notes & Évaluations, Parents & Tuteurs,
  Rapports & Statistiques, Transport Scolaire (Vue d'ensemble / Trajets du
  Jour / Pointage & Montée), Enseignant.
- `/api/teachers` → 403 for teacher (correct).
- `/api/transport/allocations` → 403 for teacher (correct).
