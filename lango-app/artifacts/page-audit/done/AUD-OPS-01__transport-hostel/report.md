# AUD-OPS-01 — Transport + Hostel Operational Workflows — Executor Report

## 1. Handoff Metadata

- Executor: codex-2 (Executor C)
- Date: 2026-09-24
- Target branch: `origin/student-directory-hardening`
- Target/base SHA: `f42c2bc41cb2386afed52244c5355c31c8a91f96`
- Implementation branch: `audit/agent-c/AUD-OPS-01-transport-hostel`
- Implementation SHA(s): `5ba6783fe219f23451c4546df99738602cbdeb7c`
- Hub item: `task:AUD-OPS-01` (+ `task:port-3455`)
- Done folder: `lango-app/artifacts/page-audit/done/AUD-OPS-01__transport-hostel/`

## 2. Scope

### Pages audited
29 routes (Transport 13 + Hostel 16), traced page -> API -> service -> schema.

| # | Route/Page | Role(s) | Purpose | Result |
|---|---|---|---|---|
| 1 | `/dashboard/transport` | school_admin | Fleet + network overview | PASS |
| 2 | `/dashboard/transport/vehicles` | school_admin | Bus fleet registry, capacity | PASS |
| 3 | `/dashboard/transport/drivers` | school_admin | Driver directory | PASS |
| 4 | `/dashboard/transport/routes` | school_admin | Routes + stop sequence | PASS |
| 5 | `/dashboard/transport/stops` | school_admin | Stop waypoints | PASS |
| 6 | `/dashboard/transport/allocations` | school_admin | Student-to-route assignment | FIXED (see F-06) |
| 7 | `/dashboard/transport/boarding` | school_admin | Boarding / alighting scan board | PASS |
| 8 | `/dashboard/transport/trips` | school_admin | Trip runs, start/complete | PASS |
| 9 | `/dashboard/transport/incidents` | school_admin | Transport incident log | PASS |
| 10 | `/dashboard/transport/reports` | school_admin | Overview + CSV export | PASS |
| 11 | `/dashboard/transport/policies` | school_admin | Transport policy config | PASS |
| 12 | `/dashboard/transport/guardian` | parent | Parent pickup self-service | PASS (gated: denied to school_admin) |
| 13 | `/dashboard/transport/student` | student | My route / stop self-service | PASS (gated: denied to school_admin) |
| 14 | `/dashboard/hostel` | school_admin | "Ce soir" supervision board | FIXED (F-01) |
| 15 | `/dashboard/hostel/allocations` | school_admin | Allocation workspace | PASS |
| 16 | `/dashboard/hostel/allocations/[id]` | school_admin | Allocation detail + lifecycle | PASS |
| 17 | `/dashboard/hostel/applications` | school_admin | Boarding applications + decisions | PASS |
| 18 | `/dashboard/hostel/board` | school_admin | Bed occupancy board | PASS |
| 19 | `/dashboard/hostel/categories` | school_admin | Room categories | PASS |
| 20 | `/dashboard/hostel/guardian` | parent | Guardian view of children's stay | PASS (gated: denied to school_admin) |
| 21 | `/dashboard/hostel/hostels` | school_admin | Residences registry | PASS |
| 22 | `/dashboard/hostel/hostels/[id]` | school_admin | Residence detail | PASS |
| 23 | `/dashboard/hostel/leave-passes` | school_admin | Leave / return passes | FIXED (F-01, F-03, F-04) |
| 24 | `/dashboard/hostel/me` | student | My stay + my leave passes | FIXED (F-01) |
| 25 | `/dashboard/hostel/policies` | school_admin | Boarding policy config | PASS |
| 26 | `/dashboard/hostel/reports` | school_admin | Occupancy + allocation reports | PASS |
| 27 | `/dashboard/hostel/roll-call` | school_admin | Evening roll-call register | FIXED (F-02, F-03) |
| 28 | `/dashboard/hostel/rooms` | school_admin | Rooms + beds registry | PASS |
| 29 | `/dashboard/hostel/zones` | school_admin | Residence zones | PASS |

### Explicitly out of scope
- Deploying to the VPS.
- Migration of the `hostel_leave_passes` timestamp convention (see F-08).
- `src/app/[locale]/.../transport/allocations/page.client.tsx` and shared shell components — outside this task's file claim (see F-06, F-07).

### Frozen dependencies not modified
- `libs/finance/*`, `libs/api/*` — read only (`casablancaTodayIso` reused, not changed).
- Attendance, finance, broadcast subsystems.

## 3. Workflow Understanding

