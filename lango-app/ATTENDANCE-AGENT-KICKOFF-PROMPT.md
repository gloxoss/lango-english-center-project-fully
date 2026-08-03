# Kickoff prompt for the attendance-system agent

Copy everything in the fenced block below and give it to a fresh agent (new
session, background `Agent` call, or worktree-isolated session — the prompt
is fully self-contained, assumes no prior conversation context). This is a
corrected version of an earlier handoff draft — two file-path errors and one
dangerous verification gap were found and fixed before this version was
written; see `ATTENDANCE-PROMPT-REVIEW.md` (repo root) for the full review
if you want the reasoning behind the corrections.

---

```
You are working on SchoolOS/Lango, a Next.js 16 App Router + Drizzle ORM +
PostgreSQL 17 + Better Auth multi-tenant school-management SaaS, built for
Moroccan K-12 schools and language centers.

Working directory:
c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\lango\lango-english-center-project-fully\lango-app

Two directories you'll also need are ONE LEVEL ABOVE the working directory
above, at:
c:\Users\oussama\oussama\OneDrive - 雪玲团队\Documents\lango\
  - PRODUCT-TRUTH.md               (product vision, non-negotiables)
  - attendance-plan\                (the full attendance spec suite, see below)

## Read these first, in this order, before writing any code

1. `CLAUDE.md` (in the working directory root) — behavioral rules: simplicity
   first, surgical changes, no speculative abstractions.
2. `MIGRATION-NOTES.md` (working directory root) — read the whole thing, but
   pay specific attention to the "stale migrate image" and "migration
   generated but never applied" incidents documented there. This exact class
   of bug is the single most important thing to avoid in this task — see
   step 0 below, it is not hypothetical.
3. `ATTENDANCE-PROMPT-REVIEW.md` (working directory root) — an audit of the
   attendance module's actual current state, done by checking every claim
   against the real repository rather than trusting assumptions. It found
   the schema/routes/UI are genuinely built (not fake), but the new schema
   has never been migrated to the live database. Read this before assuming
   anything in the attendance-plan docs below reflects working software.
4. `..\PRODUCT-TRUTH.md` — product vision: SchoolOS is a real, usable,
   localized (French/Arabic) school OS. CNDP (Moroccan data-privacy law
   09-08) compliance and MAD currency are non-negotiable, not nice-to-haves.
5. `..\attendance-plan\00_MASTER_INDEX.md`, then in order:
   `01_PRODUCT_CONTEXT.md` (4 personas, 30-second intake workflow goal),
   `02_DESIGN_SYSTEM.md` (design tokens: 44px min touch targets, status
   colors Present `#1B6C93` / Late `#B45309` / Absent `#991B1B` / Excused
   `#6B21A8`, sticky mobile bottom submit bar — this file is the design
   reference; there is no separate "SCHOOLOS_ATTENDANCE_DESIGN.md", don't
   go looking for one), `04_TECHNICAL_IMPLEMENTATION_PLAN.md` (the roadmap),
   and all 5 files under `..\attendance-plan\sections\`.

## Step 0 — REQUIRED FIRST, before any feature work

Confirmed by direct grep of every file in `migrations\*.sql`: the tables
`attendance_registers`, `attendance_entries`, `attendance_summary`,
`attendance_excuses`, `attendance_flags`, `attendance_audit_events` exist in
`src\models\Schema.ts` and are queried by real code in
`src\app\api\attendance\summary\route.ts` and
`src\app\api\attendance\excuses\route.ts` — but **no migration file creates
any of them in the live database.** These routes will fail the moment
they're called for real. Fix this before touching anything else:

1. Check `migrations\*.sql` for the actual latest migration number (don't
   assume — other work may have landed since this prompt was written).
2. If no migration for these 6 tables exists, generate one:
   `npx drizzle-kit generate --name=add_attendance_registers_and_related`
3. **`app` and `migrate` are separate Docker images with independent build
   caches** — this bit this project hard before (full incident writeup in
   `MIGRATION-NOTES.md`). After generating the migration:
   `docker compose build app` AND `docker compose build migrate`
   (both, explicitly — building one does not rebuild the other).
4. `docker compose up migrate` — read its output for
   `[✓] migrations applied successfully!`, then INDEPENDENTLY confirm via
   `docker compose exec db psql -U schoolos -d schoolos -c "\dt"` that the
   6 tables genuinely appear. Do not trust the migrate log alone — a stale
   cached image can report success while silently applying nothing (this
   happened twice already in this project's history).
5. `docker compose up -d`, log in with a real seeded account (see test
   accounts below), hit `GET /api/attendance/summary` and
   `GET /api/attendance/excuses` for real, confirm `200` not a 500.
6. **Investigate and document the relationship between the old simple
   `attendance` table (studentId/date/status — what
   `POST /api/attendance`, the dashboard summary, class-results, and
   analytics already depend on) and the new 6-table model.**
   `src\libs\api\attendance-summary.ts`'s `recalculateStudentAttendanceSummary`
   is supposed to bridge them — read it and confirm it actually reads from
   the old table and writes into `attendanceSummary`, not that the two
   systems are silently disconnected. Write what you find as a short
   section in `MIGRATION-NOTES.md` before proceeding — this determines
   whether "enhance the event pipeline" (task 2 below) is extending a real
   bridge or building on top of a gap.

Do not proceed past this step until `GET /api/attendance/summary` and
`GET /api/attendance/excuses` both return real 200s against real data for a
real logged-in test account.

## Your task (from here, follow the original spec)

Once step 0 is done, work through the attendance-plan sections in order
(`section-01` through `section-05`), comparing what's already built against
each section's spec, and enhance/complete what's missing:

1. **Event-driven dispatch**: confirm/build `AttendanceSubmitted` triggering
   a non-blocking background job that (a) marks `UNJUSTIFIED_ABSENCE` flags
   into `attendanceFlags` and (b) logs a simulated SMS via the existing
   log-only `smsMessages` system (`src\app\api\communication\messages`) —
   **do not integrate a real SMS carrier**, this app has none and the
   existing pattern everywhere else is honest log-only simulation with a
   visible "Mode simulation" banner in any UI that surfaces it.
2. **UI ergonomics in `attendance-view.tsx`**: verify (don't assume) the
   claimed features actually work end-to-end: low-attendance warning badges
   (<80%, sourced from real `attendanceSummary.attendanceRate`), the QR
   scanner modal, "Tout Présent"/"Tout Absent" quick actions, sticky mobile
   submit bar, 44px touch targets per the design doc.
3. **Administrative screens**: build/complete `/dashboard/attendance/excuses`
   (document review side-drawer, approve/reject against real
   `attendanceExcuses` rows) and `/dashboard/attendance/audit` (real
   director-facing risk metrics from `attendanceAuditEvents`/`attendanceFlags`
   — no invented numbers, same discipline as every other page in this app:
   an honest empty state beats a fabricated KPI).

## Conventions (already established everywhere else in this app — follow them)

- Every route: `requireRequestContext(request, allowedRoles)` →
  `requireTenant(context)` → Zod `.strict()` schema
  (`src\libs\api\validation.ts`) → tenant-scoped Drizzle query →
  `parsePagination` on GET → `recordAudit()` on mutations →
  `apiErrorResponse()` catch-all.
- Test accounts (all share one password):
  - `y.elamrani@atlas.ma` / `Admin123!` — school_admin, Atlas tenant
  - `admin@lango.ma` / `Admin123!` — school_admin, Lango tenant
  - A teacher account exists too — check `src\scripts\seed.ts` for its
    email if you need the `teacher` role specifically for intake-flow
    testing.
- **Never trust `npx tsc --noEmit` alone.** The authoritative check is
  `docker compose build app` in the foreground. Migrations need
  `docker compose build migrate` explicitly, every time, per Step 0.
- Live-verify with real HTTP after building, not just typecheck: create
  real attendance data, confirm a second tenant's session never sees it,
  confirm anonymous/wrong-role access is rejected.
- Clean up any test data you create during verification.

## What to deliver when done

1. Update `MIGRATION-NOTES.md` with what you did in Step 0 (migration
   number, what the dual-model investigation found) and a summary of the
   feature work, matching the style of the existing entries in that file.
2. A short completion report (`ATTENDANCE-COMPLETION-REPORT.md`) — what was
   built, every live-verification test you actually ran and its real
   result, any deviation from the attendance-plan spec and why.
3. A manual testing guide addition — step-by-step, real accounts, real
   clicks, what a reviewer should see if it's working. Append to
   `V2-MANUAL-TESTING-GUIDE.md` if it exists, otherwise create
   `ATTENDANCE-MANUAL-TESTING-GUIDE.md`.

If you hit a decision only the project owner can make (e.g. how strict the
"unjustified absence" threshold should be, or whether excuses need a
document upload vs. text-only reason), stop and ask rather than guessing —
don't invent a business rule the spec docs don't state.
```
