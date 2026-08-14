# Section 03: Run Engine & Export Generators

## Overview
This section builds the asynchronous Report Run Engine (`run-engine.ts`), preview execution handler, streaming CSV generator with formula-injection sanitization, ExcelJS XLSX generator, and PDF document generator. Exposes `/api/addons/reporting/reports/[key]/preview`, `/run`, and `/runs`.

## Risk: yellow - File generation, memory bounds, formula injection defense
Handling potentially large export files requires streaming, row limits (50k cap), formula injection escaping, and clean signed URL expiry.

## Dependencies
- **Depends on:** section-01
- **Blocks:** section-04 (UI workspaces), section-08 (schedules)
- **Parallel batch:** 2

## TDD Test Stubs
- Test: `RunEngine.executePreview()` returns 50 sample rows within 500ms.
- Test: `RunEngine.startBackgroundRun()` creates a `report_runs` row with `queued` status and processes asynchronously.
- Test: CSV exporter prefixes `=cmd|' /C calc'!A0` with `'` to prevent spreadsheet execution.
- Test: XLSX generator formats multi-sheet workbooks with auto-width columns and custom header styles.

## Tasks

<task type="auto" id="03-01">
  <name>Implement RunEngine service with parameter validation and row caps</name>
  <files>src/addons/advanced-reporting/services/run-engine.ts</files>
  <action>
    Build `RunEngine` class. Validate runtime parameters against definition JSON schema. Enforce 50k row export limit and 30-second query timeout. Record execution metrics in `report_runs` and `report_run_events`.
  </action>
  <verify>Run unit tests validating parameter type checking and timeout enforcement.</verify>
  <done>RunEngine handles synchronous previews and asynchronous job queuing cleanly.</done>
</task>

<task type="auto" id="03-02">
  <name>Build CSV export generator with formula sanitization</name>
  <files>src/addons/advanced-reporting/services/exporters/csv-exporter.ts</files>
  <action>
    Create `CsvExporter` class. Stream dataset rows to string buffer/file stream. Escape double quotes and prefix values starting with `=`, `+`, `-`, `@` with `'` to prevent CSV injection vulnerabilities.
  </action>
  <verify>Test exporting strings with formula characters and verify output escaping.</verify>
  <done>CSV exporter sanitizes inputs and streams large datasets efficiently.</done>
</task>

<task type="auto" id="03-03">
  <name>Build ExcelJS XLSX and PDF export generators</name>
  <files>src/addons/advanced-reporting/services/exporters/excel-exporter.ts, src/addons/advanced-reporting/services/exporters/pdf-exporter.ts</files>
  <action>
    Integrate `exceljs` library in `ExcelExporter` to build styled multi-tab workbooks with auto-filtered headers, number formatting, and totals rows. Create HTML-to-PDF print adapter in `PdfExporter` with requester timestamp watermark headers.
  </action>
  <verify>Generate test XLSX and PDF artifacts and inspect checksums and file sizes.</verify>
  <done>ExcelJS and PDF export generators create formatted downloadable artifacts.</done>
</task>

<task type="auto" id="03-04">
  <name>Implement Run and Preview API route handlers</name>
  <files>src/app/api/addons/reporting/reports/[key]/preview/route.ts, src/app/api/addons/reporting/reports/[key]/run/route.ts, src/app/api/addons/reporting/runs/route.ts, src/app/api/addons/reporting/runs/[id]/route.ts</files>
  <action>
    Create API route handlers for preview (synchronous first 50 rows), run initiation (returns runId), run list, and run detail/events log. Gate all handlers with `requireAddon('advanced-reporting')` and required domain capabilities.
  </action>
  <verify>Execute preview and run POST requests via API tests and verify 200 OK responses.</verify>
  <done>API routes for report preview, run execution, and run history active.</done>
</task>