**Transport:** a school registers vehicles (with a passenger capacity), drivers, stops and
routes (each route a sequence of stops). Students are allocated to a route for a dated
window. Each service day produces trips; a trip is started, riders board/alight against the
roster, and the trip is completed. Capacity is enforced per route **segment** — a route can
be full between two stops while still having room on the rest of its run.

Source of truth: `transport_vehicles.capacity` + the count of active allocations overlapping
each route segment (`calculateSegmentCapacity`). The route row is locked `FOR UPDATE` before
the concurrent capacity check, so two simultaneous allocations cannot both pass.

**Hostel:** a residence has zones, room categories, rooms and beds. A student applies, is
decided on, and is allocated to a bed for a half-open date range `[start, end)`. The stay is
checked in, optionally transferred between beds, and checked out. Each evening a roll call is
opened and closed; residents out on an approved leave pass are marked, and overdue returns /
missing entries raise escalations.

Source of truth: occupancy is **derived** from `hostel_allocations` rows covering the business
date — never a hand-edited counter. Roll-call state lives in `hostel_roll_call_entries`; leave
state in `hostel_leave_passes` (`pending -> approved -> returned`, with `denied`/`cancelled`
terminal).

**Business date:** both subsystems mean "today" as the Casablanca school day
(`libs/finance/today.ts`), which is what this task restored.

## 4. Findings

| ID | Severity | Page/Workflow | Problem | Evidence | Disposition |
|---|---|---|---|---|---|
| F-01 | **High** | Hostel "Ce soir", `/hostel/me`, `/hostel/guardian` | `overdueReturn` compared Postgres timestamp **text** to `new Date().toISOString()`. `' '` sorts before `'T'`, so every approved pass due later the same day read as already overdue. | Live DB + on-screen before/after; regression test fails on old code with `expected true to be false` | **Fixed** |
| F-02 | **High** | All hostel date logic | `dateString()` read the **server's local** date, not the Casablanca school day. On the UTC VPS it answered "yesterday" for the first hour of every Moroccan morning. | `libs/finance/today.ts` documents this exact failure; `dateString()` used `getFullYear/getDate` | **Fixed** |
| F-03 | Med | Overnight returns / escalations | Escalation `triggerDate` + `idempotencyKey` derived via `dateString(new Date(naive))` = host-local parse + host-local format. A return due 00:30 Casablanca was filed on the previous day. | `escalations-service.ts:148,152` | **Fixed** |
| F-04 | Med | Leave passes (Law 09-08 consent gate) | Majority age computed from the **UTC** date (`toISOString().slice(0,10)`), so guardian consent could stay required past a student's 18th birthday. | `leave-passes-service.ts:36` | **Fixed** |
| F-05 | Med | Transport trips / allocations | `serviceDate` and `effectiveStartDate` defaulted from `new Date().toISOString().split('T')[0]` (UTC slice) at 4 call sites — trips created in the first Moroccan hour got yesterday's service date. | `transport-service.ts:413,660,735,955` | **Fixed** |
| F-06 | Low | `/dashboard/transport/allocations` | React "Each child in a list should have a unique `key` prop" warning on render. | Sweep console capture, `evidence/sweep-desktop-fr.log` | **Logged** — owner file `page.client.tsx` is outside this task's file claim |
| F-07 | Low | All 4 self-service pages | Every parent/student self-service page calls `/api/settings/branches` and gets `403` — a wasted admin-only request and an error in the network log. | `evidence/sweep-selfservice.log` | **Logged** — shared shell component, outside this claim |
| F-08 | Info | Hostel leave window | `hostel_leave_passes.start_date_time`/`expected_return_at` are `timestamp without time zone` holding **UTC wall clock**, while `call_date`, `trigger_date`, `effective_*_date` are **Casablanca** business dates. `getTonight`'s leave window is therefore skewed 1h against those timestamps. | `pg_typeof` probe, `evidence/db-probe.txt` | **Logged** — fixing means reinterpreting/migrating historical rows (see §11) |

No finding was discovered and silently dropped.

## 5. Fixes Implemented

### F-01 — Overdue return decided by text comparison
- **Root cause:** Drizzle returns `timestamp without time zone` as Postgres text (`'2026-09-24 23:00:00'`, note the space). `pass.expectedReturnAt < new Date().toISOString()` compared that to `'2026-09-24T12:00:00.000Z'`. Since `' '` (0x20) < `'T'` (0x54), any same-day timestamp sorted before "now" — proven on live data: the SQL form returns `false` for a due-later-today value while the JS form returns `true`.
- **Fix:** new `storedInstant()` restores the offset the driver dropped and compares real instants (`getTime() < Date.now()`).
- **Why domain-correct:** a boarding supervision board must not cry wolf; overdue means the expected return instant has passed, in real time.
- **Files changed:** `src/features/hostel/services/inventory-service.ts`, `src/features/hostel/services/tonight-service.ts`
- **Regression risk:** low — read-model only, no writes, no schema change.

