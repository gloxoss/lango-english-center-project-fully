# Section 06: Settings Fake-Action Trio

## Overview
Three settings pages have real server-side data reads but fake client-side actions:
- `jobs-audit-client.tsx`: "trigger job" is a local setTimeout, no real job runs, no audit write. `SCHEDULED_JOBS` list is static config, not DB-backed.
- `providers-client.tsx`: connection tests are simulated locally, no real network call.
- `migration-readiness-client.tsx`: all actions (validate/resolve/toggle) are local-state-only, despite real unused API routes already existing at `api/settings/migration`, `api/settings/migration/tasks`, `api/settings/migration/template`. `readinessScore`/`fileCount`/`entityCounts` are hardcoded literals.

Bundled into one section because all three are "wire fake client action to real (or nearly-real) backend" - same shape of fix, low individual complexity.

## Risk: [yellow] - 3 sub-areas bundled, migration-readiness's numbers need real entity counts (touches multiple tables), jobs' "real job run" needs a scoped decision on what a job trigger actually does safely

## Dependencies
- Depends on: none
- Blocks: none
- Parallel batch: 1

## TDD Test Stubs
- Test: migration-readiness's readinessScore/entityCounts are computed from real student/guardian row counts, not literals, for a test tenant with a known row count
- Test: triggering a job writes a real row somewhere verifiable (job log or audit log), not just a local toast

## Tasks

<task type="auto" id="06-01">
  <name>Wire migration-readiness-client.tsx to the existing unused migration APIs</name>
  <files>src/features/settings/ui/migration-readiness-client.tsx, src/features/settings/ui/migration-readiness-page.tsx</files>
  <action>
    Read src/app/api/settings/migration/route.ts, .../tasks/[id]/route.ts, .../template/route.ts first to see exactly what they already return/accept - do not rebuild what's already there. Replace handleTriggerValidation/handleResolveProblem/handleToggleTask's local-state-only bodies with real fetch calls to these routes. Replace the hardcoded readinessScore/fileCount/entityCounts in the server page with a real query: count real student/guardian rows (missing MASSAR codes etc. per whatever the migration-readiness domain actually tracks - check the API routes' response shape for the real field names rather than guessing).
  </action>
  <verify>tsc --noEmit clean; readinessScore changes when test-tenant data changes, not fixed at 78</verify>
  <done>No hardcoded 78/14/1240/980 remain; all three actions persist through the real routes</done>
</task>

<task type="auto" id="06-02">
  <name>Wire providers-client.tsx connection tests to a real check</name>
  <files>src/features/settings/ui/providers-client.tsx, src/app/api/settings/providers/test/route.ts (new)</files>
  <action>
    Build a minimal POST /api/settings/providers/test route that does a real reachability check appropriate to each provider type (e.g. a lightweight HTTP HEAD/health-check call using the provider's configured base URL from setting_values, wrapped in a timeout) - for providers with no real endpoint to test (e.g. a purely internal integration), return an honest "not testable" status rather than faking success. Wire handleTestSingleProvider/handleTestAllConnections to this route instead of the local simulation.
  </action>
  <verify>manual test against at least one real provider config; confirm a deliberately-wrong URL correctly reports failure</verify>
  <done>Connection test reflects a real check result, not a canned success</done>
</task>

<task type="auto" id="06-03">
  <name>Wire jobs-audit-client.tsx's trigger action and make SCHEDULED_JOBS DB-backed</name>
  <files>src/features/settings/ui/jobs-audit-client.tsx, src/app/api/settings/jobs/route.ts (new), migration if a jobs-registry table is needed</files>
  <action>
    Scope this narrowly: don't build a full job-scheduling system. SCHEDULED_JOBS likely maps to things this app already does on a schedule conceptually (export cleanup, notification digest, etc.) - check if any exist as real background concepts already (e.g. export-service.ts). If a job is genuinely just a manual "run this maintenance task now" trigger, wire it to call the real underlying function and recordAudit() the run - that satisfies "not fake" without inventing a scheduler. If no real underlying task exists for a given mock job, remove that job from the list rather than fake-triggering it.
  </action>
  <verify>triggering a real job produces a recordAudit() row, verifiable via GET /api/settings/values or the audit log</verify>
  <done>Every job in the list either does something real when triggered, or isn't in the list</done>
</task>
