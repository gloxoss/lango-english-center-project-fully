import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import { attendance, sessionYears, tenants, user } from '@/models/Schema';
import { attendanceScanEvents } from '@/features/attendance/models/attendance-qr-schema';
import { guardGates, guardGateScanEvents } from '@/features/guard/models/guard-schema';
import { GET } from '@/app/api/attendance/onsite/route';

const requestContext = vi.hoisted(() => ({ tenantId: '' }));
vi.mock('@/libs/api/context', () => ({
  requireRequestContext: async () => ({ tenantId: requestContext.tenantId, role: 'school_admin' }),
  requireTenant: (ctx: { tenantId: string }) => ctx.tenantId,
}));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: async () => undefined }));

async function databaseAvailable() {
  try { await db.execute(sql`select 1`); return true; } catch { return false; }
}

const available = await databaseAvailable();

describe.skipIf(!available)('on-site headcount combines manual and gate evidence', () => {
  const tenantId = randomUUID();
  const adminId = `HEADCOUNT-ADMIN-${tenantId}`;
  const manualStudentId = `HEADCOUNT-MANUAL-${tenantId}`;
  const scannedStudentId = `HEADCOUNT-SCAN-${tenantId}`;
  const day = casablancaTodayIso();
  let gateId: string;
  let sessionId: string;

  async function headcount() {
    const response = await GET(new Request('http://localhost/api/attendance/onsite'));
    expect(response.status).toBe(200);
    const body = await response.json();
    return body.data as { headcount: number; confirmedArrivals: number; manualUnverified: number };
  }

  beforeAll(async () => {
    requestContext.tenantId = tenantId;
    await db.insert(tenants).values({ id: tenantId, name: 'Headcount Test', slug: `headcount-${tenantId}` });
    await db.insert(user).values([
      { id: adminId, tenantId, name: 'Admin', email: `${adminId}@example.test`, role: 'school_admin' },
      { id: manualStudentId, tenantId, name: 'Manual', email: `${manualStudentId}@example.test`, role: 'student' },
      { id: scannedStudentId, tenantId, name: 'Scanned', email: `${scannedStudentId}@example.test`, role: 'student' },
    ]);
    const [gate] = await db.insert(guardGates).values({ tenantId, gateCode: 'MAIN', gateName: 'Main' }).returning({ id: guardGates.id });
    gateId = gate!.id;
    // SESSION TRUTH (migration 0154): attendance marks carry an explicit
    // academic session; the fixture supplies the one covering the test day.
    const [session] = await db.insert(sessionYears).values({
      tenantId,
      name: `Headcount ${day}`,
      startDate: `${day.slice(0, 4)}-01-01`,
      endDate: `${day.slice(0, 4)}-12-31`,
    }).returning({ id: sessionYears.id });
    sessionId = session!.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('counts a manual presence and a QR arrival once each, then removes the exited student', async () => {
    const arrivalAt = new Date(Date.now() - 120000).toISOString();
    const departureAt = new Date(Date.now() - 60000).toISOString();
    await db.insert(attendance).values({ tenantId, studentId: manualStudentId, date: day, status: 'present', markedById: adminId, academicYearId: sessionId });
    await db.insert(attendanceScanEvents).values({ tenantId, studentId: scannedStudentId, resultStatus: 'accepted', scannedAt: arrivalAt });

    expect(await headcount()).toMatchObject({ headcount: 2, confirmedArrivals: 1, manualUnverified: 1 });

    await db.insert(guardGateScanEvents).values({
      tenantId, gateId, studentId: scannedStudentId, subjectType: 'student',
      direction: 'exit', resultStatus: 'accepted', actorId: adminId, scannedAt: departureAt,
    });
    expect(await headcount()).toMatchObject({ headcount: 1, confirmedArrivals: 0, manualUnverified: 1 });
  });
});
