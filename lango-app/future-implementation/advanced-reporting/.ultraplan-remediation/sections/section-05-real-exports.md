# Section 05: Real Exports & Durable Storage

## Overview
Replaces the fake XLSX (legacy SpreadsheetML XML) and fake PDF (HTML served with a `.pdf` filename) exporters with genuine `exceljs`/`pdfkit`-based generation, fixes the hardcoded checksum string to a real SHA-256 hash, and stores generated files durably in the existing tenant-namespaced uploads volume with a retention window, per the PRD.

## Risk: yellow - two new dependencies and new binary-buffer handling, but each library's usage is a small, well-documented API surface

## Dependencies
- Depends on: section-01 (retention columns)
- Blocks: section-06
- Parallel batch: 2

## TDD Test Stubs
- Test: A downloaded XLSX export genuinely opens as a valid spreadsheet (not XML-mislabeled-as-xlsx) with a header row, data rows, and a totals row for numeric columns.
- Test: A downloaded PDF export genuinely opens as a valid PDF (not HTML) with a title, generated-at timestamp, and a data table.
- Test: A cell value starting with `=`, `+`, `-`, or `@` in an XLSX export is escaped the same way the existing CSV exporter already escapes it, preventing formula injection.
- Test: The stored artifact's checksum is a real SHA-256 of the actual file bytes, verifiably different for two different reports' files.
- Test: A generated export file is written to the tenant-namespaced uploads volume and can be re-downloaded later without re-running the report.
- Test: A file older than the retention window is actually deleted by the cleanup process, and downloading it afterward returns the "no longer available" error from section-02.

## Tasks

<task type="auto" id="05-01">
  <name>Install exceljs and pdfkit, build the real XLSX exporter</name>
  <files>package.json, src/addons/advanced-reporting/services/exporters/excel-exporter.ts</files>
  <action>
    Add `exceljs` and `pdfkit` (plus `@types/pdfkit` as a dev dependency) to `package.json`. Rewrite `excel-exporter.ts` to build a real workbook via `exceljs`: header row (bold), one data row per record, a totals row summing any numeric columns, returning a `Buffer` via `workbook.xlsx.writeBuffer()`. Reuse the existing `CsvExporter.sanitizeValue`'s formula-injection escaping logic (import and call it, or extract it to a small shared helper both exporters use) on every cell value before writing it.
  </action>
  <verify>Generate an XLSX for a report with a value like `=1+1` in a cell and confirm the output file, when opened, shows the literal text (escaped), not an executed formula. Open the generated file in a spreadsheet program and confirm it's valid.</verify>
  <done>XLSX exports are genuine Excel files with formula-injection protection matching the existing CSV exporter's defense.</done>
</task>

<task type="auto" id="05-02">
  <name>Build the real PDF exporter</name>
  <files>src/addons/advanced-reporting/services/exporters/pdf-exporter.ts</files>
  <action>
    Rewrite `pdf-exporter.ts` to use `pdfkit`: create a document with the report title and a "Généré le {timestamp}" line, then render the data as a simple table (column headers in bold, then one row per record, paginating with `doc.addPage()` when content exceeds the page height). Collect output via the document's `data`/`end` stream events into a `Buffer`, matching the pattern researched (pipe to an array of chunks, resolve with `Buffer.concat` on `end`).
  </action>
  <verify>Generate a PDF for a report with more rows than fit on one page and confirm it produces multiple pages correctly. Open the file in a real PDF viewer and confirm it renders as an actual PDF, not HTML.</verify>
  <done>PDF exports are genuine PDF files, correctly paginated for larger reports.</done>
</task>

<task type="auto" id="05-03">
  <name>Fix the fake checksum and wire durable storage</name>
  <files>src/addons/advanced-reporting/services/run-engine.ts</files>
  <action>
    Replace the hardcoded `'sha256-mock-checksum-token'` literal with a real `crypto.createHash('sha256').update(fileBuffer).digest('hex')` call on the actual generated export buffer, matching the pattern already used correctly in `snapshot-service.ts`. Write a small `saveGeneratedFile(tenantId, subpath, buffer)` helper (new, local to the reporting addon's own service layer, since no existing helper handles server-generated buffers per research) that does `mkdir(recursive:true)` + `writeFile` under `path.join(UPLOADS_ROOT, tenantId, 'reports', ...)`, and call it after generating each export. Insert a `report_artifacts` row (this table already exists with exactly the right columns - `runId`, `format`, `filePath`, `fileSizeBytes`, `checksumSha256`, `expiresAt`) with `expiresAt` set to now + 60 days (per the PRD's 30-90 day retention decision).
  </action>
  <verify>Generate two different reports' exports and confirm their stored checksums differ and each is a real 64-character hex SHA-256 digest, not the old placeholder string. Confirm the file exists on disk under the tenant's uploads folder after generation.</verify>
  <done>Export artifacts have real checksums and are durably stored with a real expiry timestamp set.</done>
</task>

<task type="auto" id="05-04">
  <name>Build the file-retention cleanup task</name>
  <files>src/addons/advanced-reporting/services/run-engine.ts, src/addons/advanced-reporting/services/report-cleanup.ts</files>
  <action>
    Create a new `cleanupExpiredReportFiles()` function that queries `report_artifacts` where `expiresAt < now()`, deletes each file from disk, then deletes the `report_artifacts` row itself (this is safe and matches the PRD's "keep run metadata indefinitely" decision, because run history lives in the separate `report_runs` table, which this function never touches - only the artifact/file record is removed once the file is gone).  This function will be called by the scheduler worker built in section-06, alongside the due-schedule check, on the same interval - do not build a separate timer for it here, just make the function callable.
  </action>
  <verify>Manually set an old `artifactExpiresAt` on a test run row, call `cleanupExpiredReportFiles()`, and confirm the file is gone from disk, `artifactDeletedAt` is set, and the `report_runs` row itself still exists.</verify>
  <done>A real, callable cleanup function exists that removes expired files while preserving run history.</done>
</task>
