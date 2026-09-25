import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET as exportQrEvents } from '@/app/api/attendance/qr/events/export/route';
import { GET as listQrEvents } from '@/app/api/attendance/qr/events/route';
import { db } from '@/libs/DB';
import {
  attendanceScanEvents,
  branches,
  classes,
  classSections,
  classTeachers,
  mediums,
  sections,
  tenants,
  user,
} from '@/models/Schema';

// P0: the QR scan feed was readable across the whole tenant by any caller with
// attendance.read. A teacher or a campus-limited admin must only ever see the
// scans they are entitled to, and the CSV/PDF export must narrow identically.

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5432/schoolos_test',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn(async () => undefined),
}));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const TEACHER_ASSIGNED = `QR-T-A-${suffix}`;
const TEACHER_UNASSIGNED = `QR-T-U-${suffix}`;

let branchA = '';
let branchB = '';
let sectionA = '';
let sectionB = '';

async function setContext(userId: string, role: string, branchId: string | null) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId,
    tenantId,
    role,
    branchId,
    name: 'QR Caller',
  } as unknown as RequestContext);
}

function get(route: (r: Request) => Promise<Response>, query = '') {
  return route(new Request(`http://x/api/attendance/qr/events${query}`));
}

describe.skipIf(!dbReachable)('QR report scope P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `QR Scope ${suffix}`, slug: `qr-scope-${suffix}` });

    const branchRows = await db.insert(branches).values([
      { tenantId, name: `Campus A ${suffix}`, code: `QSA-${suffix}` },
      { tenantId, name: `Campus B ${suffix}`, code: `QSB-${suffix}` },
    ]).returning();

    branchA = branchRows[0]!.id;
    branchB = branchRows[1]!.id;

    await db.insert(user).values([
      { id: TEACHER_ASSIGNED, tenantId, branchId: branchA, name: 'Teacher Assigned', email: `qr-ta-${suffix}@t.local`, role: 'teacher' },
      { id: TEACHER_UNASSIGNED, tenantId, branchId: branchA, name: 'Teacher Unassigned', email: `qr-tu-${suffix}@t.local`, role: 'teacher' },
      { id: `QR-ADMIN-${suffix}`, tenantId, name: 'QR Admin', email: `qr-ad-${suffix}@t.local`, role: 'school_admin' },
    ]);

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const classRows = await db.insert(classes).values([
      { tenantId, branchId: branchA, name: `QA-${suffix}`, mediumId: medium!.id },
      { tenantId, branchId: branchB, name: `QB-${suffix}`, mediumId: medium!.id },
    ]).returning();
    const labelRows = await db.insert(sections).values([
      { tenantId, name: `SA-${suffix}` },
      { tenantId, name: `SB-${suffix}` },
    ]).returning();
    const csRows = await db.insert(classSections).values([
      { tenantId, classId: classRows[0]!.id, sectionId: labelRows[0]!.id, mediumId: medium!.id, maxStudents: 30 },
      { tenantId, classId: classRows[1]!.id, sectionId: labelRows[1]!.id, mediumId: medium!.id, maxStudents: 30 },
    ]).returning();

    sectionA = csRows[0]!.id;
    sectionB = csRows[1]!.id;

    // The teacher holds a current assignment on section A only.
    await db.insert(classTeachers).values({
      tenantId,
      classSectionId: sectionA,
      teacherId: TEACHER_ASSIGNED,
      role: 'primary',
      status: 'active',
    });

    await db.insert(attendanceScanEvents).values([
      { tenantId, classSectionId: sectionA, resultStatus: 'accepted' },
      { tenantId, classSectionId: sectionA, resultStatus: 'rejected' },
      { tenantId, classSectionId: sectionB, resultStatus: 'accepted' },
    ]);
  });

  afterAll(async () => {
    await db.delete(attendanceScanEvents).where(eq(attendanceScanEvents.tenantId, tenantId));
    await db.delete(classTeachers).where(eq(classTeachers.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('P0.6: a tenant-wide admin sees every campus', async () => {
    await setContext(`QR-ADMIN-${suffix}`, 'school_admin', null);
    const json = await (await get(listQrEvents)).json() as any;

    expect(json.data).toHaveLength(3);
  });

  it('P0.7: a campus-limited admin sees only their own campus', async () => {
    await setContext(`QR-ADMIN-${suffix}`, 'school_admin', branchA);
    const json = await (await get(listQrEvents)).json() as any;

    expect(json.data).toHaveLength(2);
    for (const row of json.data) {
      expect(row.classSectionId).toBe(sectionA);
    }
  });

  it('P0.8: a teacher sees only the sections they teach', async () => {
    await setContext(TEACHER_ASSIGNED, 'teacher', branchA);
    const json = await (await get(listQrEvents)).json() as any;

    expect(json.data).toHaveLength(2);
    for (const row of json.data) {
      expect(row.classSectionId).toBe(sectionA);
    }
  });

  it('P0.9: a teacher with no current assignment sees nothing', async () => {
    await setContext(TEACHER_UNASSIGNED, 'teacher', branchA);
    const json = await (await get(listQrEvents)).json() as any;

    expect(json.data).toHaveLength(0);
  });

  it('P0.10: the CSV export narrows to exactly the same rows as the list', async () => {
    await setContext(TEACHER_ASSIGNED, 'teacher', branchA);

    const listJson = await (await get(listQrEvents)).json() as any;
    const csv = await (await get(exportQrEvents, '?format=csv')).text();

    // One header line, then one line per visible event — no wider than the list.
    const dataLines = csv.trim().split('\n').slice(1);

    expect(dataLines).toHaveLength(listJson.data.length);
    expect(dataLines).toHaveLength(2);
  });
});
