# Section 02: Route Layer Hardening

## Overview
Rewrites every reporting route file to genuinely match this codebase's established convention (`requireRequestContext` → `requireAddon` → `requireCapability` → Zod `.strict()` → tenant-scoped query → `recordAudit` → `apiErrorResponse`), fixing the addon-wide missing-`await` bug on `requireCapability`, adding the domain-scoped sensitivity access check (admin sees everything; teacher sees standard+restricted; accountant additionally sees restricted+confidential only within Fees/Financial domain reports), rate limiting on report execution, and audit logging on every mutating action.

## Risk: red - security-critical; this is the exact category of bug (missing await on an auth check) that caused a live unauthenticated-write vulnerability in a different addon fixed earlier this session

## Dependencies
- Depends on: section-01 (needs seeded report_definitions to check sensitivityLevel/domain against)
- Blocks: section-07, section-08, section-09
- Parallel batch: 2

## TDD Test Stubs
- Test: A logged-out request to any reporting route is rejected with 401, not silently allowed through.
- Test: `requireCapability` is genuinely awaited in every route - a role without the `reports.read`/`reports.export`/`reports.manage`/`reports.schedule` capability is rejected with 403, verified live, not just by reading the code.
- Test: A teacher can run a "standard" or "restricted" report but is rejected running a "confidential" one.
- Test: An accountant can run a "restricted" or "confidential" report in the Fees or Financial domain, but is rejected running a "confidential" HR or student-credential report.
- Test: Malformed request bodies are rejected with a clear 422 validation error, not a 500.
- Test: Running a report writes a real `recordAudit` entry with the correct action/entityType/entityId.
- Test: Running many reports rapidly in a short window is rejected with 429 once the rate limit is exceeded.
- Test: The runs list route returns a paginated response (not an unbounded array) matching this codebase's existing pagination shape.

## Tasks

<task type="auto" id="02-01">
  <name>Build the domain-scoped report access helper</name>
  <files>src/addons/advanced-reporting/services/report-access.ts</files>
  <action>
    Create a new small service function `canAccessReport(role: AppRole, reportDefinition: {sensitivityLevel: string; domain: string}): boolean`. Logic: `school_admin` always true. `teacher` true for `sensitivityLevel` in `standard`/`restricted`, false for `confidential`. `accountant` true for `standard` always, and true for `restricted`/`confidential` only when `domain` is `Fees` or `Financial`, false otherwise. All other roles false. This matches the discovery-approved access matrix and reuses the catalog's existing `sensitivityLevel`/`domain` fields rather than inventing new permission infrastructure.
  </action>
  <verify>Call the function directly with each role/sensitivity/domain combination from the TDD stubs above and confirm the boolean matches the approved matrix exactly.</verify>
  <done>A single, testable function exists that encodes the approved per-report access matrix.</done>
</task>

<task type="auto" id="02-02">
  <name>Rewrite catalog and favorites routes</name>
  <files>src/app/api/addons/reporting/catalog/route.ts, src/app/api/addons/reporting/favorites/route.ts</files>
  <action>
    Rewrite both files to the exact convention: `requireRequestContext` → `requireTenant` → `await requireAddon(tenantId, 'advanced-reporting')` → `await requireCapability(context, 'reports.read')` (adding the missing `await`). Add Zod `.strict()` schemas for the favorites POST/DELETE bodies via `parseJson`. Filter the catalog response through `canAccessReport` from task 02-01 so a role never sees a report it cannot run. Add `recordAudit(context, 'create'/'delete', 'report_favorite', ...)` on favorites mutations (not awaited, matching the codebase's fire-and-forget convention).
  </action>
  <verify>GET catalog as a teacher and confirm confidential reports are absent from the response. POST/DELETE favorites and confirm a real audit_logs row is written.</verify>
  <done>Catalog and favorites routes match codebase convention, enforce real capability checks, and filter by the access matrix.</done>
</task>

<task type="auto" id="02-03">
  <name>Rewrite report preview and run routes</name>
  <files>src/app/api/addons/reporting/reports/[key]/preview/route.ts, src/app/api/addons/reporting/reports/[key]/run/route.ts</files>
  <action>
    Rewrite both files to the full convention (context → tenant → addon → `await requireCapability`). Before executing, look up the report's `sensitivityLevel`/`domain` from `report_definitions` and call `canAccessReport` - throw `ApiError(403, 'FORBIDDEN', ...)` if false. Add `checkRateLimit(\`report-run:${tenantId}:${context.userId}\`, 20, 60 * 60 * 1000)` (20 runs/hour/user, matching the discovery decision to rate-limit given confidential data exposure) before executing the run. Add Zod `.strict()` validation for any report parameters in the request body. Add `recordAudit(context, 'export', 'report_run', ...)` on the run route (not the preview route, since preview is read-only and does not warrant an audit entry per this codebase's `recordAudit` action taxonomy).
  </action>
  <verify>Attempt to run a confidential report as a teacher and confirm 403. Run 21 reports in an hour as the same user and confirm the 21st is rejected 429. Confirm a real audit_logs row appears after a successful run.</verify>
  <done>Report execution enforces the access matrix, is rate-limited, and is audited.</done>
