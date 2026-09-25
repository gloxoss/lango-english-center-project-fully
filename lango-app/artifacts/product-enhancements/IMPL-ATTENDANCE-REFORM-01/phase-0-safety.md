# Phase 0 — Safety + data truth

Status: **4 of 5 complete, 1 partial by design** (0.5, see below).
Commit: `cd894414` (0.1–0.4), `4653cd31` (0.5).
No migrations. No schema change. No product-model change.

---

## 0.1 Expired credentials — DONE

The scanner checked `status !== 'active'` but never read `expiresAt`, even though
the error message it returned on a miss already said "ou expiré". `POST
/api/workforce/punches` had the same gap (its WHERE filtered on
`status = 'active'` only).

One shared predicate now decides, on `badge-service`:

```ts
isCredentialExpired({ expiresAt }, now) -> boolean
```

`expiresAt` is nullable, and `NULL` means "no expiry recorded" (not expired). An
**unparseable** expiry is treated as **expired** — a credential that cannot be
proven valid is not honoured. Expiry is an absolute instant, so the comparison
needs no school-local calendar and is timezone-independent.

Both call sites reject with `BADGE_EXPIRED`:
- `verify-and-stage/route.ts` — also records the rejection as a
  `BADGE_EXPIRED` scan event, mirroring the existing status-rejection path.
- `workforce/punches/route.ts` — 422, no punch written.

Evidence: measured `expiresAt` on `schoolos_audit` — 220 of 221 badges carry one.

## 0.2 QR report scope — DONE

`libs/attendance/qr-events.ts` had **no branch and no teacher condition at all**;
its `buildConditions` took only `tenantId` plus user-supplied filters. Any caller
holding `attendance.read` saw every scan in the school.

`queryScanEvents` now takes an authorization scope, applied **inside the shared
where-clause** so the list, the CSV and the PDF cannot disagree:

```ts
branchId?       // set => eq(classes.branchId, scope.branchId)
teacherUserId?  // set => inArray(scan.classSectionId, <teacher's sections>)
```

Both routes derive it from `context`, **never from the query string**. A teacher
with no current assignment matches `sql\`false\`` — nothing, never everything.
The aggregate query gained the `classSections`/`classes` joins the new branch
condition needs.

## 0.3 Workforce punch capability — DONE

`POST /api/workforce/punches` allowed roles `school_admin, teacher, receptionist`
with **no capability check** — a teacher session could clock any employee in or
out. There was no workforce punch capability to require.

Added `workforce.punch`. Because `ALL_PERMISSIONS = Object.keys(PERMISSIONS)`,
it is held by `super_admin` and `school_admin` automatically and by no other role,
which is the intended default. It is grantable to a kiosk operator. The roles
array was deliberately **left as-is**: role is the coarse gate, capability the
fine one, so a receptionist granted `workforce.punch` can legitimately run the
front-desk kiosk.

## 0.4 Fabricated summaries — DONE

`seed-full.ts` wrote `attendance_summary` rows from fixed random numbers:

```ts
const total = 80; const present = int(70, 78); const late = int(0, 5); const excused = int(0, 3);
totalAbsent: total - present - late - excused      // can go NEGATIVE
attendanceRate: ((present + late * 0.5 + excused) / total * 100)
```

`present + late + excused` can exceed `total`, producing the negative absences;
the rate formula also differed from the canonical aggregate's
(`present + late + excused`, not `late * 0.5`). It additionally keyed
`academicYearId` on an `academic_years` row while the cache is scoped by
`session_years` — a different concept.

The seed now recomputes each student through the canonical
`recalculateStudentAttendanceSummary`, so demo figures **derive from real marks**.
No clamping: the source is fixed, not the symptom.

## 0.5 Missing-register truth — PARTIAL

Three of the five required conditions are now met, two are not.

**Fixed (commit `4653cd31`):**
- **Casablanca date and weekday.** Was `new Date().toISOString().slice(0,10)` and
  `.getUTCDay()` — a UTC date, which reports yesterday during Moroccan mornings.
  Now `casablancaTodayIso()` and `weekdayNameFor()`.
- **Published version effective on the date.** Was: slots from *every* version,
  so drafts and superseded versions created expectations. Now resolves the
  published version effective on that date (latest `versionNumber` when several
  qualify) and restricts slots to it; with no published version there are no
  expectations.
- **Session has ended.** Was: no end-time check at all, so future and ongoing
  lessons were reported as overdue.

**Corrected after Agent A review — the date is classified BEFORE the clock.**

The first revision compared a slot's end time against the current wall clock for
*every* selected date, which is wrong for any date that is not today. The rule is
now:

| Selected date | Rule |
|---|---|
| `selectedDate < today` (Casablanca) | **every** applicable lesson has ended, whatever the clock says now |
| `selectedDate == today` | only lessons whose `endTime <=` current Casablanca wall time may be missing |
| `selectedDate > today` | nothing is missing — schedule preview only |

