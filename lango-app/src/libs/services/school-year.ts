import { and, eq } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { sessionYears } from '@/models/Schema';

/**
 * THE single source for "which school year is current".
 *
 * The owner decision (SETTINGS-CORE-FIX-01 / OD1) is explicit: the current year
 * is the `session_years` row flagged `is_default`, NOT the row whose date range
 * happens to contain today. Before this, 26 files read `is_default` (2025-2026)
 * while the dashboard resolved the year from today's date (2026-2027) and the
 * two disagreed every September. Rolling over is now a deliberate act (the
 * "Ouvrir la nouvelle année scolaire" action), which is what lets a school
 * prepare next year's classes before switching.
 *
 * Three private copies of the old `getDefaultSessionYearId` existed
 * (teacher-service, subject-teacher-assignment, teacher-scope). They now all
 * resolve through here, so there is exactly one answer per tenant.
 *
 * Migration 0166 backstops this at the database level: at most one default row
 * per tenant, and no two years may overlap.
 */
export type CurrentSessionYear = {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
};

export async function getCurrentSessionYear(
  tenantId: string,
  executor: typeof db = db,
): Promise<CurrentSessionYear | null> {
  const [row] = await executor
    .select({
      id: sessionYears.id,
      name: sessionYears.name,
      startDate: sessionYears.startDate,
      endDate: sessionYears.endDate,
    })
    .from(sessionYears)
    .where(and(eq(sessionYears.tenantId, tenantId), eq(sessionYears.isDefault, true)))
    .limit(1);

  return row ?? null;
}

/** Id-only convenience for callers that scope a query by the current year. */
export async function getCurrentSessionYearId(
  tenantId: string,
  executor: typeof db = db,
): Promise<string | null> {
  return (await getCurrentSessionYear(tenantId, executor))?.id ?? null;
}
