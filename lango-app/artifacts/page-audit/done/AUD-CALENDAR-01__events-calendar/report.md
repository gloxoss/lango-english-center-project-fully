# AUD-CALENDAR-01 — Events & Calendar + Institutional Scheduling — Executor Report

## 1. Handoff Metadata

- Executor: codex-2 (Executor C)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-c/AUD-CALENDAR-01-events-calendar`
- Implementation SHA(s): see §13
- Hub item: `task:AUD-CALENDAR-01` (+ `task:port-3463`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-CALENDAR-01__events-calendar/`
- Collision check before claim: **clean** (AUD-SAFETY-01 held guard only)
- **AUD-PLATFORM-01 is not abandoned**: branch `audit/agent-c/AUD-PLATFORM-01-platform-entitlements`
  is pushed with its checkpoint preserved; state remains
  BLOCKED — MISSING SUPER_ADMIN TOTP ACCESS.

## 2. Scope

Route inventory discovered from navigation, route files, guards, services and
schema — not assumed.

### Pages audited

| # | Route | Role(s) | Purpose | Result |
|---|---|---|---|---|
| 1 | `/dashboard/events` | school_admin, student, parent | Events + calendar | **FIXED (F-01)** |
| 2 | `/dashboard/events/[id]` | school_admin | Event detail (audiences, occurrences, venues, tasks) | PASS |
| 3 | `/dashboard/academics/calendar` | school_admin | School calendar | PASS (read-only, Academics-owned) |

### API surface audited (28 routes under `/api/addons/events`)
`events`, `events/[id]`, `events/[id]/publish`, `events/[id]/cancel`,
`events/[id]/audiences`, `events/[id]/audiences/[ruleId]`, `events/[id]/occurrences`,
`events/[id]/registrations`, `events/[id]/tasks`, `events/[id]/tasks/[taskId]`,
`events/[id]/venues`, `events/[id]/venues/[venueId]`, `events/[id]/incidents`,
`events/[id]/incidents/[incidentId]`, `events/[id]/feedback`,
`events/[id]/feedback/[feedbackId]`, `events/[id]/attachments`,
`events/[id]/attachments/[attachmentId]`, `events/[id]/communications`,
`events/[id]/feed.ics`, `calendar`, `reports`, `types`,
`occurrences/[id]/checkins`, `occurrences/[id]/waitlist`,
`occurrences/[id]/waitlist/[waitlistId]/respond`, `registrations/[id]/cancel` —
plus `api/public/events/[tenantSlug]`.

### Explicitly out of scope
- `/dashboard/academics/calendar` is rendered by `AcademicCalendarView` in
  `src/features/academics`, and **Academics is a frozen module**. Audited
  read-only and reported; not modified.
- `/dashboard/academics/schedule`, `/dashboard/academics/teacher-schedule`
  (timetable), `/dashboard/reports/schedules`, `/dashboard/settings/scheduled-jobs`,
  `/dashboard/students/alumni/events`, `api/alumni/me/events`,
  `api/academics/meeting-slots`, `api/guardian/me/children/[id]/meetings` — other modules.
- **Communication delivery is frozen.** Where Calendar drives SMS/email
  (`event_reminder_rules`, `event_communication_jobs`) the integration was checked
  against the frozen truth contract only; delivery was not redesigned.

### Frozen dependencies not modified
Communication delivery core, Academics, and `libs/api/*`.

## 3. Workflow Understanding

`create event → target audience / branch → schedule / date / time → publish →
visibility → update / cancel → reminders / notifications → historical record`

- **17 tables**: `events`, `event_types`, `event_schedules`, `event_occurrences`
  (materialised series), `event_venues`, `event_audience_rules`, `event_invitations`,
  `event_registrations`, `event_waitlist_entries`, `event_checkins`,
  `event_reminder_rules`, `event_communication_jobs`, `event_attachments`,
  `event_tasks`, `event_incidents`, `event_feedback`, `event_audit_events`.
