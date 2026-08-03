# Attendance Module — Full Implementation Plan

## Context

This supersedes `ATTENDANCE-AGENT-KICKOFF-PROMPT.md`'s Step 0 with a fully-traced, precise picture of the actual current state — not just "something's wrong," but exactly what, where, and the cleanest fix. Built by reading every relevant file (schema, all 3 attendance routes, the summary helper, the full UI, and all 5 `attendance-plan/sections/*.md` spec files) rather than trusting either the spec or the earlier review's surface-level pass.

**The real state, precisely:**

| Piece | Status |
|---|---|
| `attendance` (old simple table) | ✅ Real, working, pre-existing. The actual source of truth — `POST /api/attendance` writes here. |
| `attendanceSummary` | ✅ Real logic, correctly bridged — `recalculateStudentAttendanceSummary` reads from `attendance` (not the empty `attendanceEntries` the spec assumed) and writes here. Just needs the migration applied. |
| `attendanceExcuses` | ✅ Real, self-contained CRUD, correctly closes the loop: approving an excuse updates the real `attendance.status` to `excused` and recalculates the summary. Just needs the migration applied. |
| `attendanceRegisters` / `attendanceEntries` | ❌ Pure dead weight. Zero writes anywhere in the codebase (grepped, confirmed). `attendanceRegisters.classId` has a real FK to `studentGroups.id` — the dead LMS table this project has already hit and fixed once before (Section 20's `timetableSlots`). Recommendation below: **delete both, don't migrate them.** |
| `attendanceFlags` | ⚠️ Real, correct schema (no dead-table FKs), but nothing writes to it yet. Needs real detection logic (Section 2 below). |
| `attendanceAuditEvents` | ❌ Redundant. This app already has a generic `auditLogs` + `recordAudit()` system used everywhere, including already on the excuses route. A bespoke second audit table for one module duplicates it for no benefit. **Recommendation: delete, don't migrate.** |
| `attendance-view.tsx` (mobile intake) | ✅ Real: quick actions, 44px targets, low-attendance badges (real, sourced from `attendanceSummary.attendanceRate`), QR manual-entry fallback that genuinely marks the roster before submit. Missing: the spec's claimed "auto-save brouillon" (draft persistence) was never built — minor, optional. |
| `/dashboard/attendance/excuses` (admin UI) | ❌ Not built. Backend is real and ready; no page. |
| `/dashboard/attendance/audit` (director dashboard) | ❌ Not built at all, backend included. |
| QR scanner as its own component | ⚠️ Inline in `attendance-view.tsx`, not extracted to `qr-scanner-modal.tsx` per spec. Low priority — it works where it is. |
| Student attendance heatmap | ❌ Not built. Zero files. |
| Event-driven SMS-on-absence | ❌ Not built. `POST /api/attendance` never touches the `smsMessages` log-only system. |
| Missing-register detection | ❌ Not built — but Section 20 (real timetable/scheduling, done earlier this session) now makes this genuinely buildable for the first time: compare today's real `classScheduleSlots` against submitted `attendance` rows. |

## Architecture decision (made now, not left open)

**Drop `attendanceRegisters`, `attendanceEntries`, and `attendanceAuditEvents` from `Schema.ts` entirely. Do not migrate them.** Reasoning:
- They are 100% unused — not a partially-built feature, genuinely zero references in application code.
- The real system already achieves the register spec's practical goal (idempotent per-student-per-date-per-period correction) via `attendance`'s existing delete-then-reinsert pattern in the transaction — without needing a separate DRAFT/SUBMITTED/LOCKED lifecycle table.
- `attendanceAuditEvents` duplicates the already-real, already-used `auditLogs`/`recordAudit()` system for no functional gain.
- This also makes the `studentGroups` dead-table FK bug moot — the offending table is removed, not patched, consistent with how every other dead-LMS-table situation has been handled this session (never resurrect `courses`/`programs`/`studentGroups`, extend the real `classSections`-based model instead).
- If register-level locking (an admin "reopen with mandatory reason" workflow) turns out to be genuinely wanted later, it's a clean, small addition on top of the real `attendance` table then — not lost by dropping the currently-empty tables now.

This keeps exactly 4 new tables: `attendanceSummary`, `attendanceExcuses` (both already real), `attendanceFlags` (real schema, needs logic), and nothing else. Simpler, and matches what's actually built.

---

## Section 1 — 🔴 Foundation fix (do first, blocks everything else)

1.1. In `src/models/Schema.ts`: delete the `attendanceRegisters` and `attendanceEntries` table definitions and their enums (`attendanceRegisterStatus` if unused elsewhere — confirm), and delete `attendanceAuditEvents`. Remove any dangling relations in `src/models/Relations.ts` that reference them.
1.2. Confirm `attendanceFlags.attendanceEntryId` (currently FKs to the now-deleted `attendanceEntries.id`) — change this column to reference something real instead: either drop it (flags don't strictly need a pointer back to a specific entry, `studentId` + `detectedAt` + `type` is enough context) or repoint it to the real `attendance.id`. Recommend dropping it — simpler, and the flag's `type` + `studentId` + `detectedAt` already tell the whole story.
1.3. Check the current migration list (`ls migrations/*.sql`, don't assume the number) and generate the migration: `npx drizzle-kit generate --name=add_attendance_summary_excuses_flags`.
1.4. `docker compose build app` AND `docker compose build migrate` (both, explicitly — this project's own `MIGRATION-NOTES.md` documents two separate incidents where skipping one silently broke things).
1.5. `docker compose up migrate`, then independently confirm via `docker compose exec db psql -U schoolos -d schoolos -c "\dt"` that `attendance_summary`, `attendance_excuses`, `attendance_flags` exist — and confirm `attendance_registers`/`attendance_entries`/`attendance_audit_events` do NOT (proving the cleanup actually took, not just that something applied).
1.6. Live-verify: log in as a real teacher, mark a real class's attendance via the real UI, confirm `GET /api/attendance/summary` now returns real non-empty data for those students, confirm the low-attendance badge appears correctly for a student marked absent enough times to drop under 80%.

**Verify:** `npx tsc --noEmit` clean; the 3 checks above pass with real HTTP, not just build success.

---

## Section 2 — 🟠 Real flag detection (the automated risk-monitoring the product spec promises)

Currently `attendanceFlags` has correct schema and zero writers. This section makes the 3 flag types in the product spec real, computed from the real `attendance` table (not a background job queue — this app has no job infra; compute synchronously at write time, same pattern `recalculateStudentAttendanceSummary` already uses).

2.1. New helper `src/libs/api/attendance-flags.ts`, exporting `detectAndRecordFlags(tenantId, studentId, executor)`:
   - `UNJUSTIFIED_ABSENCE`: if the just-written record for this student/date is `status: 'absent'` and no `attendanceExcuses` row exists for that student+date, insert an `attendanceFlags` row (`type: 'UNJUSTIFIED_ABSENCE'`, `status: 'OPEN'`).
   - `CONSECUTIVE_ABSENCE`: query the student's last 3 calendar school days' `attendance` rows (skip weekends — reuse whatever holiday/weekend logic already exists in this app, check `src/libs/` first before writing new date logic); if all 3 are `absent`, insert a flag (dedupe — don't insert a duplicate open flag for the same student if one's already `OPEN`).
   - `REPEATED_LATE`: count `status: 'late'` rows for this student in the current calendar month; if `>= 5`, insert a flag (same dedupe rule).
2.2. Call `detectAndRecordFlags` from `POST /api/attendance` (`src/app/api/attendance/route.ts`), right after `recalculateStudentAttendanceSummary`, inside the same transaction.
2.3. When an excuse is approved (`PATCH /api/attendance/excuses`, already updates `attendance.status` to `excused`) — also resolve any `OPEN` `UNJUSTIFIED_ABSENCE` flag for that student/date (`status: 'RESOLVED'`), since the absence is no longer unjustified.
2.4. `GET /api/attendance/flags` (new, small route) — school_admin/teacher, tenant-scoped, filterable by `status`/`type`, joined to student name — this is what Section 4's audit dashboard will read.

**Verify:** mark a real student absent 3 school-days in a row via the real UI, confirm a real `CONSECUTIVE_ABSENCE` flag row appears; approve an excuse for one of those days, confirm the corresponding `UNJUSTIFIED_ABSENCE` flag (if any existed for that specific date) resolves; confirm flags are tenant-scoped (second tenant never sees them).

---

## Section 3 — 🟠 Event-driven SMS-on-absence (log-only, matching this app's established honesty pattern)

Per the product spec's async pipeline, but implemented consistent with how every other "SMS" feature in this app already works: a real log row via the existing `smsMessages` system, never a real carrier call, with a visible simulation indicator wherever it surfaces in UI.

3.1. In `POST /api/attendance`'s transaction, after a status is saved as `absent` and a real `UNJUSTIFIED_ABSENCE` flag is created (Section 2): insert a real `smsMessages` row (reuse the existing table/pattern from `src/app/api/communication/messages`) addressed to the student's primary guardian (resolve via `guardianStudents`, same lookup pattern already built for Section 18's access-reset feature), `status: 'sent'` immediately, body something like "Absence non justifiée signalée pour {studentName} le {date}."
3.2. If no guardian is linked (a real, honest edge case — don't fail the whole attendance save over it), skip the SMS silently and don't error the request.
3.3. Surface these in the existing `dashboard/communication/reminders` send-log view (already real) so they're visible somewhere, not just written and forgotten.

**Verify:** mark a real student (with a real linked guardian from earlier session testing patterns) absent, confirm a real `smsMessages` row appears in the communication log with the right body and `status: 'sent'`; mark a student with no linked guardian absent, confirm the attendance save still succeeds.

---

## Section 4 — 🟠 Admin excuses workspace (backend already real, just needs UI)

4.1. `src/app/[locale]/(dashboard)/dashboard/attendance/excuses/page.tsx` (note the real route convention includes `[locale]` — the spec file omitted it, don't copy that mistake) + `src/features/attendance/ui/attendance-excuses-view.tsx`.
4.2. Status filter tabs (`PENDING`/`APPROVED`/`REJECTED`) wired to real `GET /api/attendance/excuses?status=`, date-range + student-search filters (client-side against fetched data, matching the pattern used everywhere else in this app).
4.3. Document-review side drawer: shows the real `documentUrl` (if the student/guardian attached one) — check whether excuse submission currently accepts a file upload at all, or just a URL string; if it's just a string field with no real upload endpoint behind it, either wire a real upload (reuse `src/libs/api/uploads.ts`, same tenant-namespaced pattern as every other upload in this app) or be honest in the UI that document attachment isn't wired yet — don't fake a working upload button.
4.4. Approve/Reject buttons call the real `PATCH /api/attendance/excuses`.
4.5. Add the sidebar nav entry for this page if missing (`src/components/shared/sidebar.tsx`).

**Verify:** submit a real excuse (as whatever role can — check the POST route's allowed roles), approve it as school_admin, confirm the underlying `attendance` row really flips to `excused` and the student's real attendance rate updates on their profile.

---

## Section 5 — 🟠 Director audit dashboard (mostly new — real data now exists to power it)

5.1. `src/app/[locale]/(dashboard)/dashboard/attendance/audit/page.tsx` + `src/features/attendance/ui/attendance-audit-view.tsx`.
5.2. New aggregate route `GET /api/attendance/audit-summary` (school_admin only):
   - Overall attendance rate: real average of `attendanceSummary.attendanceRate` across the tenant's students.
   - Students at risk: real count where `attendanceRate < 80`.
   - Open flags by type: real counts from `attendanceFlags` (Section 2).
   - **Missing registers today**: genuinely computable now thanks to Section 20's real scheduling — for each real `classScheduleSlots` row scheduled for today, check whether a corresponding `attendance` row exists for that class-section/period/date; list the gaps. This was impossible before Section 20 existed; it's real now.
5.3. "Send Reminder SMS" button on a missing-register row — reuse the same log-only `smsMessages` pattern as Section 3, addressed to the assigned teacher (real `classScheduleSlots.teacherId`), not a guardian.
5.4. KPI cards render only real numbers from 5.2 — no placeholder/invented figures, matching every other dashboard in this app.

**Verify:** create a real scheduled slot for today with no attendance submitted, confirm it shows in the missing-register queue; submit attendance for it, confirm it disappears from the queue; confirm the at-risk count matches a manual count of students under 80%.

---

## Section 6 — 🟡 Student attendance heatmap (net-new component, no backend gap)

6.1. `src/features/students/ui/student-attendance-heatmap.tsx` — 31-day grid, real data from a new small route `GET /api/attendance/heatmap?studentId=&month=` (or extend `student-profile-view.tsx`'s existing detail fetch) pulling real `attendance` rows for that student/month, colored per the spec's real status-to-color mapping.
6.2. Weekend/holiday cells greyed out — reuse whatever calendar/holiday logic already exists in this app (check first, don't invent a second Moroccan-holiday calendar if one already exists from the academic-calendar work).
6.3. Embed on `student-profile-view.tsx` (already has an honest "grading module not available" empty card pattern to follow for consistency, and now a real attendance section to add alongside it).

**Verify:** view a real student's heatmap, confirm the colors match their actual daily `attendance` rows for the month, confirm a student with zero attendance rows shows an honest empty grid, not fabricated data.

---

## Section 7 — 🟢 Polish (do last, small and optional)

7.1. Extract the inline QR modal in `attendance-view.tsx` into its own `src/features/attendance/ui/qr-scanner-modal.tsx` component per the spec — cosmetic refactor, not a functional gap, do only if time remains.
7.2. Auto-save draft for in-progress (unsubmitted) attendance marking — the spec claims this exists, it doesn't. If wanted: `localStorage`-based per-class/date/period draft persistence, restored on page reload before submit. Genuinely optional — the current single-session batch-submit flow is honest and functional without it.
7.3. Confirm the `attendanceMode`/`DAILY` vs `PER_SESSION` distinction from the spec's Section 01 is actually meaningful in the real UI (the `period` field already exists and is used) or if it's vestigial language left over from the now-deleted register model — clean up any dead references.

---

## Execution notes

- Same discipline as every other section this session: never trust `tsc --noEmit` alone, `docker compose build` both images explicitly after any migration, live-verify with real HTTP and real tenant isolation, clean up test data, update `MIGRATION-NOTES.md` per section.
- Sections 2-6 depend on Section 1 (the migration). Section 5's missing-register feature specifically depends on Section 20's real scheduling data already existing (it does, confirmed this session) — don't build it against fabricated schedule data.
- If Section 1's architecture decision (dropping the 3 tables) is unwanted for reasons not visible from this codebase-only review — say so before Section 1 executes; everything after it assumes that decision stands.
