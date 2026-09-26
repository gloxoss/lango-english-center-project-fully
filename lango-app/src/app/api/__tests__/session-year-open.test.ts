import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import { auditLogs, classSections, classes, mediums, sections, sessionYears, studentPlacements, tenants, timetableVersions, user } from '@/models/Schema';

/**
 * "Ouvrir la nouvelle année scolaire" (SCF-02-03, OD1).
 *
 * Rollover used to be an implicit calendar side effect with nothing prepared.
 * It is now an explicit action behind a read-only checklist. The checklist
 * warns, never blocks: a director may open the year before the timetable is
 * published, they just have to see that it is not.
 */

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(),
}));

const tenantA = randomUUID();
const tenantB = randomUUID();
const currentYearId = randomUUID();
const targetYearId = randomUUID();
const foreignYearId = randomUUID();
const classSectionId = randomUUID();

const adminContext = {
  userId: 'usr-scf-open-admin',
  tenantId: tenantA,
  branchId: null,
  role: 'school_admin',
  baseRole: 'school_admin',
  name: 'Directeur',
  email: 'directeur@scfopen.test',
  sessionId: null,
  impersonated: false,
};

const teacherContext = { ...adminContext, role: 'teacher', baseRole: 'teacher', userId: 'usr-scf-open-teacher' };

async function setContext(ctx: unknown) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue(ctx as never);
}