</task>

<task type="auto" id="02-04">
  <name>Rewrite runs list, run detail, and download routes</name>
  <files>src/app/api/addons/reporting/runs/route.ts, src/app/api/addons/reporting/runs/[id]/route.ts, src/app/api/addons/reporting/runs/[id]/download/route.ts</files>
  <action>
    Rewrite all three to the full convention. The runs list and detail routes must filter results to `report_runs.tenantId = tenantId` (already likely correct per the audit, but verify and fix if not) and additionally scope by `requesterId = context.userId` unless the caller is `school_admin` (a teacher should not see another teacher's run history by default). The runs list route must use this codebase's existing `parsePagination` helper (already used by every other list route in this app) rather than returning an unbounded result set. The download route must look up the matching `report_artifacts` row (by `runId` + requested `format`) and return a clear "this file is no longer available" error (not a raw file-not-found crash) if no row exists (already cleaned up per section-05) or its `expiresAt` has passed, per the PRD's expired-download decision.
  </action>
  <verify>As a teacher, request another teacher's run detail by ID and confirm 403/404 (not data leakage). Request a download past its expiry and confirm the clear "no longer available" message, not a stack trace or generic 500.</verify>
  <done>Run history and downloads are correctly scoped per-user (except for admins) and expired files fail clearly.</done>
</task>

<task type="auto" id="02-05">
  <name>Rewrite saved-views, schedules, and admin console routes</name>
  <files>src/app/api/addons/reporting/saved-views/route.ts, src/app/api/addons/reporting/schedules/route.ts, src/app/api/addons/reporting/admin/console/route.ts</files>
  <action>
    Rewrite all three to the full convention (`await requireCapability` fixed everywhere). Add Zod `.strict()` schemas for saved-view and schedule creation bodies, including validating the `cronExpression` field can actually be parsed (reject with a clear 422 at creation time if it cannot, per the PRD's no-silent-fallback decision - this is a preview of section-06's cron-parser work, just the input-validation half). Add `recordAudit` on saved-view and schedule create/update/delete. Restrict the admin console route to `school_admin` only via `requireRequestContext(request, ['school_admin'])`. Also fix the admin console's hardcoded `storageQuotaMb`/`usedStorageMb`/`activeSchedulesCount`/`failedRunsCount` (audit finding, not originally itemized as a separate task but in scope): compute `usedStorageMb` from a real `SUM(reportArtifacts.fileSizeBytes)`, `activeSchedulesCount`/`failedRunsCount` from real counts; `storageQuotaMb` may remain a fixed policy constant since no per-tenant quota concept exists in the schema (this is a limit, not a fabricated usage figure).
  </action>
  <verify>Submit an invalid cron expression when creating a schedule and confirm a clear 422 error, not a silently-accepted broken schedule. Confirm a non-admin gets 403 on the admin console route.</verify>
  <done>Saved views, schedules, and the admin console are fully hardened and validate cron input at creation time.</done>
</task>

<task type="auto" id="02-06">
  <name>Add DELETE to saved-views and a schedule detail route</name>
  <files>src/app/api/addons/reporting/saved-views/route.ts, src/app/api/addons/reporting/schedules/[id]/route.ts</files>
  <action>
    Add a `DELETE` handler to the saved-views route (missing per the audit), scoped to the caller's own saved views (or any view if `school_admin`), following the same auth/tenant/capability/audit convention. Create the missing `schedules/[id]/route.ts` with `GET` (detail) and `DELETE` (cancel a schedule) handlers, same convention, scoped to the tenant.
  </action>
  <verify>DELETE a saved view you own, confirm it's gone; attempt to DELETE another user's view as a non-admin, confirm 403. GET and DELETE a schedule by ID and confirm both work and are tenant-scoped.</verify>
  <done>Saved views can be deleted and individual schedules can be viewed/cancelled, closing the two missing-route gaps from the audit.</done>
</task>