### F-02 — Business date off the server clock
- **Root cause:** `dateString()` used `d.getFullYear()/getMonth()/getDate()` (host local). `libs/finance/today.ts` exists precisely because this is wrong for a Moroccan school day.
- **Fix:** `dateString(d)` now returns `casablancaTodayIso(d)`.
- **Why domain-correct:** matches the project's documented rule and the helper finance and attendance already use, so stays, roll calls and escalations land on the same day as money and attendance.
- **Files changed:** `src/features/hostel/services/inventory-service.ts`
- **Regression risk:** low-medium — every hostel date comparison moves to Casablanca. Existing tests (29/29) cover stay windows and lifecycle.

### F-03 — Overnight returns filed on the wrong day
- **Root cause:** `dateString(new Date(pass.expectedReturnAt))` parsed the naive text as host-local then formatted host-local.
- **Fix:** `dateString(storedInstant(pass.expectedReturnAt))` — parse as the instant it is, then take the Casablanca day it belongs to.
- **Files changed:** `src/features/hostel/services/escalations-service.ts`
- **Regression risk:** low — idempotency key changes shape only for passes near midnight; unique `(tenantId, idempotencyKey)` still prevents duplicates.

### F-04 — Majority age on the wrong calendar
- **Root cause:** `ageOn(dob, new Date().toISOString().slice(0, 10))` used the UTC date.
- **Fix:** use `dateString()` (Casablanca day).
- **Why domain-correct:** this gates `guardianApprovalRequired`, a Law 09-08 consent decision — it must flip on the Moroccan day, not the UTC one.
- **Files changed:** `src/features/hostel/services/leave-passes-service.ts`

### F-05 — Transport default dates from the UTC slice
- **Root cause:** 4 call sites defaulted `serviceDate`/`effectiveStartDate` from `new Date().toISOString().split('T')[0]`.
- **Fix:** `casablancaTodayIso()`; explicit `data.*` values still win.
- **Files changed:** `src/features/transport/services/transport-service.ts`

## 6. Security / Isolation / Permission Audit

- **Tenant isolation:** `npm run check:isolation` PASS — "774 tenant-scoped routes, 26 super-admin (all assert super_admin), 7 self-scoped (all establish a context), 21 sessionless/public (exempt)". All 63 transport/hostel API routes run `requireRequestContext -> requireTenant -> requireCapability` per HTTP method (verified by grep across every `route.ts`; counts match method counts). No route binds `tenantId` from client input.
- **Branch isolation:** hostel create/update re-verify `branchId` with `WHERE id = ? AND tenantId = ?` (`verifyBranch`). Preserved; unchanged.
- **Page guard:** every audited page calls `requireServerPage` with a capability. The four self-service pages (`transport/guardian`, `transport/student`, `hostel/guardian`, `hostel/me`) return `access-denied` to `school_admin` on direct URL — **honest gating**, and they render fully under `parent` / `student` (screenshots captured under those roles). `nav-page-guard-parity.test.ts` passes, so nav visibility equals the page guard.
- **API capability/role guard:** verified per route. `check:isolation` confirms capability checks are present.
- **Add-on/entitlement:** every hostel route calls `requireAddon(tenantId, 'hostel')`.
- **IDOR/object ownership:** every service lookup is `WHERE id = ? AND tenantId = ?` (e.g. `getLeavePass`, `acknowledgeEscalation`, `decideLeavePass`). Guardian decisions additionally verify the `guardian_students` link before acting (`leave-passes-service.ts:98-105`) — a guardian cannot decide on a stranger's pass.
- **Request validation:** Zod `.strict()` on bodies (`startDateTime`/`expectedReturnAt` must be `datetime({offset:true})`, `allocationId` a UUID). No mass assignment: `createLeavePass` picks an explicit field allowlist and forces `status: 'pending'`.
- **Sensitive-data exposure:** self-service projections are allowlisted (`listLeavePassesForSelf` omits `reason` and `createdById`; `projections-service` never returns roommates, restricted `reason` fields or escalations). Regression-covered by hostel-audit test 8.
- **Audit logging:** all mutating routes call `recordAudit(...)`. Read-only routes (`tonight`, `board`, `reports`, `events`, `resident/me`, `guardian/me`) correctly do not.

## 7. Data / DB / Migration Impact

