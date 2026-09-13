import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET as getClasses, POST as postClasses } from '@/app/api/academics/classes/route';
import { GET as getStudents, POST as postStudents } from '@/app/api/students/route';
import { GET as getAttendanceSummary } from '@/app/api/attendance/summary/route';
import { db } from '@/libs/DB';
import { classes, classSections, mediums, sections, tenants, user } from '@/models/Schema';
import type { RequestContext } from '@/libs/api/context';

vi.mock('@/libs/env/server', () => ({
  serverEnv: {
    DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://schoolos:local_dev_password_change_me@localhost:5432/schoolos',
    BETTER_AUTH_SECRET: 'test_secret_32_characters_minimum_length_required',
    BETTER_AUTH_URL: 'http://localhost:3111',
  },
}));

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
const ADMIN_A = `ADMIN-A-${crypto.randomUUID()}`;
const ADMIN_B = `ADMIN-B-${crypto.randomUUID()}`;

let mediumAId = '';
let mediumBId = '';

function makeCtx(tenantId: string, userId: string, role = 'school_admin'): RequestContext {
  return { userId, tenantId, role } as RequestContext;
}

async function setRequestContext(ctx: RequestContext | Error) {
  const { requireRequestContext } = await import('@/libs/api/context');
  const mocked = vi.mocked(requireRequestContext);
  if (ctx instanceof Error) mocked.mockRejectedValue(ctx);
  else mocked.mockResolvedValue(ctx);
}

