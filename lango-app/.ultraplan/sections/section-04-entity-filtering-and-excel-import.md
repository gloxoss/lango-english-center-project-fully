# Section 04: Entity Filtering & Excel Import Integration

## Overview
Connects the active branch scope to student, teacher, class, and invoice lists, and adds optional campus branch support to Excel data imports.

## Risk: [green] — Additive filtering & Excel column mapping

## Tasks

<task type="auto" id="04-01">
  <name>Filter Main Entity API Endpoints by Branch Scope</name>
  <files>src/app/api/students/route.ts, src/app/api/teachers/route.ts, src/app/api/academics/classes/route.ts, src/app/api/finance/invoices/route.ts</files>
  <action>
    Update GET handlers for `/api/students`, `/api/teachers`, `/api/academics/classes`, and `/api/finance/invoices` to check `ctx.branchId`. If `branchId` is present, apply `eq(table.branchId, ctx.branchId)`.
  </action>
  <verify>Call `/api/students?branchId=xyz` and verify SQL query filters cleanly by branch.</verify>
  <done>Core data endpoints respect active branch filter.</done>
</task>

<task type="auto" id="04-02">
  <name>Update Student & Teacher Excel Import Parsing</name>
  <files>src/app/api/students/import/route.ts, src/app/api/teachers/import/route.ts</files>
  <action>
    Add support for optional `"Succursale"` / `"Branch"` column in Excel imports to auto-link imported records to matching branch code or name.
  </action>
  <verify>Import sample Excel with branch column and verify records are saved with correct `branchId`.</verify>
  <done>Excel import engine supports branch mapping.</done>
</task>

<task type="auto" id="04-03">
  <name>Full End-to-End Verification & Build Check</name>
  <files>None (Verification)</files>
  <action>
    Run `npm run check:types`, run unit tests, and perform a production `docker compose build app` build to ensure zero regressions.
  </action>
  <verify>All type checks pass with 0 errors and Docker build completes successfully.</verify>
  <done>Multi-Campus Addon fully verified and production ready.</done>
</task>
