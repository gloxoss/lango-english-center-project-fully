# AUD-OPS-01 — CHECKPOINT (resume point)

- task: AUD-OPS-01 — Transport + Hostel Operational Workflows
- agent: codex-2 (Executor C)
- target branch: origin/student-directory-hardening
- target HEAD: f42c2bc41cb2386afed52244c5355c31c8a91f96
- worktree: `C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-AUD-OPS-01`
- branch: `audit/agent-c/AUD-OPS-01-transport-hostel` (created from f42c2bc)
- hub items held: `task:AUD-OPS-01`, `task:port-3455`
- dev server: port 3455, `NEXT_DIST_DIR=.next-agentc`, DATABASE_URL -> `schoolos_audit`

## Pages audited (code level): 29/29 route inventory traced
## Pages signed off on screen: 0 / 29  <-- REMAINING WORK IS EVIDENCE, NOT ANALYSIS

## Defects confirmed: 4 (all date-boundary / business-date family)
F-01 HIGH  tonight-service.ts overdueReturn compared Postgres timestamp TEXT
           ('2026-09-24 23:00:00') to new Date().toISOString()
           ('2026-09-24T12:00:00.000Z'). ' ' sorts before 'T', so EVERY
           same-day return read as already overdue. Tonight supervision board
           + resident/guardian self-service cried wolf. PROVEN on live data.
F-02 HIGH  inventory-service.ts dateString() used the SERVER local date, not the
           Casablanca school day. Contradicts libs/finance/today.ts. On the UTC
           VPS it answered "yesterday" for the first hour of every Moroccan
           morning -> stays, roll calls and escalations filed on the wrong day.
F-03 MED   escalations-service.ts derived triggerDate + idempotencyKey via
           dateString(new Date(naive)) = host-local parse + host-local format.
           A return due 00:30 Casablanca was filed on the previous day.
F-04 MED   leave-passes-service.ts isMinor() used the UTC date for the majority
           check that gates guardian consent (Law 09-08).
F-05 (transport) transport-service.ts defaulted serviceDate / effectiveStartDate
           from new Date().toISOString().split('T')[0] = UTC slice. Same defect
           family as F-02 (libs/finance/today.ts documents this exact failure).
           4 call sites fixed.

## Fixes applied (worktree, uncommitted)
- src/features/hostel/services/inventory-service.ts  -> dateString() delegates to
  casablancaTodayIso(); NEW storedInstant() parses the naive columns as UTC.
- src/features/hostel/services/tonight-service.ts    -> overdueReturn via storedInstant
- src/features/hostel/services/escalations-service.ts-> dueDate = dateString(storedInstant(...))
- src/features/hostel/services/leave-passes-service.ts -> isMinor uses dateString()
- src/features/transport/services/transport-service.ts -> 4x casablancaTodayIso()
- src/features/hostel/__tests__/hostel-date-boundaries.test.ts (NEW, 6 tests)
- src/features/hostel/__tests__/hostel-audit.test.ts (+2 tests, block 11)

## Tests: 24/24 PASS
`npx vitest run src/features/hostel/__tests__/hostel-date-boundaries.test.ts src/features/hostel/__tests__/hostel-audit.test.ts` -> 24 passed
REGRESSION PROOF: reverting tonight-service.ts to the old comparison makes
block 11 "is not overdue while the expected return is still ahead" FAIL with
"expected true to be false". Test is real.

## Screenshots: NONE YET -> THIS IS THE MAIN REMAINING WORK
## report.md: NOT WRITTEN YET

## NEXT EXACT ACTION
1. Read /tmp/agentc-gates.log (check:types / check:isolation / check:ui / check:i18n:keys).
2. Start dev server:
   cd C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-AUD-OPS-01/lango-app
   NEXT_DIST_DIR=.next-agentc npx next dev -p 3455
   (node_modules is a REAL install here -- a junction breaks Turbopack:
    "Symlink [project]/node_modules is invalid, it points out of the filesystem root".
    npm install must use --ignore-scripts; better-sqlite3's node-gyp build fails.)
3. Build routes files (13 transport + 16 hostel = 29):
   transport: /dashboard/transport /vehicles /drivers /routes /stops /allocations
              /boarding /trips /incidents /reports /policies /guardian /student
   hostel:    /dashboard/hostel /allocations /allocations/<id> /applications /board
              /categories /guardian /hostels /hostels/<id> /leave-passes /me
              /policies /reports /roll-call /rooms /zones
   (allocations/<id> and hostels/<id> need a real seeded id -- query schoolos_audit.)
4. Sweep desktop FR for all 29 as school_admin:
   AUDIT_BASE=http://localhost:3455 node scripts/visual-sweep.mjs school_admin routes.txt out/
   Then VIEWPORT=phone LOCALE=ar for anything changed (Tonight board, resident me).
5. Before/after for F-01: cheap via hot reload -- edit tonight-service.ts back to the
   old comparison, screenshot /dashboard/hostel + /dashboard/hostel/me, edit forward.
   First INSERT into schoolos_audit a hostel_leave_passes row approved with
   expected_return_at a few hours in the FUTURE so the "overdue" badge is visible
   in the before shot and absent in the after shot.
6. report.md from shared/REPORT_TEMPLATE.md (29-row route matrix).
7. git add ONLY the 7 files above (never -A). Commit. Push branch.
8. hub: `done task:AUD-OPS-01 --summary ... --files ... --verify "..."` then release.

## UNRESOLVED (log in report, do NOT fix here)
- hostels_leave_passes startDateTime/expectedReturnAt hold UTC wall clock while
  the `date` columns (callDate, triggerDate, effectiveStartDate) are Casablanca
  business dates. getTonight's leave window (dayStart/dayEnd built from callDate)
  therefore shifts 1h against those timestamps. Fixing it means reinterpreting or
  migrating historical rows = destructive historical-data change -> out of scope.
  Overlap semantics keep it from mislabelling in practice; report the residual.
