# Section 07: Academic, HR & Inventory Adapters

## Overview
This section builds query adapters and UI views for Examination Reports (Published Report Card, Tabulation Sheet, Progress Report), HR Reports (Payroll Summary, Leave Balances), and Inventory Reports (Stock Valuation, Purchase Summary, Sales Revenue, Issues Custody).

## Risk: yellow - Privacy suppression for HR payroll & snapshot versioning for report cards
Payroll reports must enforce minimum-group aggregation suppression to prevent individual salary disclosure. Report Card generation relies on immutable `report_snapshots`. Uninstalled modules display `not_ready` state.

## Dependencies
- **Depends on:** section-02, section-03
- **Blocks:** section-09 (verification)
- **Parallel batch:** 3

## TDD Test Stubs
- Test: `HRAdapter.getPayrollSummaryReport()` suppresses salary details if employee group size is less than 3.
- Test: `ExamAdapter.getReportCardSnapshot()` retrieves published, immutable report card snapshot with SHA-256 validation.
- Test: Inventory reports return `not_ready` readiness status when inventory tables are absent.

## Tasks

<task type="auto" id="07-01">
  <name>Build Examination Domain Query Adapter & Snapshot Generator</name>
  <files>src/addons/advanced-reporting/adapters/examination-adapter.ts, src/addons/advanced-reporting/services/snapshot-service.ts</files>
  <action>
    Create `ExaminationAdapter` executing queries for:
    1. `exam.report_card`: Published result snapshot retrieval with SHA-256 checksum audit.
    2. `exam.tabulation_sheet`: Candidate x subject marks/grades matrix with deterministic rank calculation.
    3. `exam.progress`: Period-over-period competency progress trends.
    Build `SnapshotService` to archive closed assessment results and report card payloads into `report_snapshots`.
  </action>
  <verify>Verify snapshot creation and SHA-256 checksum verification.</verify>
  <done>ExaminationAdapter and SnapshotService operational.</done>
</task>

<task type="auto" id="07-02">
  <name>Build Examination Reports View UI</name>
  <files>src/addons/advanced-reporting/ui/views/examination-reports-view.tsx</files>
  <action>
    Create UI component rendering student report card previews, tabulation sheet grids with print layout CSS, and subject competency progress charts.
  </action>
  <verify>Check print layout stylesheet styling for tabulation sheet grid.</verify>
  <done>Examination reports UI view built with print styling support.</done>
</task>

<task type="auto" id="07-03">
  <name>Build HR Domain Query Adapter with Privacy Suppression</name>
  <files>src/addons/advanced-reporting/adapters/hr-adapter.ts</files>
  <action>
    Create `HRAdapter` executing queries for:
    1. `hr.payroll_summary`: Department headcount, gross pay, deductions, and employer cost with minimum-group size suppression (groups < 3 return masked aggregates).
    2. `hr.leave_balances`: Entitlements, used leave, and remaining balances by employee type.
  </action>
  <verify>Test small department query (< 3 staff) and confirm salary aggregation masking.</verify>
  <done>HRAdapter operational with small-group disclosure protection.</done>
</task>

<task type="auto" id="07-04">
  <name>Build HR Reports View UI</name>
  <files>src/addons/advanced-reporting/ui/views/hr-reports-view.tsx</files>
  <action>
    Create UI view for HR domain reports showing department payroll breakdown cards and leave balance status bars.
  </action>
  <verify>Verify masked privacy warning alert when group size is small.</verify>
  <done>HR reports UI view integrated.</done>
</task>

<task type="auto" id="07-05">
  <name>Build Inventory Domain Query Adapter</name>
  <files>src/addons/advanced-reporting/adapters/inventory-adapter.ts</files>
  <action>
    Create `InventoryAdapter` executing queries for:
    1. `inventory.stock_valuation`: On-hand stock quantity, location, reorder alert status, and valuation.
    2. `inventory.purchase_summary`: Purchase orders, receipts, and supplier totals.
    3. `inventory.sales_revenue`: School-shop sales, returns, and payment state.
    4. `inventory.issues_custody`: Issued equipment loans, due dates, and return condition.
    Returns `not_ready` state if inventory addon is disabled.
  </action>
  <verify>Verify readiness check returns false when inventory module is disabled.</verify>
  <done>InventoryAdapter operational with module readiness checks.</done>
</task>

<task type="auto" id="07-06">
  <name>Build Inventory Reports View UI</name>
  <files>src/addons/advanced-reporting/ui/views/inventory-reports-view.tsx</files>
  <action>
    Create UI view for Inventory domain reports showing stock valuation tables, reorder alert cards, and equipment issue custody logs.
  </action>
  <verify>Verify `not_ready` badge rendering when inventory addon is inactive.</verify>
  <done>Inventory reports UI view integrated.</done>
</task>
