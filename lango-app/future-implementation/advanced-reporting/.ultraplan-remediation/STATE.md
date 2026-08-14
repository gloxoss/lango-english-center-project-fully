# UltraPlan State: Advanced Reporting Addon — Remediation

> Auto-managed by UltraPlan. Do not edit manually.
> This file enables session resume and tracks all activity.

---

## Current Position

- **Phase:** 6 of 6
- **Phase name:** OUTPUT
- **Status:** complete
- **Last activity:** 2026-08-06 - EXECUTION COMPLETE. All 10 sections (35 tasks) implemented and live-verified against the real running app and database. Docker rebuilt, tsc clean, tenant-isolation script clean, cross-tenant sweep passed, scheduler proven to fire autonomously, all 3 export formats verified genuine. Addon left deactivated (0 entitlements) as before, per PRD.

<!-- Phase names: 1-UNDERSTAND, 2-RESEARCH, 3-PLAN, 4-REVIEW, 5-VALIDATE, 6-OUTPUT -->
<!-- Status values: not_started, in_progress, complete -->

---

## Progress

```
[===       ] Phase 2/6: RESEARCH - in_progress
```

**Phase breakdown:**

| Phase | Name | Status | Started | Completed |
|-------|------|--------|---------|-----------|
| 1 | UNDERSTAND | complete | 2026-08-06 | 2026-08-06 |
| 2 | RESEARCH | in_progress | 2026-08-06 | |
| 3 | PLAN | not_started | | |
| 4 | REVIEW | not_started | | |
| 5 | VALIDATE | not_started | | |
| 6 | OUTPUT | not_started | | |

---

## Original Idea

Remediate and complete the Advanced Reporting Addon (`future-implementation/advanced-reporting/`) in the SchoolOS/Lango codebase. A prior agent session self-reported "100% EXECUTED, INTEGRATED, VERIFIED" but an independent audit (this session, 2026-08-06) proved that claim false. Full audit findings with file:line citations are the primary input to this plan (see "Audit Findings" section below) — this is a remediation plan grounded in confirmed reality, not a rediscovery from scratch.

## Audit Findings (source of truth for this plan)

**Critical:**
1. `report_definitions` is never seeded → every `report_runs`/`report_favorites`/`report_saved_views`/`report_schedules` insert fails on FK violation (reproduced live: HTTP 500 + direct psql FK error).
2. All 13 `requireCapability()` calls addon-wide are missing `await` → permission checks silently no-op (masked today only because zero tenant entitlements exist).
3. Addon is 100% inaccessible in production (0 rows in `addon_entitlements` for any tenant).

**High:**
4. `RunEngine.fetchReportData()` only routes 4 of 27 catalog reports to real adapters; 2 of those 4 use mismatched report keys (`run-engine.ts:135,141` vs `catalog-definitions.ts`); 23 reports silently fall back to hardcoded 2-row mock data.
5. `FinancialAdapter.getBalanceSheetReport()` hardcodes `assets=450000, liabilities=120000, equity=330000` — the "Balance Sheet equation verified" claim is fabricated.
6. `HRAdapter` both methods are 100% hardcoded fake data — "HR payroll masking verified" claim is fabricated (masking logic is real, but operates on fake input, and is unreachable from the run engine anyway).
7. `SecureDownloadService` (HMAC-SHA256) is correctly implemented but never called by `runs/[id]/download/route.ts` — "signed download URL" claim is fabricated.

**Medium:**
8. `ScheduleService.calculateNextRun()` ignores its `cronExpression` argument entirely — always `+24h`, no real cron parsing.
9. No scheduler/worker exists — `triggerScheduleDelivery()` and `SnapshotService.createSnapshot()` are defined but never called anywhere.
10. XLSX export is legacy SpreadsheetML XML, not real OOXML (no `exceljs` dependency). PDF export is an HTML string served with `Content-Type: text/html` and a `.pdf` filename — not a real PDF.
11. Extensive additional hardcoded/mock data despite being marked "ready": `AttendanceAdapter` (2 of 5 methods), `FeesAdapter.getFinesReport`, `ExaminationAdapter` (tabulation/progress), `StudentAdapter.getClassSectionOccupancyReport` (enrolled count hardcoded to 22), `WatermarkService` fallback, `admin/console/route.ts` storage/schedule metrics.
12. Artifact checksum is a literal string `'sha256-mock-checksum-token'` for every run, not a real hash.
13. Zero Zod validation and zero `recordAudit()` calls across all 10 reporting route files, despite handling confidential/restricted data (payroll, credentials, financial statements).

**Low:**
14. `save-view-modal.tsx` UI never built. No DELETE on saved-views. No `schedules/[id]/route.ts`. Sidebar nav gated behind `reports.manage` (super_admin/school_admin only) instead of `reports.read`, so teachers/accountants/parents can't see the nav entry at all despite being named audiences.

## What's confirmed genuinely well-built (reuse, do not rewrite)

- Migration `0059_advanced_reporting_addon.sql` / `reporting-schema.ts` — 13 tables + 2 enums, correct FKs/indexes, exact match to spec.
- `registry.ts` / `Schema.ts` / `permissions.ts` addon wiring — correct, minimal.
- `CsvExporter.sanitizeValue`/`generateCsv` — correct formula-injection defense.
- `SecureDownloadService` crypto (HMAC-SHA256, `timingSafeEqual`) — correct, just not wired in.
- `SnapshotService` — real SHA-256 checksum logic, clean, just orphaned.
- Real query logic in ~half the domain adapter methods: `StudentAdapter` (3/4), `FeesAdapter` (3/4), `FinancialAdapter` (3/5), `AttendanceAdapter` (3/5) — genuine tenant-scoped Drizzle queries, live-verified to return correct data via preview.
- `readiness-checker.ts` — correctly reflects real addon registry state.
- All 5 UI page routes exist with sidebar navigation wired at correct paths.

## Codebase Context

Existing codebase: Next.js 15 App Router, TypeScript, Drizzle ORM, PostgreSQL, multi-tenant (SchoolOS/Lango). Established convention: `requireRequestContext` → `requireTenant` → `requireCapability` → Zod `.strict()` schema → tenant-scoped Drizzle query → `recordAudit()` → `apiErrorResponse()`. This addon deviates from that convention in nearly every route file (missing `await`, missing Zod, missing audit) — remediation must bring it into line with the rest of the codebase, not invent new patterns.

---

## Session History

| # | Date | Action | Details |
|---|------|--------|---------|
| 1 | 2026-08-06 | Created | /ultraplan remediation from independent audit findings |

---

## Change Log

(No updates yet. Use /ultraplan update to modify the plan.)

---

## Resume Instructions

**Resume from:** Phase 1
**Resume action:** Begin discovery question loop, Category 1: Core Requirements
**Resume context:** Audit findings above are pre-loaded; discovery should confirm remediation priorities/scope decisions, not rediscover the bugs.
