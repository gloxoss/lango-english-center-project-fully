# Academic year analysis

## Contradiction 1: Organisation says 30/06/2026, Academic Years says 31/08/2026

**Verdict: duplicate storage, and the Organisation copy is stale and effectively unused.**

- Organisation page (`/settings/onboarding`) saves `academicYear`, `startDate`, `endDate` into `school_settings` (`app/api/settings/route.ts:120-122`) and dual-writes them to `setting_values` `academic.academicYear/startDate/endDate`.
- Academic Years page (`/academics/calendar`) reads and writes `session_years` (`/api/academics/session-years`).
- Nothing links the two. On 2026-09-25 the owner-approved production fix extended Atlas `session_years` 2025-2026 to 2026-08-31 (so migration 0154 could file 1,614 summer demo attendance rows); `school_settings` still says 2026-06-30. Same on dev: `school_settings` = `2025-2026 | 2025-09-01 | 2026-06-30`.
- Consumers: `session_years` is read by 58 runtime files. The `school_settings` year is read by one: `features/settings/services/onboarding-completeness.ts`. The registry keys `academic.academicYear/startDate/endDate` have 0 runtime readers.

Consequence: the Organisation page displays and edits a year nothing uses. A director who "changes the school year" there changes nothing in timetable, attendance, grades or finance.

Canonical source: `session_years`. The Organisation card should show it read-only with a link to Academic Years.

## Contradiction 2: on 25 Sep 2026, 2025-2026 is "active/default" and 2026-2027 "secondary"

**Verdict: lifecycle gap + seed.** Not a display bug.

- "Active" = `session_years.is_default`, a manual flag. It is set by school creation (super-admin create school / waitlist convert set the first year default) and by the Academic Years page (setting one default clears the others inside a transaction, `session-years/route.ts:62,94`). A `promotion-year-activation` test exists; whether the promotion flow switches the default was not traced in this audit.
- Nothing rolls it over when a year's dates end. No job, no warning.
- The seed created 2025-2026 as default and 2026-2027 as a future year; nobody switched.

Consequences today (Atlas, 2026-09-25):
- **Two different "current years" at the same time.** 26 files use `is_default` → 2025-2026 (students list, placements, timetable slots, report-card issue and view, promotions preview, transfers, teacher scope and portal, readiness, coverage, attendance reporting adapter, admissions). `/api/dashboard/summary` resolves by date → 2026-2027. The dashboard and the rest of the app describe different years.
- New placements, timetables and report cards are attached to a year that ended (on 2026-08-31).
- Attendance marked today is filed by date (migration 0154 rule) under 2026-2027, while the timetable it should follow is on 2025-2026.

## Structural gaps

- No DB guarantee of a single default year per tenant (only app transactions; 0 violations today).
- No DB guard against overlapping years (0 overlaps today; the only check is in app code, if any).
- Semesters have **no link to a session year** (`semesters`: id, tenant_id, name, start_month, end_month). The same two semesters apply to every year, and terms cannot differ per year.
- Two copies of `getDefaultSessionYearId` (teacher-service.ts:301, subject-teacher-assignment.ts:23).

## Recommendation (not implemented)

One resolver `resolveSchoolYear(tenantId, date?)` used everywhere; an explicit "open the new year" action with a pre-flight checklist (placements, timetable, fee structures); a warning banner when today is outside the default year; DB constraints: partial unique index on `(tenant_id) WHERE is_default` and an exclusion constraint on date ranges; semesters/terms per session year.