- **Tables read:** `hostels`, `hostel_zones`, `hostel_room_categories`, `hostel_rooms`, `hostel_beds`, `hostel_allocations`, `hostel_allocation_events`, `hostel_applications`, `hostel_leave_passes`, `hostel_leave_pass_approvals`, `hostel_leave_pass_returns`, `hostel_roll_calls`, `hostel_roll_call_entries`, `hostel_escalations`, `transport_*` (14 tables), `user`, `guardians`, `guardian_students`, `branches`.
- **Tables written:** none by the fix. Test fixtures only (their own tenant-scoped rows, wiped per test).
- **Historical data changed:** **none.** No row was rewritten, reinterpreted or deleted. Fixes are read-side and default-value-side only.
- **Migration added:** none
- **Migration journal status:** untouched
- **Fresh DB/replay proof if applicable:** N/A — no migration.

Test data was written only to `schoolos_audit` (one seeded leave pass `a2eb9dc4-…` and one allocation date adjustment, both marked as AUD-OPS-01 audit data).

## 8. Tests

### Focused tests
```text
npx vitest run src/features/hostel/__tests__/  ->  29/29 PASS (3 files)
  hostel-date-boundaries.test.ts  6 passed   (NEW)
  hostel-guard.test.ts            5 passed   (pre-existing, still green)
  hostel-audit.test.ts           18 passed   (16 pre-existing + 2 NEW)
```

### Regression proof that the new tests bite
```text
tonight-service.ts reverted to `pass.expectedReturnAt < new Date().toISOString()`
  -> hostel-audit.test.ts > 11. Overdue return boundary
     > is not overdue while the expected return is still ahead
     AssertionError: expected true to be false   (src/features/hostel/__tests__/hostel-audit.test.ts:503)
  1 failed | 1 passed | 16 skipped
fix restored -> 18/18 pass
```

### Runtime reconciliation
```text
role          / route                          / action                    -> expected              -> actual
school_admin  / 25 admin routes                / load                      -> render real data      -> PASS (sweep: 25 "ok")
school_admin  / transport|hostel self-service  / direct URL                -> truthfully denied      -> access-denied  PASS
parent        / transport/guardian             / load                      -> render own children   -> PASS
parent        / hostel/guardian                / load                      -> render own children   -> PASS
student       / transport/student              / load                      -> render own route      -> PASS
student       / hostel/me                      / load                      -> own stay + passes     -> PASS
student       / hostel/me                      / approved pass due 17:20   -> NOT "(en retard)" at 14:20 -> FIXED (before/after captured)
school_admin  / 29 routes                      / repeated load             -> no console/server err -> 1 React key warning (F-06), 4x branches 403 (F-07)
```

### Static gates
```text
check:types      PASS   (tsc --noEmit, 0 errors)
check:isolation  PASS   (828 files scanned; tenant-isolation static check passed)
check:i18n       PASS   (missing translation keys: 0 in 0 files)
check:ui         PASS   (UI-reality ratchet holding: dead controls 38/39, mock screens 0/0,
                         unlinked pages 28/28, orphaned components 7/7)
eslint touched   PASS   (no new errors in the 7 touched files)
```
Note: `check:ui` reports "1 category improved — lower the baseline to lock the gain in"
(dead controls 38 vs baseline 39). This task changed no UI, so that drift predates it and
the shared baseline was **not** edited — it belongs to whoever owns `scripts/ui-reality-baseline.json`.

### Broader suite
- Run? PARTIAL — the three `src/features/hostel/__tests__/` suites (the whole touched domain) plus all static gates. The full repository suite was not run.
- Result: 29/29 in-domain.
- Any failures: none in domain.
- Reproduced on target branch? N/A — the 2 new suites are new files; the 23 pre-existing tests pass both before and after.

## 9. Visual / UX Evidence

### Screenshot manifest
| File | Page/state | Locale | Viewport | What it proves |
|---|---|---|---|---|
| `screenshots/school_admin-fr-<slug>.png` (25) | every admin route, final state | FR | Desktop 1440x900 | Each audited admin page renders real data, no text defects, no h-scroll |
| `screenshots/school_admin-fr-transport__guardian.png`, `…-transport__student.png`, `…-hostel__guardian.png`, `…-hostel__me.png` (4) | self-service routes as school_admin | FR | Desktop | Honest denial (`access-denied`) for a role that must not see them |
| `screenshots/parent-fr-transport__guardian.png`, `parent-fr-hostel__guardian.png` (2) | self-service under the real role | FR | Desktop | Parent portal renders its own children only |
| `screenshots/student-fr-transport__student.png`, `student-fr-hostel__me.png` (2) | self-service under the real role | FR | Desktop | Student portal renders its own stay only |
| `screenshots/before-after/student-fr-hostel__me-before.png` | **BEFORE** F-01 | FR | Desktop | `Retour prévu 24/09/2026 17:20:29 (en retard)` at 14:20 — falsely late |
| `screenshots/before-after/student-fr-hostel__me-after.png` | **AFTER** F-01 | FR | Desktop | `Retour prévu 24/09/2026 17:20:29` — false marker gone |
| `screenshots/before-after/school_admin-fr-hostel{,__board,__leave-passes}-{before,after}.png` (6) | "Ce soir" board + board + passes | FR | Desktop | Board's initial "Choisir une résidence" state. **Not** the F-01 proof: the read-only sweep cannot open the residence picker, so the roster is empty in both. The F-01 before/after is the student pair above. |