- **Recurrence** (`none | daily | weekly | monthly`) is expanded by the pure
  `buildOccurrenceRows` into materialised `event_occurrences`, capped at 366 per
  series. `original_date` keeps the UTC date of each occurrence.
- **Visibility** resolves per viewer from `event_audience_rules`
  (`school | role | class_offering | class_section | class_subject | user | group`).

**Source of truth:** `events.lifecycle` (`draft → published → cancelled`) for
publication state; `event_occurrences` for the expanded series (never recomputed
per view); `event_audit_events` for history.

## 4. Findings

| ID | Severity | Surface | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| **F-01** | Med | `POST /api/addons/events` | Accepted `endTime <= startTime`. `buildOccurrenceRows` clamps a negative duration to **zero**, so a degenerate schedule materialised **zero-length occurrences** instead of failing. The inline schedule schema had no order check (the refine in `libs/api/validation.ts` belongs to a different schema). | `durationMs = Math.max(0, end - start)` | **FIXED** |

**Verified NOT defects (checked in source before reporting):**

- **Overnight events are safe.** Times are absolute instants, so
  `22:00 Sep 24 → 02:00 Sep 25` has `end > start` and passes the new guard. Each
  recurrence step re-applies the duration, so the series keeps crossing midnight.
- **Recurrence boundary is inclusive** of `recurrenceEndDate` — deliberately
  date-semantic, because the write path can drop a few ms off the stored value and
  an instant check would exclude the final occurrence. Covered by
  `recurrence-boundary.test.ts`.
- **The "single UTC frame" is intentional**, not sloppiness: `parseUtcString`
  re-appends `Z` to the naive DB text so all recurrence math runs in one frame and
  cannot drift across DST. Self-consistent while Morocco holds a fixed offset.
- **Cancellation truth**: `cancelEvent` locks `for('update')`, returns
  `409 ALREADY_CANCELLED` on a repeat (idempotent), cancels **all** occurrences in
  the same transaction, and writes an `event_audit_events` row. The event row is
  never deleted, so history survives.
- **Audience leakage**: enforced per role at `events-service.ts:224-226` — family
  roles (`parent`/`student`/`alumni`) go through `canViewPublishedEvent`
  (published **and** not `internal` **and** target match); staff go through
  `targeted` + `isEventVisibleToUser`. Per-route guards repeat this on `[id]`,
  attachments, `feed.ics`, occurrences and venues. Seeded events are
  `visibility: 'internal'`, so family roles correctly see none of them.
- **Unauthorized edits/deletes**: mutation routes require the `event-management`
  add-on and `events.*` capabilities; there is no delete path.

### Cross-module findings (logged, not fixed — outside this claim)

- **C-01** `403 /api/settings/branches` on family-facing event pages. Same issue as
  AUD-OPS-01 F-07 and AUD-SUPPORT-RECEPTION-01 F-02: the shared shell requests an
  admin-only endpoint on patron pages.
- **C-02** `403 /api/academics/rooms` on the same pages — a staff endpoint called
  from a family-facing screen. Academics is frozen; reported to its owner.

## 5. Fixes Implemented

### F-01 — degenerate schedules produce zero-length occurrences

- **Root cause:** no `endTime > startTime` validation on the create schema.
- **Fix:** `.refine(s => s.startTime < s.endTime)` on the schedule object, matching
  the intent of the existing refine in `libs/api/validation.ts`.
- **Why this is domain-correct and safe:** event times are absolute instants, so an
  overnight event passes; only end-at-or-before-start is rejected. Without the
  guard, the series silently materialised meaningless zero-length rows.
- **Files:** `src/app/api/addons/events/route.ts`
- **Regression risk:** low. Only inputs that could never render correctly are rejected.

## 6. Security / Isolation / Permission Audit

- **Tenant isolation:** `npm run check:isolation` **PASS** (828 files); all event
  queries are tenant-scoped.