Without this, a historical date would report the whole past day as "not yet
ended", and the reminder button would offer to chase teachers about lessons from
last week.

**Not met, and not derivable from today's data:**

> "no valid register exists for that exact session"

The brief's intended fix is to key the check on a session occurrence. That
identity does not exist yet — it is **phase 1's** deliverable ("Introduce a
canonical relationship between timetable session occurrence ↔ attendance
register"). The interim alternatives were measured and rejected:

| Candidate key | Measured on `schoolos_audit` | Result |
|---|---|---|
| `attendance_registers.subject_id` | **0 of 32 rows populated** (all NULL) | would flag every slot |
| `attendance.class_section_id` | **0 of 1600 rows populated** (all NULL) | would flag every slot |
| `attendance.subject_id` | **0 of 1600 rows populated** (all NULL) | would flag every slot |
| `attendance.period` | 1600 of 1600 populated | no slot→period mapping exists |

So the rule still tests **per section**. Consequence, stated plainly: **one marked
period can still hide a different unmarked lesson in the same section.** Keying it
on the columns that exist today would have replaced a weak number with a wrong
one, flagging the entire school as missing registers.

This closes in phase 1 when registers carry a session reference.

## 0.6 Repairing databases seeded before the fix — DONE

Fixing the seed stopped *new* fabrications but left every already-seeded database
wrong: the cache row is only rewritten when that student next gets a mark, so a
demo database keeps its invented numbers indefinitely.

`scripts/rebuild-attendance-summaries.ts` recomputes the cache from the real marks
through the canonical helper. Audit is the default; writing requires `--apply`, and
a production `NODE_ENV` additionally requires `--force`. It reports the target
database, so an operator can see what they are about to rewrite.

Measured against the app's real dev database (`schoolos` on 5433):

```
Groupe Scolaire Atlas — 200 students with marks
  before: 200 rows | >100%: 32 | negative: 51 | disagreeing with marks: 200
```

Those are exactly the discovery's figures. Repair proven on a controlled fixture
in `schoolos_audit` (9 marks including one voided; a fabricated summary with rate
150 and `total_absent` −50):

| | rows | >100% | negative | disagreeing |
|---|---|---|---|---|
| before | 1 | 1 | 1 | 1 |
| after `--apply` | 1 | **0** | **0** | **0** |
| after a second `--apply` | 1 | **0** | **0** | **0** |

Rebuilt values match the canonical expectation exactly (`present 4, absent 2,
late 1, excused 1, sessions 8, rate 75.00`), the voided mark is excluded, all 9
attendance rows survive, and the second run is a no-op — idempotent.

**The command to repair a dev/demo database:**

```
npx tsx scripts/rebuild-attendance-summaries.ts            # audit only
npx tsx scripts/rebuild-attendance-summaries.ts --apply    # rewrite the caches
```

`schoolos` was deliberately left **unmodified** — audit only.

---

## Tests added this phase

| File | Covers |
|---|---|
| `attendance-qr-parity-g15.test.ts` (+4) | expired badge refused and no mark written; refusal recorded as a scan event; future expiry accepted; no-expiry accepted |
| `workforce-punches-p0.test.ts` (5) | valid punch; expired refused; revoked refused; `workforce.punch` demanded; denied capability writes nothing |
| `attendance-qr-report-scope.test.ts` (5) | tenant-wide sees all; campus-limited sees own campus; teacher sees own sections; unassigned teacher sees nothing; CSV narrows identically to the list |
| `attendance-missing-register-truth.test.ts` (10) | past date = whole day ended; today ongoing not missing; today future not missing; today ended missing; future date preview only; draft version ignored; non-effective published version ignored; effective version considered; business date is Casablanca not UTC |
| `attendance-calendar-p0.test.ts` (fixture fix) | G12.5 restored by giving the fixture a published, effective version — not by weakening the rule |

## Suite result

24 files, **188 passed / 188**, including `attendance-calendar-p0`, which the
earlier 161/1 run had omitted.

Static gates: `npm run check:types` exit 0; `npm run check:isolation` exit 0.

### The teacher-scope failure, root-caused

Agent A saw a 161/1 run with `attendance-teacher-scope` failing. It was **not**
a flake, and it was **not** a production regression. The cause was in the test:

```ts
// attendance-teacher-scope.test.ts:173
const rows = await db.select().from(attendance).where(eq(attendance.period, 3));
```

**The query has no tenant filter.** It counts period-3 attendance rows across the
*entire database*, so it fails whenever any other tenant has one. The "flakiness"
was data-dependent, not random: it failed 5/5 while a fixture of mine held a
period-3 row, and passed 5/5 once that row was removed.

Correction: my fixture was removed. The test's own missing tenant scope is left
as-is (not this campaign's file) and is reported for its owner. Minimum fix if it
recurs: add `eq(attendance.tenantId, tenantId)` to that `where`.
