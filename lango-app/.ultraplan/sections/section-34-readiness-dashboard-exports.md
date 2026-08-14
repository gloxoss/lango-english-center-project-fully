# Section 34: Readiness dashboard cards + exports

## Overview
Small operational-readiness surface (offerings without a primary teacher, unpublished-timetable warnings, pending promotion batches) plus CSV export for promotion batch history - the doc's final Phase 5 item, and the natural place to finally give the promotion ledger a visible history view (mentioned but not built in this plan's earlier sections).

## Risk: [green] - read-only aggregates + a CSV export reusing the existing exportToCsv helper, no new write paths

## Dependencies
- Depends on: sections 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32 (reads data/concepts from all of them - genuinely the last section to execute)
- Blocks: none
- Parallel batch: 5

## TDD Test Stubs
- Test: readiness cards match a manual count against real data (reuses section-26's coverage-metrics query pattern, extended with timetable/promotion signals)
- Test: CSV export contains one row per promotion_decisions row with correct student/decision/date columns

## Tasks

<task type="auto" id="34-01">
  <name>Readiness cards on the academics dashboard</name>
  <files>src/features/academics/ui/academic-readiness-view.tsx (new or extend an existing dashboard view if one already covers this area by execution time), src/app/api/academics/coverage/route.ts (extend from section-26)</files>
  <action>
    Extend section-26's coverage endpoint (don't build a parallel one) with two more signals: sessions/offerings with a draft-only timetable (no published version per section-28), and promotion batches created but not yet reflected in a completed session transition (informational, not a hard warning). Render as KPI cards at the top of the academics area, matching the existing KPI-banner pattern used throughout the app.
  </action>
  <verify>manual check against a real tenant with a deliberately-unpublished draft and a recent promotion batch</verify>
  <done>Readiness cards show real, current operational gaps</done>
</task>

<task type="auto" id="34-02">
  <name>Promotion batch history view + CSV export</name>
  <files>src/features/students/ui/promotion-history-view.tsx (new), src/app/[locale]/(dashboard)/dashboard/students/promotion-history/page.tsx (new)</files>
  <action>
    Fetch GET /api/students/promotions (already returns batch list from this session's earlier work) and, per batch, GET the decisions (extend the existing GET to optionally expand decisions, or add ?batchId= to fetch one batch's decisions - reuse, don't duplicate the query). Table of batches with drill-down to per-student decisions. "Exporter CSV" button uses the existing `exportToCsv<T>(rows, filename)` helper (src/libs/csv-export.ts) - already in the codebase, not rebuilt.
  </action>
  <verify>tsc --noEmit clean; export a real batch's decisions to CSV, confirm the file contents match the DB rows</verify>
  <done>Promotion ledger finally has a visible history surface, not just an API</done>
</task>