describe('Open school year (SCF-02-03)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantA, name: 'Open Year Tenant', slug: `oy-${tenantA.slice(0, 8)}` },
      { id: tenantB, name: 'Open Year Tenant B', slug: `oy-${tenantB.slice(0, 8)}` },
    ]);

    await db.insert(sessionYears).values([
      { id: currentYearId, tenantId: tenantA, name: '2025-2026', startDate: '2025-09-01', endDate: '2026-06-30', isDefault: true },
      { id: targetYearId, tenantId: tenantA, name: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-30', isDefault: false },
      { id: foreignYearId, tenantId: tenantB, name: '2026-2027', startDate: '2026-09-01', endDate: '2027-06-30', isDefault: false },
    ]);

    // Minimum academic spine so a placement can exist.
    const mediumId = randomUUID();
    const classId = randomUUID();
    const sectionId = randomUUID();
    await db.insert(mediums).values({ id: mediumId, tenantId: tenantA, name: 'Français' });
    await db.insert(classes).values({ id: classId, tenantId: tenantA, name: '3ème', mediumId });
    await db.insert(sections).values({ id: sectionId, tenantId: tenantA, name: 'A' });
    await db.insert(classSections).values({
      id: classSectionId,
      tenantId: tenantA,
      classId,
      sectionId,
      mediumId,
      maxStudents: 30,
    });

    const studentId = `STU-${randomUUID()}`;
    await db.insert(user).values([
      {
        id: studentId,
        tenantId: tenantA,
        email: `open-${randomUUID().slice(0, 8)}@scfopen.test`,
        name: 'Élève 2026-2027',
        role: 'student',
      },
      // timetable_versions.created_by is an FK to user.id.
      {
        id: adminContext.userId,
        tenantId: tenantA,
        email: 'directeur@scfopen.test',
        name: 'Directeur',
        role: 'school_admin',
      },
    ]);
    await db.insert(studentPlacements).values({
      id: randomUUID(),
      tenantId: tenantA,
      studentId,
      sessionYearId: targetYearId,
      classSectionId,
      status: 'enrolled',
      startDate: '2026-09-01',
    });

    // Target year has a PUBLISHED timetable; the current year does not.
    await db.insert(timetableVersions).values({
      id: randomUUID(),
      tenantId: tenantA,
      sessionYearId: targetYearId,
      status: 'published',
      versionNumber: 2,
      createdBy: 'usr-scf-open-admin',
    });
  });

  afterAll(async () => {
    await db.delete(auditLogs).where(eq(auditLogs.tenantId, tenantA));
    await db.delete(timetableVersions).where(eq(timetableVersions.tenantId, tenantA));
    await db.delete(studentPlacements).where(eq(studentPlacements.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantA));
    await db.delete(sections).where(eq(sections.tenantId, tenantA));
    await db.delete(classes).where(eq(classes.tenantId, tenantA));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantA));
    await db.delete(sessionYears).where(inArray(sessionYears.tenantId, [tenantA, tenantB]));
    await db.delete(tenants).where(inArray(tenants.id, [tenantA, tenantB]));
  });

  beforeEach(async () => {
    await setContext(adminContext);
    const { requireCapability } = await import('@/libs/api/permissions');
    vi.mocked(requireCapability).mockResolvedValue(undefined as never);
  });

  it('1. preview reports the checklist without writing anything', async () => {
    const { GET } = await import('@/app/api/academics/session-years/open/route');
    const res = await GET(new Request(
      `http://localhost:3000/api/academics/session-years/open?preview=1&sessionYearId=${targetYearId}`,
    ));
    expect(res.status).toBe(200);

    const { data } = await res.json();
    expect(data.target.name).toBe('2026-2027');
    expect(data.current.name).toBe('2025-2026');
    expect(data.checks.startsAfterCurrent).toBe(true);
    expect(data.checks.studentsPlacedInTarget).toBe(1);
    expect(data.checks.publishedTimetable.exists).toBe(true);
    expect(data.checks.publishedTimetable.versionNumber).toBe(2);
    // fee_structures has no session_year_id, so this is tenant-scoped and says so.
    expect(data.checks.activeFeeStructuresScope).toBe('tenant');

    // Scoped to THIS tenant: schoolos_audit holds several tenants, each with
    // its own default year, so an unscoped query passes or fails depending on
    // which suites happen to run alongside this one.
    const defaults = await db
      .select()
      .from(sessionYears)
      .where(and(eq(sessionYears.tenantId, tenantA), eq(sessionYears.isDefault, true)));
    expect(defaults.map(r => r.id)).toEqual([currentYearId]);
  });

  it('2. opening the year flips the default flag in one transaction', async () => {
    const { POST } = await import('@/app/api/academics/session-years/open/route');
    const res = await POST(new Request('http://localhost:3000/api/academics/session-years/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionYearId: targetYearId }),
    }));
    expect(res.status).toBe(200);

    const rows = await db.select().from(sessionYears).where(eq(sessionYears.tenantId, tenantA));
    const defaults = rows.filter(r => r.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0]!.id).toBe(targetYearId);
  });

  it('3. the switch is audited with the before/after year ids', async () => {
    // recordAudit is fire-and-forget by design (it must never fail the request),
    // so poll briefly rather than assume the row has landed.
    let entry: typeof auditLogs.$inferSelect | undefined;
    for (let attempt = 0; attempt < 40 && !entry; attempt++) {
      const rows = await db.select().from(auditLogs).where(eq(auditLogs.tenantId, tenantA));
      entry = rows.find(r => r.entityType === 'session_year' && r.action === 'update');
      if (!entry) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    expect(entry).toBeDefined();

    const metadata = entry!.metadata as Record<string, unknown>;
    expect(metadata.previousDefaultYearId).toBe(currentYearId);
    expect(metadata.newDefaultYearId).toBe(targetYearId);
    expect(metadata.changed).toEqual({ isDefault: { before: false, after: true } });
  });

  it('4. opening the year that is already current is a no-op success', async () => {
    const { POST } = await import('@/app/api/academics/session-years/open/route');
    const res = await POST(new Request('http://localhost:3000/api/academics/session-years/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionYearId: targetYearId }),
    }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.alreadyCurrent).toBe(true);
  });

  it('5. another tenant\'s year is a 404, not a leak', async () => {
    const { POST } = await import('@/app/api/academics/session-years/open/route');
    const res = await POST(new Request('http://localhost:3000/api/academics/session-years/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionYearId: foreignYearId }),
    }));
    expect(res.status).toBe(404);
  });

  it('6. a teacher is refused by the role guard', async () => {
    await setContext(teacherContext);
    const error = new ApiError(403, 'FORBIDDEN', 'Accès refusé.');
    const { requireRequestContext } = await import('@/libs/api/context');
    vi.mocked(requireRequestContext).mockRejectedValue(error);

    const { POST } = await import('@/app/api/academics/session-years/open/route');
    const res = await POST(new Request('http://localhost:3000/api/academics/session-years/open', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ sessionYearId: targetYearId }),
    }));
    expect(res.status).toBe(403);
  });
});
