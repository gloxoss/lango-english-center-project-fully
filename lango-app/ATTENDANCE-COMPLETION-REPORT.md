# Attendance Module — Completion Report

Executed `ATTENDANCE-IMPLEMENTATION-PLAN.md` in full (Sections 1-7), autonomously
(`/nonstop`), 2026-07-31. All 7 sections complete; Section 7.2 (auto-save draft)
was deliberately skipped — the plan itself flagged it as optional.

## What was built

| Section | What | Files |
|---|---|---|
| 1 | Deleted 3 dead tables (`attendanceRegisters`/`Entries`/`AuditEvents`), migrated `attendanceSummary`/`Excuses`/`Flags` for real | `Schema.ts`, `Relations.ts`, `migrations/0026_*.sql` |
| 2 | Real flag detection: `UNJUSTIFIED_ABSENCE`, `CONSECUTIVE_ABSENCE`, `REPEATED_LATE`, dedupe + resolve-on-excuse | `src/libs/api/attendance-flags.ts`, wired into `attendance/route.ts` + `attendance/excuses/route.ts`, new `GET /api/attendance/flags` |
| 3 | Log-only SMS on absence via `guardianStudents` → `smsMessages` | `attendance/route.ts` |
| 4 | Admin excuses workspace (status tabs, approve/reject) | `attendance-excuses-view.tsx`, `dashboard/attendance/excuses/page.tsx`, sidebar nav |
| 5 | Director audit dashboard (KPIs, open flags by type, missing-register queue + reminder SMS) | `attendance-audit-view.tsx`, `dashboard/attendance/audit/page.tsx`, `GET/POST /api/attendance/audit-summary` |
| 6 | Student attendance heatmap (31-day calendar grid) | `student-attendance-heatmap.tsx`, `GET /api/attendance/heatmap`, embedded on `student-profile-view.tsx` |
| 7 | Extracted QR modal to its own component; confirmed no vestigial `attendanceMode`/register references remain | `qr-scanner-modal.tsx` |

## Deviation from the original plan: the migration bug

The plan expected a clean `drizzle-kit generate` + `docker compose up migrate`.
Instead, `generate` produced a migration that redeclared ~15 objects that
already existed live (a pre-existing snapshot desync in `migrations/meta/` —
migrations 0020-0025 were hand-authored without ever running `drizzle-kit
generate` for them, so no snapshot exists for that range). Root-caused,
fixed by applying the migration statement-by-statement with duplicate-object
exceptions caught and skipped (verified none were real drift, only genuine
pre-existing objects), then manually recording the migration's real sha256
hash in `drizzle.__drizzle_migrations` so `docker compose up migrate` is
idempotent going forward. Full writeup in `MIGRATION-NOTES.md`. **The
underlying snapshot gap for migrations 0020-0025 was not retroactively
fixed** — it needs a deliberate snapshot-regeneration pass, out of scope for
this plan; the next hand-authored migration will hit the same issue.

## Live verification performed (all real, all cleaned up after)

- Logged in as real `admin@lango.ma` (school_admin, Lango tenant) and
  `y.elamrani@atlas.ma` (Atlas tenant) via real `/api/auth/sign-in/email`.
- Marked a real student absent → confirmed a real `UNJUSTIFIED_ABSENCE` flag
  and a real `smsMessages` row (required inserting a temporary test
  guardian/`guardianStudents` link — none existed in seed data, a pre-existing
  gap noted but out of scope).
- Submitted + approved a real excuse for that absence → confirmed the flag
  resolved and `attendanceSummary.attendanceRate` recalculated correctly
  (50% → 100%).
- Marked a second real student absent 3 consecutive real weekdays → confirmed
  a real `CONSECUTIVE_ABSENCE` flag.
- Confirmed tenant isolation: Atlas session saw zero Lango flags/excuses.
- Post-rebuild: `/dashboard/attendance/excuses`, `/dashboard/attendance/audit`,
  `/dashboard/attendance` (QR-extraction regression check), and a real student
  profile page (heatmap embed) all returned real `200`s.
- `GET /api/attendance/audit-summary` returns honest zeros/empty arrays on a
  clean tenant — no fabricated KPIs.
- Marked a real student present/late on two real July dates, confirmed
  `GET /api/attendance/heatmap` reflected exactly those records.
- `npx tsc --noEmit` clean throughout; `docker compose build app` and
  `docker compose build migrate` both succeeded (foreground, not just
  typecheck) after every schema change.

## Known gaps carried forward (not part of this plan's scope)

- `guardian_students` has 0 rows tenant-wide in seed data — no real
  student-picker + linking UI exists yet (documented pre-existing gap, also
  noted in the earlier V2 audit). The SMS-on-absence and reminder features are
  real and correctly wired, but will silently no-op for every real student
  until that linking flow is built.
- `migrations/meta/` snapshot gap for 0020-0025 (see above) — needs its own
  fix, not attempted here to avoid further destabilizing the migration chain.
- Document upload for excuses (`attendanceExcuses.documentUrl`) remains a
  plain URL field, no real upload endpoint — flagged honestly in the UI
  rather than faked.
