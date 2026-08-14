# Section 08: Schedules Engine, Secure Delivery & Admin Console

## Overview
This section builds the automated cron schedule engine (`schedule-service.ts`), signed secure link delivery mechanism, projection freshness watermarks tracker, and the Reporting Admin Console UI (`admin/page.tsx`).

## Risk: yellow - Background scheduling & secure link authorization
Schedules must re-authorize recipient access at download time and deliver secure signed links rather than sensitive raw attachments.

## Dependencies
- **Depends on:** section-04
- **Blocks:** section-09 (verification)
- **Parallel batch:** 4

## TDD Test Stubs
- Test: `ScheduleService.calculateNextRun()` correctly parses standard cron expressions.
- Test: Download link generated for scheduled reports contains HMAC signature and expires after 24 hours.
- Test: Accessing an expired or tampered download link returns 403 Forbidden.
- Test: `/dashboard/reports/admin` renders projection freshness watermarks and storage quota usage.

## Tasks

<task type="auto" id="08-01">
  <name>Build ScheduleService background execution engine</name>
  <files>src/addons/advanced-reporting/services/schedule-service.ts, src/app/api/addons/reporting/schedules/route.ts, src/app/api/addons/reporting/schedules/[id]/route.ts</files>
  <action>
    Implement `ScheduleService` to calculate next run dates based on cron expressions, trigger background report execution, format secure delivery notifications, and log events in `report_delivery_events`. Implement CRUD API routes for schedules.
  </action>
  <verify>Test schedule creation and next-run-date calculation via unit tests.</verify>
  <done>ScheduleService operational with cron parsing and delivery logging.</done>
</task>

<task type="auto" id="08-02">
  <name>Implement Secure Signed Download Link generator and handler</name>
  <files>src/addons/advanced-reporting/services/secure-download.ts, src/app/api/addons/reporting/runs/[id]/download/route.ts</files>
  <action>
    Create signed URL generator using HMAC SHA-256 with 24-hour expiration. Implement GET `/api/addons/reporting/runs/[id]/download` handler to verify signature, re-check user capability, increment `downloadCount`, log audit trail, and stream file.
  </action>
  <verify>Test valid vs expired vs tampered download URLs.</verify>
  <done>Secure signed download API active with audited delivery access.</done>
</task>

<task type="auto" id="08-03">
  <name>Build Projection Watermark service & lag monitor</name>
  <files>src/addons/advanced-reporting/services/watermark-service.ts, src/app/api/addons/reporting/admin/console/route.ts</files>
  <action>
    Implement `WatermarkService` to update and query projection lag, execution times, storage usage, and slow report queries. Expose API endpoint GET `/api/addons/reporting/admin/console`.
  </action>
  <verify>Call admin console endpoint and inspect lag metrics JSON.</verify>
  <done>WatermarkService and Admin Console API operational.</done>
</task>

<task type="auto" id="08-04">
  <name>Build Schedules and Admin Console UI pages</name>
  <files>src/app/[locale]/(dashboard)/dashboard/reports/schedules/page.tsx, src/addons/advanced-reporting/ui/schedules-view.tsx, src/app/[locale]/(dashboard)/dashboard/reports/admin/page.tsx, src/addons/advanced-reporting/ui/reporting-admin-view.tsx</files>
  <action>
    Build frontend views for Schedules management (`/dashboard/reports/schedules`) with schedule form modal, recipient list editor, and active toggle. Build Admin Console view (`/dashboard/reports/admin`) with projection freshness gauges, storage usage charts, and slow query logs.
  </action>
  <verify>Build pages with `npx tsc --noEmit` and check UI components.</verify>
  <done>Schedules and Reporting Admin Console UI pages complete.</done>
</task>
