# Advanced Reporting Add-on — Full Implementation Plan

**STATUS: IMPLEMENTED — the "100% deployed to production" claim below and in
`EXECUTION-AUDIT-REPORT.md` is disproven; corrected 2026-08-11.** The code is real and
live-verified (`src/addons/advanced-reporting/` run-engine/catalog/schedules+worker/
secure-download/exporters, migrations `0059`/`0062`, 11 API routes, `dashboard/reports/*`
pages), but it is **not activated for any real tenant**: `addon_entitlements` has zero rows
for `advanced-reporting` outside the `seed-full.ts` demo-tenant seed (no migration backfills
it, unlike `0035_backfill_multi_branch_entitlement.sql` did for `multi-branch`) — intentional
per PRD, to be flipped when shipping. `schedule-worker` is also an in-process `setInterval`
with no cross-instance lock, a gap for multi-instance deploys. See
`future-implementation/_tracker/PLANS-AUDIT-AND-PROGRESS.md` (#35) for full verified detail.
Domain source reports remain core; this add-on supplies a governed catalog, cross-module navigation, advanced filters, scheduled exports and analytics.

## Screen inventory

| # | Group | Visible reports | Primary action |
|---|---|---|---|
| 1 | Student Reports | Login Credential, Admission, Class & Section, Sibling | Inspect/export student operations |
| 2 | Fees Reports | Fees, Receipts, Due Fees, Fine | Analyze billing and collection |
| 3 | Financial Reports | Account Statement, Income, Expense, Transactions, Balance Sheet, Income vs Expense | Analyze ledger/financial position |
| 4 | Attendance Reports | Student, Student Daily, Student Overview, Employee, Exam | Analyze presence by context/time |
| 5 | Human Resource | Payroll Summary, Leave Reports | Analyze workforce operations |
| 6 | Examination | Report Card, Tabulation Sheet, Progress Reports | Produce academic outcomes |
| 7 | Inventory | Stock, Purchase, Sales, Issues | Analyze inventory operations |

Duplicate Fees and Examination screenshots represent the same screens and are counted once.

## Feature map against SchoolOS

### Keep

- Real `/api/finance/reports` and `FinancialReportsView` for invoiced/collected/expense trends and outstanding balances.
- Attendance registers, summaries, audit/heatmap endpoints and flags.
- Student/admission/class/section/guardian relationships and list exports.
- Class results and the existing report-card generator foundation.
- Dashboard/analytics read models, shared tables/charts and CSV helper.
- Future domain plans for Office Accounting, Student Accounting, HR/Payroll, Assessment and Inventory.

### Change

- Replace isolated client-side exports with server-authorized, filter-equivalent export jobs.
- Convert dashboard-only queries into explicitly versioned report/read-model contracts where reused.
- Report cards and financial statements must use publication/period snapshots, not mutable live rows.
- Add consistent `asOf`, timezone, academic period, branch and status semantics across reports.

### Add

- Report catalog, definitions/versions, parameter schemas, saved views, favorites, background runs, snapshots, schedules, delivery, export artifacts, lineage and audit.
- Every screenshot report listed below, conditional on its source module being installed and ready.
- CSV/XLSX/PDF output, print layouts, scheduled delivery through Broadcast, and safe drill-through.

### Remove / do not duplicate

- Do not create reporting-owned copies of students, attendance, marks, invoices, journal entries, payroll or inventory transactions.
- Do not expose raw SQL/query builders to school users in V1.
- Do not remove existing dashboards/reports because the reference navigation omits them.

## Provisional decision gate

1. **Product boundary:** curated operational/statutory reports first; self-service BI later for authorized analysts.
2. **Data timing:** live for operational reports; approved snapshots for report cards, payroll summaries and closed-period financial statements.
3. **Exports:** small CSV may stream; XLSX/PDF and large CSV run asynchronously with expiry and audited download.
4. **Delivery:** schedules deliver secure links by default, not sensitive attachments; recipients are re-authorized at access time.

## Reporting architecture

Each domain owns facts and report query services. Advanced Reporting registers metadata and orchestrates runs; it never bypasses domain authorization.

`ReportDefinition` contains key, domain, version, labels, parameters, columns, measures, supported formats, required permissions, sensitivity, freshness and execution adapter. Definitions are code-reviewed/typed in V1. A run records definition version, normalized parameters, requester, tenant/branch scope, `asOf`, source watermarks, row count, status and output checksum.

- Operational queries run against indexed transactional/read-model tables with bounded limits.
- Heavy/cross-module metrics use maintained projections/materialized aggregates, rebuilt through replayable jobs.
- Legal/academic outputs store immutable snapshot payloads plus source-version lineage.
- Every drill-through reapplies current permission and source-domain scope; an aggregate never grants row access.
- Add query timeouts, concurrency quotas, row limits, cancellation and observability before scheduling.

## Shared pages

- **Report Center:** domain cards, search, favorites, recently run, readiness badges and permission-aware catalog.
- **Report Workspace:** parameter panel, validation, data table/chart, totals, drill-through, save view, run/export/schedule.
- **My Runs:** queued/running/completed/failed/expired artifacts with retry and diagnostic ID.
- **Schedules:** report/version, parameters, timezone, cadence, recipients, format, secure-link expiry and last/next run.
- **Admin:** definition readiness, projection freshness, failures, slow reports, storage/retention and schedule suspension.

All workspaces implement loading, error, empty, filtered-empty, stale, partial, permission-denied and module-unavailable states.

## Student Reports

### Login Credential — needed with strict redesign

- Report account provisioning status, role, username/masked identifier, activation, last login, MFA/readiness and reset-required state.
- Never display/export passwords, password hashes, reset tokens or reusable login secrets.
- “Issue credentials” creates one-time activation/reset workflows through the identity module and logs delivery; it is an action, not a credential export.

### Admission Report — enhance existing data

- Filters: application/admission/enrollment dates, source, branch, program, class, status, assignee and cohort.
- Measures: leads/applications/admitted/enrolled, conversion, processing time and loss reasons. Drill to authorized records.
- Define each funnel stage from real inquiry/admission/enrollment events; never infer conversion from mutable labels alone.

### Class & Section Report — needed

- Enrollment by class/section/academic period, capacity, occupancy, gender/age aggregates where lawful, teacher assignment and unassigned/over-capacity exceptions.
- Use effective-dated enrollment/placement records so historical rosters are reproducible.

### Sibling Report — needed but privacy-limited

- Group students by explicit guardian-student/household relationship, show household count/classes and authorized guardian contacts.
- Do not infer siblings from surname, address or phone alone. Possible matches belong in a separate restricted data-quality queue.

## Fees Reports

These depend on the Student Accounting hardening plan.

### Fees Report

- Charges/invoices by fee type, structure/version, allocation run, period, program/class, student and status; gross, discount, credit, paid and outstanding.
- Reconcile totals to Student Accounting control accounts after Office Accounting integration.

### Receipts Report

- Posted payment receipts by date, cashier/session, method, branch, student/guardian, invoice allocation and reversal/refund state.
- Exclude reversed receipts from net totals while retaining them visibly in audit mode.

### Due Fees Report

- Receivables aging as of a chosen date: not due, 1–30, 31–60, 61–90, 90+; promises/disputes, last reminder and guardian route.
- Historical results use event ledger/as-of logic, not current status labels.

### Fine Report

- Assessed, waived, reversed, paid and outstanding fines by policy/version/reason and aging.
- Separate proposed from posted fines and show waiver approver/reason under restricted permission.

## Financial Reports

These depend on the Office Accounting double-entry ledger; existing trend reports remain available during rollout.

### Account Statement

- Opening balance, dated debits/credits, running balance and closing balance for account/party with source voucher drill-through.

### Income / Expense Reports

- Posted income or expense accounts by period, account hierarchy, branch/dimensions and comparative period; exclude drafts and include reversals correctly.

### Transactions Report

- Voucher/journal lines filtered by date/type/account/source/status/dimension with balanced voucher drill-down and reversal chain.

### Balance Sheet

- Assets, liabilities and equity as of date with hierarchy, comparatives, retained earnings and drill-through. Must satisfy Assets = Liabilities + Equity.

### Income vs Expense

- Periodic income/expense/net result with budget comparison later. Source from posted journal lines, not invoice/payment dashboards.

The screenshot omits Trial Balance, General Ledger and Cash Flow; keep them in Office Accounting because they are essential accounting reports.

## Attendance Reports

### Student Report

- Per-student attendance event/register history, status, late minutes, excuse, correction/reopen evidence and authorized notes.

### Student Daily Report

- Date/class/section matrix with present/absent/late/excused/remote/custom totals, missing registers and completion rate.

### Student Overview Report

- Period summary by student/class/program: scheduled sessions, marked sessions, rates, late/absence streaks, risk flags and trend.
- Display denominator/coverage so missing registers never appear as absences or falsely improve rates.

### Employee Report

- Depends on Workforce time/attendance ledger: workdays, punches, hours, lateness, absence, corrections and exceptions. Never derive payroll hours from student attendance tables.

### Exam Attendance Report

- Depends on Assessment exam sessions: candidate, room/seat, present/absent/late, check-in method, incident and authorized accommodation status.
- Exam presence is separate from daily school attendance; optional reconciliation is explicit and reviewed.

## Human Resource Reports

### Payroll Summary

- Depends on approved payroll-run snapshots: headcount, gross, earnings, deductions, employer cost, net, payment state and variance by department/branch.
- Restrict individual drill-down and suppress small-group aggregates to reduce salary disclosure risk.

### Leave Reports

- Entitlement, opening/accrual/used/adjusted/closing balances plus request status, duration, type, department and coverage conflicts.
- Read from append-only leave balance transactions and effective policies, not a mutable total alone.

## Examination Reports

These remain core Academic outputs; Advanced Reporting adds catalog, scheduling and exports.

### Report Card

- Generate from published assessment-result snapshots and versioned template; include subjects, marks/grades, comments, attendance summary and approval/publication metadata.
- Reissue creates a new document version and preserves prior versions/checksums.

### Tabulation Sheet

- Class/section/term grid of candidates × subjects with totals, grades, rank/position policy and missing/withheld indicators.
- Rank is generated only when the tenant policy enables it; ties and exclusions are deterministic and disclosed.

### Progress Report

- Compare periods/assessments by subject and competency, trend, teacher narrative and support flags.
- Do not present causal or predictive claims from small/noisy data; label incomplete coverage.

## Inventory Reports

Depend on the Inventory add-on transaction ledger.

### Stock Report

- On-hand/reserved/available/in-transit/loaned by item/location as of date, valuation where configured, reorder/negative-stock exceptions and movement drill-through.

### Purchase Report

- Purchase orders/receipts/returns by supplier, item, period, status, lead time, quantity and value; distinguish ordered, received, invoiced and paid.

### Sales Report

- Sales/returns by item, customer type, channel, period and payment state; gross, discount, tax, net, cost/margin only when valuation is reliable.

### Issues Report

- Stock issues/consumption/equipment loans by department/person/purpose, due/returned/overdue/damaged state and authorization.
- “Issue” must be explicitly configured as consumption versus returnable custody.

## Data model and APIs

- `reportDefinitions`, `reportDefinitionVersions`, `reportSavedViews`, `reportFavorites`.
- `reportRuns`, `reportRunEvents`, `reportArtifacts`, `reportSchedules`, `reportScheduleRecipients`.
- `reportSnapshots`, `reportSnapshotSources`, `reportProjectionWatermarks`, `reportDeliveryEvents`.

- `GET /api/addons/reporting/catalog`
- `POST /api/addons/reporting/reports/:key/preview|run`
- `GET /api/addons/reporting/runs`, `/runs/:id`, `/runs/:id/download`
- `GET|POST|PATCH /api/addons/reporting/saved-views|schedules`
- Domain adapters: `/api/.../reports/:key` or in-process typed services, never arbitrary client SQL.

Artifacts use private object storage, checksums, short-lived signed access and expiry. Snapshot PII inherits source retention/deletion/legal-hold policies.

## Permissions and privacy

- Base permissions: `reporting.catalog.read`, `reporting.run`, `reporting.export`, `reporting.schedule`, `reporting.admin` plus domain permissions for every row/field.
- Dedicated sensitive scopes for credentials, student PII, attendance notes, finance detail, salary/person-level payroll and medical/accommodation fields.
- Guardians/students may receive only portal-safe reports for their authorized household/self.
- Log run, view, drill, export, download and scheduled delivery; watermarks may identify requester/time for sensitive PDFs.
- Apply minimum-group suppression for HR/demographic aggregates and spreadsheet-formula injection protection in CSV/XLSX.

## Delivery blueprint

| Phase | Deliverable | Dependency |
|---|---|---|
| A | Reporting ADR, catalog/definition contracts, permissions, common parameters and truthful existing-report inventory | Current app |
| B | Run engine, background jobs, artifacts, CSV/XLSX/PDF, audit, saved views and Report Center | A |
| C | Student + current Attendance reports; align existing Finance report | B |
| D | Academic report card/tabulation/progress against published result snapshots | Assessment plan |
| E | Student Accounting fee/receipt/due/fine reports | Student Accounting phases A–F |
| F | Office Accounting statements and transaction reports | Accounting ledger/report phases |
| G | HR/payroll/leave reports | HR + Payroll ledgers |
| H | Inventory reports | Inventory transaction ledger |
| I | Schedules, secure delivery, projections, performance/operations console | Stable prior reports |
| J | Optional analyst BI/semantic layer or warehouse after scale proves need | Governance decision |

Implement A → B → C first. Domain-dependent reports stay visibly `not_ready` until their source contracts exist; never ship mock totals.

## Acceptance and tracking

- Golden-dataset tests validate formulas, denominators, joins, status inclusion and as-of behavior for every definition/version.
- Tenant/branch/role/guardian field-security tests run for preview, export, schedule and download—not only the page.
- Export totals/filters match the on-screen run; snapshots reproduce after source data changes; expired links fail.
- Load tests enforce query timeout, row/artifact limits, tenant fairness and cancellation. Projection lag is visible.
- Reconciliation: fee reports to receivables/control accounts, financial statements to trial balance, payroll summary to payroll run, inventory totals to movement ledger, report cards to published results.
- Track run success/latency, queue wait, rows/bytes, cache/projection freshness, failures by definition, downloads, schedule delivery and reconciliation differences.

## Open-source references and tool choices

- Apache Superset: visualization, semantic metadata, caching and role concepts — https://github.com/apache/superset (Apache-2.0).
- Metabase: approachable report catalog/filter/drill UX — https://github.com/metabase/metabase (embedding/licensing requires careful review).
- Cube: semantic-layer/pre-aggregation concepts — https://github.com/cube-js/cube
- DuckDB: optional isolated export/analytics processing over Parquet, not the transactional source of truth — https://github.com/duckdb/duckdb
- ExcelJS: XLSX generation candidate — https://github.com/exceljs/exceljs

V1 recommendation: build curated reporting natively in SchoolOS with existing React/Recharts and PostgreSQL read models. Do not embed a full BI platform until self-service analyst demand, operational capacity and licensing have been proven.

## Decisions to confirm later

1. Which reports may be scheduled externally, and must delivery be secure-link-only?
2. Is XLSX required at launch or are CSV/PDF sufficient?
3. Which roles may view individual payroll and credential-status reports?
4. Should V2 include a self-service report builder, or remain curated-only?