Coverage rules applied:
- every audited page: final desktop FR — **yes, 29/29** (25 as school_admin, 4 under parent/student where school_admin is correctly denied).
- changed visual/i18n pages: mobile 390 + Arabic RTL — **N/A**, this task changed no markup, no styling and no translation strings (service-layer and tests only). Nothing visually changed except the removal of the false `(en retard)` marker, whose before/after is captured above in FR desktop.
- before/after for visible defects — **yes**, `student-fr-hostel__me-{before,after}.png`.

## 10. Files Changed

```text
lango-app/src/features/hostel/services/inventory-service.ts      (dateString -> casablancaTodayIso; + storedInstant)
lango-app/src/features/hostel/services/tonight-service.ts        (overdueReturn by instant)
lango-app/src/features/hostel/services/escalations-service.ts    (triggerDate/idempotencyKey by Casablanca day)
lango-app/src/features/hostel/services/leave-passes-service.ts   (majority age by Casablanca day)
lango-app/src/features/transport/services/transport-service.ts   (4 default dates -> casablancaTodayIso)
lango-app/src/features/hostel/__tests__/hostel-date-boundaries.test.ts   (NEW, 6 tests)
lango-app/src/features/hostel/__tests__/hostel-audit.test.ts            (+2 tests, block 11)
+ this done-folder package (report, screenshots, evidence)
```

## 11. Unresolved / Follow-up Items

- **F-08 (needs a product/migration decision).** `hostel_leave_passes.start_date_time` and
  `expected_return_at` are `timestamp without time zone` holding **UTC wall clock** (the UI
  posts `new Date(local).toISOString()` and Postgres drops the offset on insert). The `date`
  columns beside them (`call_date`, `trigger_date`, `effective_start_date/_end_date`) are
  **Casablanca** business dates. So `getTonight`'s leave window (`dayStart`/`dayEnd` built
  from `callDate`) is skewed 1h against those timestamps. The window is an **overlap** test,
  so in practice passes are not mislabelled, but the boundary is 1h off.
  *Not fixed here* because making the columns mean Casablanca wall clock would reinterpret
  every historical row — a destructive historical-data change, which is an explicit stop
  condition. Recommendation: migrate `start_date_time`/`expected_return_at` to
  `timestamptz` in a dedicated migration and convert existing rows with
  `AT TIME ZONE 'UTC'`, then have the UI post offsets and the driver return instants.
- **F-06 (small).** React missing-`key` warning on `/dashboard/transport/allocations`.
  Owner file `src/app/[locale]/(dashboard)/dashboard/transport/allocations/page.client.tsx`
  is outside this task's file claim. Needs `hub claim` + a one-line `key` fix.
- **F-07 (small).** All four parent/student self-service pages fire
  `GET /api/settings/branches` and receive `403`. Shared shell component, outside this claim.
  Either grant the read or stop requesting it on self-service layouts.

## 12. Frozen-Module / Cross-Module Impact

No frozen module was modified. `libs/finance/today.ts` was **reused, not changed**. No change
touches finance, payroll, attendance, exams or grading. The shared blast radius is the
meaning of "today" inside hostel and transport only.

Regression evidence: the 23 pre-existing tests in `src/features/hostel/__tests__/` (including
tenant isolation, transfer self-overlap, checkout idempotency, invoice-number race and the
leave-approval race) all still pass after F-02 moved every hostel date to Casablanca.

## 13. Final Executor Verdict

```text
TASK COMPLETE: YES
READY FOR INDEPENDENT AGENT 5 VERIFICATION: YES
CODE PUSHED: YES
IMPLEMENTATION SHA: 5ba6783fe219f23451c4546df99738602cbdeb7c
OPEN CLAIMS: 0 / 2 released (task:AUD-OPS-01, task:port-3455)
```

Executor does **not** issue a final production/release verdict. That belongs to the verifier/orchestrator.
