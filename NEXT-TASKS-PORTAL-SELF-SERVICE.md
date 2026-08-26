# Next Tasks — Self-Service Portal Enhancements & Access-Control Audit Record

Written after a full role-based access-control audit (teacher, accountant, parent,
student) surfaced during hands-on testing on 2026-08-25. Two things live here:
(1) the enhancement backlog the user explicitly deferred to "later," per portal,
and (2) a short record of the access-control decisions made this session so the
reasoning isn't lost.

---

## 1. Deferred enhancement backlog (explicitly "later," not urgent)

### Espace Élève (student self-service portal)
Currently only has a "Tableau de bord" entry. User confirmed missing, wants added:
- Notes / grades view (student's own results — no page exists yet; `grading.read`
  is granted but nothing consumes it for self-service. `academics/grades/entry`
  is a teacher/admin entry tool, not a student-facing results view).
- Activities page.
- Photo gallery.
- Audit `/dashboard/student/*` for what else is missing relative to what a
  student should reasonably self-serve (schedule? documents? library holds?).

### Espace Parent (parent self-service portal)
`/dashboard/parent`, `/attendance`, `/finance`, `/communication`, `/requests`,
`/settings` all render and were confirmed "looks ok" by the user, but flagged
for a later content/depth pass — no specifics given yet, revisit with the user
before starting.

Also still open, found during this audit, not yet fixed:
- No parent-facing **grades** page exists (parent has `grading.read` but, like
  the student side, nothing self-service consumes it).
- `hostel/guardian` and `parent/live-classes` will now resolve (guardian
  accounts were linked to real students in the Atlas seed), but empty states
  (no live classes scheduled) are expected, not bugs.

### Espace Enseignant (teacher self-service dropdown)
Currently only "Tableau de bord." This is by design today — teacher's real
working surface (Élèves, Structure académique, Présences, Notes & évaluations,
Parents/Tuteurs, Rapports) lives in the top-level staff nav (`portal-manifest.ts`
/ `FULL_NAVIGATION`), not nested under this dropdown. Worth a product decision
later: consolidate teacher's real pages under "Espace Enseignant," or leave the
split as-is now that the underlying access bugs are fixed. Not a bug on its own.

---

## 2. Access-control audit — what was found and fixed (2026-08-25)

**Root cause, session-wide:** the sidebar (`portal-manifest.ts` /
`FULL_NAVIGATION`) is correctly capability-driven, but ~280 page files used an
independently hardcoded `allowedRoles` in `page-guard.ts` (almost always
`['school_admin', 'super_admin']`), and some API routes had their own separate,
stale role allowlists one layer deeper. The nav would promise access a page or
API didn't actually grant — "visible link, redirects home" bug, at scale.

**Fixed infra:** `page-guard.ts`'s `allowedRoles` is now optional — pages can
gate purely by `requiredCapability` (the same `PermissionKey` the nav uses),
so nav-visibility and page-access can't drift apart for any *new* page going
forward. Not retrofitted to all ~280 files (out of scope for one session) —
only the ones actually hit during testing, listed below.

**Fixed pages + APIs (teacher/accountant):** Students list + detail, Guardians
list + detail ("Voir le profil complet" on both), Attendance, Academics/Classes,
Academics/Subjects (see reclassification below), Academics/Schedule (see
below), reports catalog (was showing every report regardless of permission,
causing a raw `FORBIDDEN` on click instead of just not showing it) and its
`[key]` detail page (now checks each report's own `requiredPermissions`).

**Reclassified back to admin-only** (`academics.manage`), after checking what
the pages actually let you do:
- **Espace d'affectations** (assignment/staffing tool) and **Bilan de rentrée**
  (readiness checklist) — genuine admin workflows, not teacher browsing.
- **Matières** (Subjects) and the general **Emploi du temps** (all-classes
  schedule builder) — both are full add/edit/delete consoles; opening them to
  teacher would show live-looking buttons that just 403. Schedule is also
  redundant for teacher: **Emploi du temps enseignant** already exists as the
  purpose-built "my schedule" view (same `timetable-slots` API, scoped to the
  caller when they're a teacher).
- **Classes** stayed teacher-readable — confirmed via source read it's a
  genuine read-only roster/structure browser, no CRUD affordances.
- **Reports** confirmed genuinely useful for teacher: 7 report definitions in
  the catalog require only `attendance.read` or `grading.read` (4 attendance
  reports, 1 combined, 2-3 grading/academic reports), both of which teacher
  holds — so the module isn't a dead end once the catalog is filtered per-user.

**Sidebar bug:** "Internat"/"Classes en direct de mon enfant" were built with
a two-way ternary assuming "not student → parent," which also caught teacher
(who renders the same nav block for their own portal entry) and routed them
to parent-only pages. Fixed to only add those two links for student/parent.

**Nav/landing bug (parent & student):** both roles were receiving the full
staff cross-module nav (Élèves, Présences, Finances, Communication...) because
several of their permission grants (`students.read`, `attendance.read`,
`grading.read`, `finance.read`, `communication.read`) exist for *self-service*
API access (reading their own/their child's data), not to open the staff-wide
admin module for that domain. Fixed: student/parent no longer receive the
staff manifest nav at all (only their own portal + hostel/live-classes links),
and `resolveLandingPath` now sends them to `/dashboard/student` /
`/dashboard/parent` instead of the generic (and, for them, empty) staff
overview.

**Transport dashboard bug:** `/dashboard/transport` (visible to anyone with
`transport.read` — teacher, receptionist, guard) immediately called an
overview API gated by the stricter `transport.report`, surfacing a raw
`Permission manquante` error on load for anyone without it. The overview is
just basic KPI counts (vehicles/routes/active allocations/today's trips), not
sensitive analytics, so it's now gated by `transport.read` to match the page
it lives on; `transport.report` stays reserved for the actual "Rapports &
Exports" deep-analytics page.

**Seed data fix:** the 6 demo parent login accounts (`parent.00N@atlas.ma`)
existed in `user` but were never linked to a `guardians` row — every parent
login was an orphan with zero visible children (causing "Profil tuteur
introuvable" on hostel/guardian and empty data everywhere). Linked 4 of them
to real guardian records with children, matched to the 4 students that already
have their own logins, so a parent/student pair can be tested end-to-end.

**Also fixed:** a broken production build, unrelated to any of the above —
the lockfile pinned `jose@5.10.0` while `better-auth`'s current version
requires `jose@^6.1.0`; `npm ci` was installing an invalid dependency tree and
`next build` was failing. Bumped to `jose@6.2.10`.

**Not yet re-verified / lower priority:** guardian-detail sub-fetches
(`/payments`, `/activity`) weren't individually re-checked for the same drift
pattern — the page-level block was the actual reported symptom and is fixed;
worth a pass if a similar "redirects on click" report comes up there.
