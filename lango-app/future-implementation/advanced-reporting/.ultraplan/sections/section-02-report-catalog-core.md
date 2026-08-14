# Section 02: Report Catalog Core & Definition Registry

## Overview
This section builds the Report Catalog Registry service (`catalog-service.ts`), registers all 31 core report definitions across the 7 operational domains, implements domain readiness checking (flagging uninstalled/unbuilt modules with `not_ready`), and exposes `GET /api/addons/reporting/catalog`.

## Risk: green - In-memory/database registry with readiness metadata
Straightforward registry logic. Low risk.

## Dependencies
- **Depends on:** section-01
- **Blocks:** section-04 (UI workspaces), section-05..07 (adapters)
- **Parallel batch:** 2

## TDD Test Stubs
- Test: `CatalogService.getDefinitions()` returns 31 registered reports.
- Test: Reports belonging to installed core modules (Student, Attendance, Financial) report readiness `ready: true`.
- Test: Reports requiring uninstalled/future modules (HR, Inventory) report `ready: false` with reason `missing_domain_contract`.
- Test: `GET /api/addons/reporting/catalog` returns 200 OK and filters list by user capabilities.

## Tasks

<task type="auto" id="02-01">
  <name>Create CatalogService and report definition contracts</name>
  <files>src/addons/advanced-reporting/services/catalog-service.ts, src/addons/advanced-reporting/types/reporting-types.ts</files>
  <action>
    Create TypeScript interface `ReportDefinitionContract` with key, domain, title, description, sensitivity, freshness, executionAdapter, parameterSchema, columnSchema, supportedFormats, requiredPermissions. Implement `CatalogService` to query DB definitions and fallback to built-in code registry.
  </action>
  <verify>Run `npx tsc --noEmit` to verify type safety.</verify>
  <done>CatalogService and report contracts defined cleanly.</done>
</task>

<task type="auto" id="02-02">
  <name>Register 31 report definitions in CatalogService</name>
  <files>src/addons/advanced-reporting/services/catalog-definitions.ts</files>
  <action>
    Populate definitions for:
    - Student Reports (4): `student.credentials`, `student.admission_funnel`, `student.class_section_occupancy`, `student.siblings`.
    - Fees Reports (4): `fees.summary`, `fees.receipts`, `fees.due_aging`, `fees.fines`.
    - Financial Reports (5): `finance.statement`, `finance.income_expense`, `finance.transactions`, `finance.balance_sheet`, `finance.income_vs_expense`.
    - Attendance Reports (5): `attendance.student_log`, `attendance.daily_matrix`, `attendance.overview_streaks`, `attendance.employee_summary`, `attendance.exam_session`.
    - HR Reports (2): `hr.payroll_summary`, `hr.leave_balances`.
    - Examination Reports (3): `exam.report_card`, `exam.tabulation_sheet`, `exam.progress`.
    - Inventory Reports (4): `inventory.stock_valuation`, `inventory.purchase_summary`, `inventory.sales_revenue`, `inventory.issues_custody`.
    - Platform/Audit Reports (4): `platform.audit_trail`, `platform.export_history`, `platform.schedule_log`, `platform.projection_health`.
  </action>
  <verify>Ensure all 31 keys are exported and mapped with exact parameters and required permissions.</verify>
  <done>31 report definitions registered in catalog-definitions.ts.</done>
</task>

<task type="auto" id="02-03">
  <name>Implement domain readiness & permission filter logic</name>
  <files>src/addons/advanced-reporting/services/readiness-checker.ts</files>
  <action>
    Implement `checkDomainReadiness(domainKey)` to inspect installed tables/addons and return `{ isReady: boolean, reason?: string }`. Filter catalog response by caller's active user capabilities.
  </action>
  <verify>Unit test `readiness-checker.ts` against installed vs uninstalled domains.</verify>
  <done>Domain readiness checker filters catalog based on system contract state.</done>
</task>

<task type="auto" id="02-04">
  <name>Implement GET /api/addons/reporting/catalog route handler</name>
  <files>src/app/api/addons/reporting/catalog/route.ts</files>
  <action>
    Create Next.js API route GET handler wrapping `requireAddon('advanced-reporting')` and `requireCapability('reporting.catalog.read')`. Call `CatalogService.getDefinitionsForUser(userId)`.
  </action>
  <verify>Test GET request with API test client and verify 200 OK JSON response containing report cards and readiness badges.</verify>
  <done>Catalog API endpoint operational and gated by entitlements/capabilities.</done>
</task>
