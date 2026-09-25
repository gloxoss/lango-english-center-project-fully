# AUD-ANALYTICS-01 — CHECKPOINT (resume point)

- task: AUD-ANALYTICS-01 — Analytics + Direction + Executive Reporting
- agent: codex-2 (Executor C)
- target branch: origin/student-directory-hardening
- base: f42c2bc41cb2386afed52244c5355c31c8a91f96 (fetched, unchanged)
- worktree: `C:/Users/OMEN/AppData/Local/Temp/schoolos/agentc-AUD-ANALYTICS-01`
- branch: `audit/agent-c/AUD-ANALYTICS-01-analytics-direction`
- hub claims held: `task:AUD-ANALYTICS-01`, `task:port-3461`
- collision check before claim: CLEAN (no one holds analytics/leadership/reporting)
- dev server: port 3461, `NEXT_DIST_DIR=.next-agentc`, DATABASE_URL -> `schoolos_audit`
- node_modules: `npm install --ignore-scripts` DONE
- **EDIT IN THE WORKTREE.** Bash heredocs mangle backslashes: use plain-string or
  line-index replacement, never regex literals with escapes.

## SCOPE (derived; frozen modules excluded as instructed)
OWNED: the analytics/read/reporting layer
  /dashboard/analytics                    executive dashboard + KPIs   <- main
  /dashboard/reports, /admin, /runs, /schedules, /reports/[key]
  /dashboard/portals/leadership, /admin, /approvals, /exceptions
  /dashboard/super-admin/reports
  API: /api/analytics (381 lines), /api/leadership/{me,admin}/* (6),
       /api/addons/reporting/* (12 incl. runs/[id]/download CSV)
EXCLUDED (module-owned report pages over frozen source modules; do not touch):
  /dashboard/finance/{reports,statements}, /dashboard/hr/overview,
  /dashboard/attendance/qr-reports, /dashboard/academics/live-class-reports,
  /dashboard/hostel/reports, /dashboard/transport/reports,
  /dashboard/inventory/overview, /dashboard/broadcast/reports,
  /dashboard/communication/delivery-reports, /dashboard/portals/librarian/reports
EXCLUDED also: Attendance, Academics, GL, Admissions, HR, Finance source modules.

## FINDINGS + FIX (DONE in worktree, src/app/api/analytics/route.ts)
The executive finance KPIs invented local formulas instead of using
`libs/finance/definitions.ts`, which CONTEXT.md mandates ("never invent a local
formula"). The frozen Finance module is CORRECT; the analytics consumer
contradicted it.

F-01 HIGH  COLLECTED overstated: `sum(payments.amount)` where status='posted'
           ignored approved REFUNDS. Canonical `netCollectedSumSql` nets them.
           Partially refunded payments stay 'posted', so cash kept was inflated.
F-02 MED   INVOICED used `status NOT IN ('draft','cancelled','credited')` instead
           of canonical `invoicedInvoiceCondition` (status IN pending/partial/
           overdue/paid).
F-03 HIGH  OVERDUE counted only `status = 'overdue'`. Canonical
           `overdueInvoiceCondition` = status IN (pending,partial,overdue) AND
           dueDate < today. So every past-due invoice still in 'pending'/'partial'
           was MISSING from the director's overdue count (understated).
F-04 MED   collectionRate (the headline ratio) was NOT clamped while the per-month
           IGP variant was -> KPI could display >100%. F-01 made that reachable.
F-05 MED   `isoDate` used `d.toISOString().slice(0,10)` = UTC day. Same family as
           AUD-OPS-01 F-02 / AUD-LIBINV-01 F-01. Affects `today`, `monthStart`,
           `thirtyDaysAgo`, `sixMonthsAgo`, so every window shifts during Moroccan
           mornings. Now `casablancaTodayIso(d)`.

All five fixed. 0 local finance formulas remain (verified).

TEST: src/features/dashboard/__tests__/executive-kpi-truth.test.ts (7 tests) —
asserts the canonical conditions are used, the two hand-rolled filters are gone,
refunds are netted, no UTC date extraction, every displayed percentage is clamped,
and the canonical definitions' semantics (incl. isOverdueInvoice) still hold.

## NEXT EXACT ACTION
1. Read /tmp/agentc-an-gates.log (vitest + types/isolation/ui/i18n + eslint touched).
2. Finish the sweep on 3461: 9 school_admin routes, super-admin/reports (expect
   denial), teacher on /dashboard/analytics (role boundary).
3. Mobile 390 + AR RTL on /dashboard/analytics (the main changed/important route).
4. report.md from shared/REPORT_TEMPLATE.md with the full route matrix and a
   KPI-by-KPI proof (UI -> API -> service/query -> source table). Also cover the
   brief's specific checks that were verified fine: branch filters, stale cache,
   sensitive finance/HR leakage, CSV/export leakage
   (/api/addons/reporting/runs/[id]/download).
5. commit -> push -> `hub done task:AUD-ANALYTICS-01` -> release both -> stop.
