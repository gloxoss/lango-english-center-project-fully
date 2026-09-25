# Phase 1 — Timetable-driven attendance / "Appel du jour"

Branch: `enhancement/agent-b/IMPL-ATTENDANCE-REFORM-01-integrated`
Commit: `15edc4fd` (backend). **UI NOT YET BUILT — see "Remaining" below.**

## What landed

### The canonical session occurrence

Attendance had no link to the timetable. A register was identified by
`(class_section, date, period)`, where `period` is a number 1–8 the teacher picks
from a hardcoded list. Nothing connects that number to a lesson, so the strongest
question the data could answer was *"does this SECTION have a mark today"* — which
is why one completed lesson hid every other unmarked lesson of the same section,
and why "registres manquants" could never name the lesson actually missing.

The canonical identity is now:

```
class_schedule_slots  ×  date   (under the published, effective version)
```

A slot already carries section, subject, teacher, start/end time, room and
version, so `(slot, date)` names one scheduled lesson **without** materialising a
row per school day. Phase 6's exceptions (cancellation, substitution, room
change, reschedule) attach to that same identity.

### Migration `0158_attendance_session_occurrence.sql`

Additive, non-destructive, idempotent:

| Change | Why it is safe |
|---|---|
| `attendance_registers.class_schedule_slot_id` (nullable uuid) | No existing row is invalidated |
| `attendance_registers.timetable_version_id` (nullable uuid) | Same |
| Two FKs, `ON DELETE SET NULL` | Removing a timetable slot can never destroy attendance history |
| Partial unique index on `(tenant, slot, date) WHERE slot IS NOT NULL` | Only governs session-keyed rows; legacy rows keep the legacy key, so the two key spaces cannot collide |
| Lookup index on `(tenant, slot, date)` | For "the register of this occurrence" and the missing-register scan |

**No row is rewritten, migrated or deleted.** `period` and every legacy column are
untouched, so historical registers stay readable and answerable.

> Numbering note: this is `0158`, not `0157` — `0157_alumni_events_lifecycle_and_waitlist`
> already holds that number.

### `src/libs/attendance/session-occurrence.ts`

The single resolver every consumer will use, so the admin Appel du jour, the
teacher's current lesson, missing registers, alerts, the kiosk and reporting
cannot disagree:

- `resolveEffectiveTimetableVersion(tenantId, date)` — published **and** effective
  on the date; drafts and superseded versions never create an expectation.
- `listSessionOccurrences({tenantId, date, branchId?, teacherId?, classSectionId?})`
  — the day's lessons. Callers pass the actor's scope; the function does no
  authorization of its own.
- `loadRegisterIndex` / `registerForOccurrence` — resolves the register for an
  exact occurrence **first**, falling back to the legacy `(section, period)` key.
- `occurrenceState` — `A_VENIR` / `EN_COURS` / `A_COMPLETER` / `POINTAGE_TERMINE`
  / `CORRIGE` / `ANNULE`.
- `missingOccurrences` — ended occurrences with no valid register.

`period` is now **derived** as the lesson's ordinal within its section's day, so a
session-keyed register still writes a meaningful value into the legacy column
rather than a fabricated `1`.

### Phase 0.5 closed

`audit-summary`'s "registres manquants" now answers from exact occurrences:
an ended lesson is missing only when **no register answers for that occurrence**.
One completed lesson can no longer hide another. The phase 0 date classification
is preserved inside `missingOccurrences` — a past date is over in full, a future
date is a preview only, today is judged on the Casablanca wall clock.

## A bug my own test caught

Test `SC.11` failed on first run: `occurrenceState` returned `POINTAGE_TERMINE`
for an *unregistered* lesson on a past date. The state name claims attendance was
taken when none exists. The date now decides only whether a lesson is **over**,
never whether a register exists; a past unregistered lesson is `A_COMPLETER`
(overdue). Fixed in `15edc4fd`.

## Evidence

| Test | Proves |
|---|---|
| SC.1 | A day lists one occurrence per lesson, with a derived ordinal |
| **SC.2** | **Registering only the FIRST lesson still reports the second as missing** — the phase 0.5 limitation, closed |
| SC.3 | Registering both leaves nothing missing |
| **SC.4** | **A legacy register with no slot still answers for its own lesson** — old history is not retroactively "missing" |
| SC.5 | The index resolves by exact occurrence first |
| SC.6–SC.11 | State machine: à venir / en cours / à compléter / pointage terminé / corrigé / annulé, and past-vs-future dates |
| SC.12 | `missingOccurrences` ignores a future date entirely |

`attendance*`, `*/qr*`, `*teacher*`, `*workforce*`, `*audit-summary*`: **265 passed
across 28 files**, including `attendance-calendar-p0` and
`attendance-missing-register-truth`. `npm run check:types` exit 0.

## Remaining in phase 1

The **admin UI is not built.** `/dashboard/attendance` still renders the legacy
`attendance-client.tsx` picker (class / subject / period 1–8). The backend it
would call is now in place, but no route yet serves the day view:

- `GET /api/attendance/day?date=` returning occurrences with their state
- the `Appel du jour` screen: chronological session cards, status chips,
  past = view-only, today = operational, future = preview
- `Corriger le registre` with mandatory reason + before/after audit
  (the existing REOPENED/reason path is preserved and would be reused)

## Environment note

`npx drizzle-kit migrate` exits 1 against `schoolos_audit` without printing an
error — the database has **163** applied migrations against a **160**-entry
journal, so the bookkeeping is already out of sync there. This is pre-existing and
unrelated to 0158. The migration's SQL was applied statement-by-statement and
verified idempotent; both columns and the index exist. Deployments should confirm
their own migration bookkeeping before relying on `db:migrate`.
