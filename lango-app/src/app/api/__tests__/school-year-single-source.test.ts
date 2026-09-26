import { randomUUID } from 'node:crypto';
import { and, desc, eq, gte, inArray, lte, or, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { getCurrentSessionYear } from '@/libs/services/school-year';
import { sessionYears, tenants, user } from '@/models/Schema';

/**
 * OD1 / PLAN invariant 2: ONE rule for "which school year is current".
 *
 * The audit found two rules running at once: 26 files read
 * `session_years.is_default` (2025-2026) while the dashboard resolved the year
 * whose date range contains today (2026-2027). Every September they disagreed.
 * The current year is now the flagged row, full stop — and switching it is a
 * deliberate act, not a side effect of the calendar.
 *
 * This tenant is deliberately built so the two rules give DIFFERENT answers:
 * the default year ended in 2025, and a later year contains today. The
 * dashboard and the students list must both report the DEFAULT year.
 */

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

const tenantId = randomUUID();
const defaultYearId = randomUUID(); // finished: today is outside it
const dateMatchYearId = randomUUID(); // contains today, but is NOT the current year

// Computed, not hardcoded, so the fixture keeps discriminating as years pass.
// The default year FINISHED before today; the other year CONTAINS today. The
// two rules therefore give opposite answers, and they never overlap (which
// migration 0166 also enforces).
const YEAR = new Date().getFullYear();
const DEFAULT_YEAR = {
  name: `${YEAR - 3}-${YEAR - 2}`,
  startDate: `${YEAR - 3}-09-01`,
  endDate: `${YEAR - 2}-06-30`,
};
const DATE_MATCH_YEAR = {
  name: `${YEAR - 1}-${YEAR + 1}`,
  startDate: `${YEAR - 1}-09-01`,
  endDate: `${YEAR + 1}-06-30`,
};

const context = {
  userId: 'usr-scf02-admin',
  tenantId,
  branchId: null,
  role: 'school_admin',
  baseRole: 'school_admin',
  name: 'Directeur',
  email: 'directeur@scf02.test',
  sessionId: null,
  impersonated: false,
};

describe('School year — one source, one rule (SCF-02)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({
      id: tenantId,
      name: 'SCF-02 School Year Tenant',
      slug: `scf02-${tenantId.slice(0, 8)}`,
    });

    await db.insert(sessionYears).values([
      { id: defaultYearId, tenantId, ...DEFAULT_YEAR, isDefault: true },
      { id: dateMatchYearId, tenantId, ...DATE_MATCH_YEAR, isDefault: false },
    ]);

    await db.insert(user).values([
      {
        id: `STU-${randomUUID()}`,
        tenantId,
        email: `inside-${randomUUID().slice(0, 8)}@scf02.test`,
        name: 'Élève Année Par Défaut',
        role: 'student',
        createdAt: `${YEAR - 3}-10-01 09:00:00`,
      },
      {
        id: `STU-${randomUUID()}`,
        tenantId,
        email: `later-${randomUUID().slice(0, 8)}@scf02.test`,
        name: 'Élève Année Future',
        role: 'student',
        createdAt: `${YEAR + 50}-10-01 09:00:00`,
      },
    ]);

    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockResolvedValue(context as never);
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(sessionYears).where(inArray(sessionYears.tenantId, [tenantId]));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('1. the canonical helper returns the is_default row, not the one containing today', async () => {
    const year = await getCurrentSessionYear(tenantId);
    expect(year).toEqual({
      id: defaultYearId,
      name: DEFAULT_YEAR.name,
      startDate: DEFAULT_YEAR.startDate,
      endDate: DEFAULT_YEAR.endDate,
    });
  });

  it('2. the dashboard summary reports the default year, not today\'s year', async () => {
    const { GET } = await import('@/app/api/dashboard/summary/route');
    const res = await GET(new Request('http://localhost:3000/api/dashboard/summary'));
    expect(res.status).toBe(200);

    const payload = await res.json();
    // The period the dashboard aggregates on must be the CURRENT year's window.
    expect(payload.data.financeOverview.periodLabel).toBe(DEFAULT_YEAR.name);
  });

  it('2b. the removed date-window rule would have picked a DIFFERENT year here', async () => {
    // Guards that the fixture is discriminating. This is the old dashboard
    // ordering ("contains today" first, then isDefault), kept here only to
    // show it answers differently on this tenant — so test 2 cannot pass by
    // accident. No production code reads this query any more.
    const today = new Date().toISOString().slice(0, 10);
    const [oldRule] = await db
      .select({ id: sessionYears.id })
      .from(sessionYears)
      .where(and(
        eq(sessionYears.tenantId, tenantId),
        or(
          eq(sessionYears.isDefault, true),
          and(lte(sessionYears.startDate, today), gte(sessionYears.endDate, today)),
        ),
      ))
      .orderBy(
        desc(sql`CASE WHEN ${sessionYears.startDate} <= ${today} AND ${sessionYears.endDate} >= ${today} THEN 1 ELSE 0 END`),
        desc(sessionYears.isDefault),
        desc(sessionYears.startDate),
      )
      .limit(1);

    expect(oldRule?.id).toBe(dateMatchYearId);
    expect(oldRule?.id).not.toBe(defaultYearId);
  });

  it('3. the students list scopes to the same year as the dashboard', async () => {
    // The list computes `newProfilesThisYear` as createdAt >= the current
    // year's start date. Two students sit on opposite sides of that boundary:
    // one inside the DEFAULT year (2024-09-01) and one inside the later year
    // (2098-09-01). Both are >= 2024-09-01, so if the route resolves the
    // default year the count is 2; had it resolved the year containing today
    // (start 2098-09-01) the count would be 1.
    const { GET } = await import('@/app/api/students/route');
    const res = await GET(new Request('http://localhost:3000/api/students?limit=50'));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.stats.newProfilesThisYear).toBe(2);
  });
});
