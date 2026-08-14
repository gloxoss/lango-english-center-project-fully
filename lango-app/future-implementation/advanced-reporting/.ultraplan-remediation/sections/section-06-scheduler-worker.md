# Section 06: Real Scheduler Worker

## Overview
Builds the first real background/scheduled-task mechanism in this codebase (confirmed by research: no prior pattern exists to copy), fixing `ScheduleService.calculateNextRun()` to genuinely parse cron expressions via `cron-parser`, and adding an in-process interval worker (via Next.js 15's `instrumentation.ts`) that actually executes due schedules, handles a stale/deleted schedule target by failing that one run without disabling the schedule, and generates a completion notification badge.

## Risk: red - genuinely novel pattern for this codebase with no existing precedent to copy or compare against; timing/scheduling logic is a well-known source of subtle bugs

## Dependencies
- Depends on: section-04 (run engine must work to execute a scheduled report), section-05 (export storage must work to save the result)
- Blocks: section-10
- Parallel batch: 3

## TDD Test Stubs
- Test: `calculateNextRun('0 8 * * MON', fromDate)` returns the real next Monday 8am, not `fromDate + 24h`.
- Test: An invalid cron expression passed to `calculateNextRun` throws a clear error rather than silently returning a wrong date.
- Test: A schedule whose next-run time has passed is actually executed by the worker within one polling interval, without any user action.
- Test: A schedule whose target (e.g. a since-deleted class-section) no longer exists fails that one run with a clear reason, but the schedule itself remains active for its next occurrence.
- Test: Starting the app twice in a row (simulating a restart) does not create two competing interval timers.
- Test: A completed scheduled run shows an unread badge on the Runs nav item until the user views it.

## Tasks

<task type="auto" id="06-01">
  <name>Fix calculateNextRun with real cron parsing</name>
  <files>package.json, src/addons/advanced-reporting/services/schedule-service.ts</files>
  <action>
    Add `cron-parser` to `package.json`. Rewrite `ScheduleService.calculateNextRun(cronExpression, fromDate)` to use it (`CronExpressionParser.parse(cronExpression, {currentDate: fromDate}).next().toDate()` - confirm the exact import/API shape against the actually-installed version's TypeScript types, since the API has shifted between major versions). Wrap in try/catch and throw a clear `ApiError(422, 'INVALID_CRON', ...)` on a bad expression, matching the validation already added to schedule creation in section-02.
  </action>
  <verify>Call `calculateNextRun('0 8 * * MON', new Date('2026-08-06'))` and confirm the result is the real next Monday at 8am, not simply +24h. Call it with an invalid expression and confirm a clear thrown error.</verify>
  <done>calculateNextRun genuinely parses cron expressions instead of ignoring them.</done>
</task>

<task type="auto" id="06-02">
  <name>Build the schedule execution function</name>
  <files>src/addons/advanced-reporting/services/schedule-worker.ts</files>
  <action>
    Create `runDueSchedules()`: query `report_schedules` where the next-run time (computed via `calculateNextRun` from the stored `cronExpression` and `lastRunAt`) is in the past and the schedule is active. For each due schedule, attempt to run its report via the same real run-engine path used by the manual "run" route (reusing that logic, not duplicating it), generate and store its export via section-05's real exporters/storage. If the report's stored target (e.g. a class-section ID) no longer exists, catch that specific failure, mark that one run as `failed` with a clear reason, and leave the schedule itself active and untouched for its next occurrence (per the PRD's stale-target decision). Update the schedule's `lastRunAt` after every attempt (success or handled failure).
  </action>
  <verify>Create a due schedule pointing at a real, then-deleted class-section, call `runDueSchedules()`, and confirm that run is marked failed with a clear reason while the schedule row itself remains `active`.</verify>
  <done>Due schedules are genuinely executed, and a stale target fails only that occurrence without disabling the schedule.</done>
</task>

<task type="auto" id="06-03">
  <name>Wire the in-process worker via instrumentation.ts</name>
  <files>instrumentation.ts, src/addons/advanced-reporting/services/schedule-worker.ts</files>
  <action>
    Create `instrumentation.ts` at the project root (does not currently exist - this is new) exporting `register()`, guarded by `if (process.env.NEXT_RUNTIME === 'nodejs')`. Inside, dynamically import and call a new `startReportScheduleWorker()` function from `schedule-worker.ts` that uses a module-level `started` boolean guard to prevent duplicate intervals, then calls `setInterval` every 5 minutes to run both `runDueSchedules()` (task 06-02) and `cleanupExpiredReportFiles()` (section-05, task 05-04), wrapping each call in try/catch so one failure doesn't kill the interval. Confirm in `next.config.ts` whether `experimental.instrumentationHook` needs to be explicitly enabled for the installed Next.js 15 minor version, or if it's already default-on, and add the config flag only if actually required.
  </action>
  <verify>Start the app, wait one interval past a due schedule's time, and confirm the report ran without any user interaction, visible as a new `report_runs` row with `sourceType` indicating it was schedule-triggered. Restart the app and confirm no duplicate/competing timers (check for doubled execution of the same due schedule).</verify>
  <done>A real, singleton, restart-safe background worker executes due schedules and cleans up expired files on a 5-minute interval.</done>
</task>

<task type="auto" id="06-04">
  <name>Add the completion notification badge</name>
  <files>src/components/shared/sidebar.tsx, src/addons/advanced-reporting/ui/components/reporting-nav.tsx</files>
  <action>
    Add a small unread-count indicator to the Runs nav item, driven by a lightweight query for `report_runs` rows created by the scheduler (not manually) since the user's last visit to the Runs page (track via a `lastViewedRunsAt` value, e.g. in local storage or a simple per-user setting - keep this as simple as the rest of this app's existing badge/count patterns, no new real-time infrastructure).
  </action>
  <verify>Trigger a scheduled run, then load the sidebar without visiting the Runs page, and confirm the badge appears; visit the Runs page and confirm the badge clears.</verify>
  <done>Users see a lightweight visual indicator when a scheduled report has completed.</done>
</task>
