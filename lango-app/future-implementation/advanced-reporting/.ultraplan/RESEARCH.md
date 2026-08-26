# UltraPlan Research — Advanced Reporting Add-on

## Technical Architecture & Ecosystem Analysis

### 1. Database Schema & Migration Strategy
- **Migration:** `migrations/0059_advanced_reporting_addon.sql` + Drizzle schema in `src/addons/advanced-reporting/models/reporting-schema.ts`.
- **Tables Needed:**
  1. `report_definitions`: Catalog of report keys, titles, domain, execution adapters, parameters/columns schemas.
  2. `report_definition_versions`: Version history and immutable SQL/adapter contract definitions.
  3. `report_saved_views`: User-saved filter parameters and shared view definitions.
  4. `report_favorites`: User favorite report bookmarks.
  5. `report_runs`: Asynchronous and synchronous execution logs, parameters, row count, execution time, status.
  6. `report_run_events`: Granular execution logs and diagnostic trace events.
  7. `report_artifacts`: Generated CSV/XLSX/PDF file metadata, storage path, checksum, expiry.
  8. `report_schedules`: Recurrence configuration, timezone, parameters, active state.
  9. `report_schedule_recipients`: Schedule target list (users, emails, roles).
  10. `report_snapshots`: Immutable JSON snapshots for period-close and academic report cards.
  11. `report_snapshot_sources`: Source table lineage and watermark state for snapshots.
  12. `report_projection_watermarks`: Materialized view & aggregate freshness watermarks.
  13. `report_delivery_events`: Scheduled delivery audit trails.

### 2. Export Generation
- **CSV:** Native streaming with string escaping and spreadsheet formula injection protection (prefixing `=`, `+`, `-`, `@` with `'`).
- **XLSX:** Integrated builder via `exceljs` supporting custom header styling, auto-column width, formatted numbers/dates, and multi-sheet summaries.
- **PDF:** Server-side document rendering template with watermarking (requester ID + timestamp) and print-optimized page breaks.

### 3. API Contract & Routing
- Base Route: `/api/addons/reporting/`
- Entitlement Gate: `requireAddon('advanced-reporting')` in `src/libs/api/entitlements.ts`.
- Capability Gates: Reuses existing domain capabilities (`students.read`, `finance.read`, `academics.read`, `attendance.read`) plus reporting management capabilities.

### 4. UI Design System Integration
- Follows SchoolOS's design system: Tailwind v4 styling, dark/light theme support, accessible tables, filter drawers, chart cards (Recharts), status pills, and empty/error states.
- Shared views:
  - `ReportCenterView`: Catalog grid, search, filter by domain, favorites, domain readiness badges.
  - `ReportWorkspaceView`: Parameters bar, live preview table, pagination, chart visualization, export actions, schedule trigger.
  - `MyRunsView`: Background run queue status, live polling, direct download buttons.
  - `SchedulesView`: Cron schedule manager, active state toggle, recipient configuration.
  - `ReportingAdminConsoleView`: Projection lag monitor, failure trace, storage quota stats.

## Conflict Resolution
- **Issue:** Should raw SQL query builders be exposed to school administrators?
  - **Resolution:** No. V1 provides curated, typed report adapters to prevent SQL injection, cross-tenant data leaks, and database pool starvation.
- **Issue:** Should reports copy source data into a reporting database?
  - **Resolution:** Operational reports query existing transactional/read-model tables directly with tenant isolation. Closed-period statutory reports use immutable `report_snapshots` within Postgres.