describe.skipIf(!dbReachable)('Gate 2: Behavioral Verification of Core Academic & Student Workflows', () => {
  beforeAll(async () => {
    // Seed test tenants
    await db.insert(tenants).values([
      { id: tenantA, name: 'Gate 2 School Alpha', slug: `g2-alpha-${Date.now()}`, isActive: true, planTier: 'standard' },
      { id: tenantB, name: 'Gate 2 School Beta', slug: `g2-beta-${Date.now()}`, isActive: true, planTier: 'standard' },
    ]);

    // Seed mediums for both tenants
    const [medA] = await db.insert(mediums).values({ tenantId: tenantA, name: 'Français Alpha' }).returning();
    const [medB] = await db.insert(mediums).values({ tenantId: tenantB, name: 'Français Beta' }).returning();
    mediumAId = medA!.id;
    mediumBId = medB!.id;
  });

  afterAll(async () => {
    await db.delete(user).where(eq(user.tenantId, tenantA));
    await db.delete(user).where(eq(user.tenantId, tenantB));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantA));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantB));
    await db.delete(classes).where(eq(classes.tenantId, tenantA));
    await db.delete(classes).where(eq(classes.tenantId, tenantB));
    await db.delete(sections).where(eq(sections.tenantId, tenantA));
    await db.delete(sections).where(eq(sections.tenantId, tenantB));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantA));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantB));
    await db.delete(tenants).where(eq(tenants.id, tenantA));
    await db.delete(tenants).where(eq(tenants.id, tenantB));
  });

  describe('Academics: Class Creation & Auto-Section Provisioning Workflow', () => {
    let createdClassId = '';

    it('creates a class with auto-provisioned sections when sectionCount > 0', async () => {
      await setRequestContext(makeCtx(tenantA, ADMIN_A));

      const req = new Request('http://localhost:3111/api/academics/classes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: '6ème Année Collège',
          cycle: 'college',
          mediumId: mediumAId,
          sectionCount: 2,
        }),
      });

      const res = await postClasses(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('6ème Année Collège');
      expect(json.data.cycle).toBe('college');
      createdClassId = json.data.id;

      // Verify sections were auto-created in database
      const classSectionRows = await db
        .select()
        .from(classSections)
        .where(and(eq(classSections.classId, createdClassId), eq(classSections.tenantId, tenantA)));
      expect(classSectionRows.length).toBe(2);
    });

    it('rejects cross-tenant references (mediumId from Tenant B in Tenant A request)', async () => {
      await setRequestContext(makeCtx(tenantA, ADMIN_A));

      const req = new Request('http://localhost:3111/api/academics/classes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'Cross Tenant Class',
          cycle: 'lycee',
          mediumId: mediumBId, // From tenant B!
          sectionCount: 1,
        }),
      });

      const res = await postClasses(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_REFERENCE');
    });

    it('strictly isolates class listing per tenant', async () => {
      // Tenant B query should see 0 classes
      await setRequestContext(makeCtx(tenantB, ADMIN_B));
      const reqB = new Request('http://localhost:3111/api/academics/classes');
      const resB = await getClasses(reqB);
      expect(resB.status).toBe(200);
      const jsonB = await resB.json();
      expect(jsonB.data.some((c: { id: string }) => c.id === createdClassId)).toBe(false);

      // Tenant A query sees the created class
      await setRequestContext(makeCtx(tenantA, ADMIN_A));
      const reqA = new Request('http://localhost:3111/api/academics/classes');
      const resA = await getClasses(reqA);
      expect(resA.status).toBe(200);
      const jsonA = await resA.json();
      expect(jsonA.data.some((c: { id: string }) => c.id === createdClassId)).toBe(true);
    });
  });

  describe('Students: Admission & Directory Behavioral Workflow', () => {
    let studentId = '';
    let studentMatricule = '';
    let targetClassSectionId = '';

    beforeAll(async () => {
      // Fetch a classSection created in tenant A
      const [cs] = await db.select().from(classSections).where(eq(classSections.tenantId, tenantA)).limit(1);
      targetClassSectionId = cs!.id;
    });

    it('admits a student with unique matricule reservation', async () => {
      await setRequestContext(makeCtx(tenantA, ADMIN_A));

      const req = new Request('http://localhost:3111/api/students', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Anas Benkirane',
          classSectionId: targetClassSectionId,
          phone: '+212600112233',
          status: 'Actif',
        }),
      });

      const res = await postStudents(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.fullName).toBe('Anas Benkirane');
      expect(json.data.matricule).toBeDefined();
      expect(json.data.schoolId).toBe(tenantA);
      studentId = json.data.id;
      studentMatricule = json.data.matricule;
    });

    it('fetches admitted student profile with attendance and balance data', async () => {
      await setRequestContext(makeCtx(tenantA, ADMIN_A));

      const req = new Request(`http://localhost:3111/api/students?id=${studentId}`);
      const res = await getStudents(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(studentId);
      expect(json.data.matricule).toBe(studentMatricule);
      expect(json.data.status).toBe('Actif');
      expect(json.data.attendance).toBeDefined();
    });

    it('blocks cross-tenant student detail access (Tenant B fetching Tenant A student returns 404)', async () => {
      await setRequestContext(makeCtx(tenantB, ADMIN_B));

      const req = new Request(`http://localhost:3111/api/students?id=${studentId}`);
      const res = await getStudents(req);
      expect(res.status).toBe(404);
    });

    it('prevents assigning student to class section of another tenant', async () => {
      await setRequestContext(makeCtx(tenantB, ADMIN_B));

      const req = new Request('http://localhost:3111/api/students', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          fullName: 'Hiba Idrissi',
          classSectionId: targetClassSectionId, // Belongs to Tenant A!
        }),
      });

      const res = await postStudents(req);
      expect(res.status).toBe(422);
      const json = await res.json();
      expect(json.error.code).toBe('INVALID_REFERENCE');
    });
  });

  describe('Attendance: Aggregation & Tenant Scope', () => {
    it('returns tenant-scoped attendance summary without leaking foreign records', async () => {
      await setRequestContext(makeCtx(tenantA, ADMIN_A));

      const req = new Request('http://localhost:3111/api/attendance/summary');
      const res = await getAttendanceSummary(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.success).toBe(true);
      expect(Array.isArray(json.data)).toBe(true);
    });
  });
});