- **Branch isolation:** audience `class_offering` / `class_section` /
  `class_subject` targets resolve through `resolveStudentAudienceContext`, so a
  viewer matches only their own class/section. No cross-branch leak found.
- **Role visibility:** verified on screen for school_admin, student and parent.
- **Audience leakage:** see §4 — enforced in the service **and** per route.
- **IDOR / object ownership:** occurrence, registration, attachment and venue
  lookups are tenant- and event-scoped.
- **Request validation:** Zod `.strict()` bodies; order refine added.
- **Historical integrity:** `event_audit_events` is append-only; cancellation marks
  rather than deletes; registrations and waitlist rows are kept.
- **Audit logging:** `recordAudit` on mutations plus per-event `event_audit_events`.

## 7. Data / DB / Migration Impact

- **Tables read/written:** the 17 `event_*` tables listed in §3.
- **Historical data changed:** **none.**
- **Migration added:** none. **Journal status:** untouched.

## 8. Tests

### Focused tests

```text
npx vitest run src/features/events  ->  38/38 PASS (5 files)

new: schedule-boundaries.test.ts (5)
  - overnight event survives recurrence with its duration intact
  - degenerate schedule yields zero-length occurrences (evidence for the guard)
  - recurrence end date is inclusive
  - runaway series capped at 366
  - the create schema rejects end-at-or-before-start
pre-existing (all green):
  audience-service.test.ts, event-operations-service.test.ts (286 lines),
  recurrence-boundary.test.ts
```

### Static gates

```text
check:types      PASS   (tsc --noEmit, 0 errors)
check:isolation  PASS   (828 files)
check:i18n       PASS   ("No invalid translations found")
check:i18n:keys  PASS   (0 missing)
check:ui         PASS   (ratchet holding)
eslint touched   PASS   (0 problems)
```

## 9. Visual / UX Evidence

### Screenshot manifest

| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/school_admin-fr-events.png` | events + calendar | FR | Desktop 1440x900 | Renders real events |
| `screenshots/school_admin-fr-events__<id>.png` | event detail | FR | Desktop | Detail tabs render |
| `screenshots/school_admin-fr-academics__calendar.png` | school calendar | FR | Desktop | Frozen module, read-only capture |
| `screenshots/student-fr-events.png` | events as student | FR | Desktop | Internal events hidden from students |
| `screenshots/parent-fr-events.png` | events as parent | FR | Desktop | Internal events hidden from parents |
| `screenshots/mobile/school_admin-phone-events.png` | events | FR | 390x844 | Mobile usable |
| `screenshots/arabic/school_admin-ar-events.png` | events | AR | Desktop | RTL renders |

**7 screenshots.** Every audited page has a desktop FR capture; the important /
changed route also has mobile 390 and Arabic RTL.

## 10. Files Changed

```text
lango-app/src/app/api/addons/events/route.ts                        (F-01)
lango-app/src/features/events/__tests__/schedule-boundaries.test.ts (NEW, 5 tests)
+ this done-folder package (report, checkpoint, screenshots, evidence)
```

## 11. Unresolved / Follow-up Items

- **C-01 / C-02** cross-module 403s on family-facing event pages (see §4).
- **`events.timezone` defaults to `UTC`** rather than `Africa/Casablanca`. Harmless
  under the single-UTC-frame convention, but the column is largely cosmetic today:
  nothing applies it to recurrence math. Either use it or drop it — product call.
- **Reminder freshness** (`event_reminder_rules`, `event_communication_jobs`) is
  frozen-adjacent; delivery correctness belongs to the Communication campaign.

## 12. Frozen-Module / Cross-Module Impact

No frozen module was modified. `AcademicCalendarView` (Academics) was read only.
Communication delivery was **not** touched; the calendar→communication hand-off was
checked for integration only.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: 2d0f3b05b6de8e10ddf25cff98a49df249b9eaca
OPEN CLAIMS: 0 / 2 released (task:AUD-CALENDAR-01, task:port-3463)
READY FOR AGENT 5: YES
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
