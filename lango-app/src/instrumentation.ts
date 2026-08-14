// Next.js 16 runs register() once when the server process starts (this
// project's Dockerfile output: 'standalone' runs a single persistent
// process, so this fires exactly once per container, not per-request).
// Must live under src/ (not project root) since this project uses the
// src/ directory convention (see src/middleware.ts) - confirmed via live
// Docker verification: a root-level instrumentation.ts is silently never
// picked up by the build at all when src/ is in use.
// future-implementation/advanced-reporting remediation, section-06.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startReportScheduleWorker } = await import('@/addons/advanced-reporting/services/schedule-worker');
    startReportScheduleWorker();

    // Poller for the DB-backed scheduled-jobs registry (settings-platform,
    // Phase E). Fail-open: a worker failure must never affect request handling.
    try {
      const { startSettingsWorker } = await import('@/features/settings/services/settings-worker');
      startSettingsWorker();
    } catch (err) {
      console.error('Failed to start settings worker', err);
    }

    // Sync the code-owned settings registry into the DB catalog at startup so
    // the settings hub never shows an empty/incomplete catalog. Fail-open:
    // a DB hiccup here must never prevent the app from starting.
    try {
      const { syncAllTenantDefinitions } = await import('@/features/settings/services/definitions-service');
      await syncAllTenantDefinitions();
    } catch (err) {
      console.error('Failed to sync setting definitions at startup', err);
    }
  }
}
