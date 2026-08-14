# UltraPlan PRD — Advanced Reporting Add-on

## 1. What We're Building
The Advanced Reporting Add-on is a governed, enterprise-grade reporting, analytics, export, and scheduled delivery system for Lango English Center (`lango-app`). It introduces a centralized Report Center catalog, asynchronous CSV/XLSX/PDF generation, saved filter views, period snapshots, automated delivery via background schedules, projection freshness tracking, and curated report suites across all 7 operational domains (Student, Fees, Financial, Attendance, HR, Examination, Inventory).

## 2. The Problem
Lango's core modules currently rely on isolated client-side exports or basic list views. School leaders, accountants, and administrators lack:
- A single governed catalog to discover and run cross-module reports.
- Reliable asynchronous background exports for large datasets without timing out web requests.
- Immutable snapshotting for closed financial periods and official student report cards.
- Scheduled delivery of recurring reports (e.g. daily attendance summaries or weekly fee collections) directly to stakeholders.
- Formula-injection defense and minimum-group privacy protection in exports.

## 3. Who It's For
- **School Leadership & Admins:** Oversee center performance, enrollment funnels, attendance trends, and operational health.
- **Accountants & Finance Staff:** Track fee receivables, aging dues, posted receipts, income vs expense, and ledger balances.
- **Teachers & Academic Staff:** View student attendance history, examination tabulation sheets, and progress reports.
- **HR & Operations Managers:** Monitor workforce payroll summaries and leave balances.
- **Parents & Guardians:** Access portal-safe student academic progress and attendance reports.

## 4. What It Does (Feature Breakdown)

### Shared Reporting Platform
- **Report Catalog & Center (`/dashboard/reports`):** Search, domain filter cards, favorites, domain readiness indicators, permission-aware visibility.
- **Report Workspace (`/dashboard/reports/[key]`):** Parameter bar with validation, dynamic datatable, paginated view, total aggregations, Recharts visualization, export triggers, save view modal, schedule modal.
- **My Runs (`/dashboard/reports/runs`):** Asynchronous run queue status, execution progress, log viewer, secure expiring download links.
- **Schedules (`/dashboard/reports/schedules`):** Cron-based automated execution, format selection, recipient targeting, execution history.
- **Admin Console (`/dashboard/reports/admin`):** Projection freshness watermarks, query latency logs, storage usage metrics, schedule health.

### Domain Report Suites
1. **Student Reports:** Credential Readiness Status (masked, zero plain passwords), Admission Conversion Funnel, Class & Section Occupancy, Sibling & Household Distribution.
2. **Fees Reports:** Fee Allocation Summary, Posted Receipts Ledger, Receivables Aging (Due Fees), Fine Assessment & Waiver Log.
3. **Financial Reports:** Account Statement, Income & Expense Ledger, Posted Transactions, Balance Sheet, Income vs Expense Trends.
4. **Attendance Reports:** Student Attendance Log, Daily Section Matrix, Student Risk & Streak Overview, Employee Punch/Hours Summary, Exam Session Attendance.
5. **Human Resource Reports:** Payroll Run Summary (with minimum-group suppression), Leave Entitlement & Balance Ledger.
6. **Examination Reports:** Published Report Card Generator, Class Tabulation Sheet, Subject Progress & Competency Report.
7. **Inventory Reports:** Stock Valuation & On-Hand Ledger, Purchase Order Summary, Sales & Revenue Log, Item Issue & Consumption Ledger.

## 5. What It Does NOT Do
- Does NOT expose raw, arbitrary SQL query builders to end users.
- Does NOT copy source domain transactional data into separate un-synced reporting tables (queries hit domain read models directly or read immutable snapshots).
- Does NOT display mock data when a domain module is uninstalled or incomplete — displays `not_ready` readiness badges instead.
- Does NOT export plain passwords, password hashes, or login secrets in credential status reports.

## 6. How We'll Know It Works (Success Criteria)
- 100% of 13 reporting database tables created cleanly via migration `0059`.
- All shared pages (Report Center, Workspace, My Runs, Schedules, Admin) load with zero runtime errors.
- Asynchronous CSV and XLSX exports complete for up to 50,000 rows with formula-injection escaping.
- Period snapshots record SHA-256 checksums and prevent alteration once closed.
- Scheduled runs execute according to cron expressions and audit delivery events.
- Unit and integration tests pass cleanly with `npm test`.

## 7. Risks & Mitigation
- **Risk:** Heavy operational queries slowdown production database.
  - **Mitigation:** Strict 30-second query timeouts, 50k row caps, indexes on all report query paths, and projection watermarks.
- **Risk:** Sensitive salary or credential exposure.
  - **Mitigation:** Restrict sensitive fields, suppress small-group HR aggregates (< 3 employees), and completely strip credential secrets.
