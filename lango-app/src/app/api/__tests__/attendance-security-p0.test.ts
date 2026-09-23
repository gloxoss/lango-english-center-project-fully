import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as getAuditSummary } from '@/app/api/attendance/audit-summary/route';
import { GET as getExcuseDocument } from '@/app/api/attendance/excuses/document/route';
import { GET as getExcuses } from '@/app/api/attendance/excuses/route';
import { POST as postFlagNote } from '@/app/api/attendance/flags/notes/route';
import { GET as getFlags } from '@/app/api/attendance/flags/route';
import { GET as getHeatmap } from '@/app/api/attendance/heatmap/route';
import { POST as reopenRegister } from '@/app/api/attendance/registers/reopen/route';
import { GET as getRegister } from '@/app/api/attendance/registers/route';
import { GET as getSummary } from '@/app/api/attendance/summary/route';
import { ApiError } from '@/libs/api/errors';
import { db } from '@/libs/DB';
import {
  attendance,
  attendanceExcuses,
  attendanceFlags,
  attendanceRegisters,
  attendanceSummary,
  branches,
  classes,
  classSections,
  classTeachers,
  guardians,
  guardianStudents,
  mediums,
  sections,
  tenants,
  user,
} from '@/models/Schema';

// P0 DB-backed security suite for attendance:
//   G1 tenant isolation · G2 branch isolation · G3 guardian child scoping
//   G4 teacher current-assignment scope · G5 register reopen authorization
//   G10 excuse document access

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

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const otherTenantId = crypto.randomUUID();
const ADMIN_ALL = `USR-ATS-ALL-${suffix}`;
const ADMIN_A = `USR-ATS-A-${suffix}`;
const TEACHER_A = `USR-ATS-T-${suffix}`;
const PARENT = `USR-ATS-P-${suffix}`;
const STUDENT_A = crypto.randomUUID();
const STUDENT_B = crypto.randomUUID();
const STUDENT_T2 = crypto.randomUUID();

let sectionA = '';
let sectionB = '';
let registerB = '';
let flagA = '';
let flagB = '';
let flagT2 = '';
let excuseA = '';
let excuseB = '';

async function asRole(userId: string, role: string, branchId: string | null = null, tid = tenantId) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId: tid, role, branchId } as RequestContext);
}

function jsonRequest(url: string, method: string, body: unknown): Request {
  return new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function bodyOf(res: Response) {
  return res.json() as Promise<any>;
}

describe.skipIf(!dbReachable)('attendance security P0 — DB-backed', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: `Att Sec ${suffix}`, slug: `att-sec-${suffix}` },
      { id: otherTenantId, name: `Att Sec X ${suffix}`, slug: `att-secx-${suffix}` },
    ]);

    const branchRows = await db.insert(branches).values([
      { tenantId, name: `Campus A ${suffix}`, code: `ASA-${suffix}` },
      { tenantId, name: `Campus B ${suffix}`, code: `ASB-${suffix}` },
    ]).returning();
    const branchA = branchRows[0]!.id;
    const branchB = branchRows[1]!.id;

    await db.insert(user).values([
      { id: ADMIN_ALL, tenantId, branchId: null, name: 'Admin All', email: `ats-all-${suffix}@t.local`, role: 'school_admin' },
      { id: ADMIN_A, tenantId, branchId: branchA, name: 'Admin A', email: `ats-a-${suffix}@t.local`, role: 'school_admin' },
      { id: TEACHER_A, tenantId, branchId: branchA, name: 'Teacher A', email: `ats-t-${suffix}@t.local`, role: 'teacher' },
      { id: PARENT, tenantId, branchId: null, name: 'Parent', email: `ats-p-${suffix}@t.local`, role: 'parent' },
      { id: STUDENT_A, tenantId, branchId: branchA, name: 'Student A', email: `ats-sa-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_B, tenantId, branchId: branchB, name: 'Student B', email: `ats-sb-${suffix}@t.local`, role: 'student' },
      { id: STUDENT_T2, tenantId: otherTenantId, name: 'Student T2', email: `ats-st2-${suffix}@t.local`, role: 'student' },
    ]);

    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const classRows = await db.insert(classes).values([
      { tenantId, branchId: branchA, name: `1A-${suffix}`, mediumId: medium!.id },
      { tenantId, branchId: branchB, name: `1B-${suffix}`, mediumId: medium!.id },
    ]).returning();
    const labelRows = await db.insert(sections).values([
      { tenantId, name: `A-${suffix}` },
      { tenantId, name: `B-${suffix}` },
    ]).returning();
    const csRows = await db.insert(classSections).values([
      { tenantId, classId: classRows[0]!.id, sectionId: labelRows[0]!.id, mediumId: medium!.id, maxStudents: 30 },
      { tenantId, classId: classRows[1]!.id, sectionId: labelRows[1]!.id, mediumId: medium!.id, maxStudents: 30 },
    ]).returning();
    sectionA = csRows[0]!.id;
    sectionB = csRows[1]!.id;

    await db.update(user).set({ classSectionId: sectionA }).where(eq(user.id, STUDENT_A));
    await db.update(user).set({ classSectionId: sectionB }).where(eq(user.id, STUDENT_B));

    // teacherA currently teaches section A only.
    await db.insert(classTeachers).values({
      tenantId,
      classSectionId: sectionA,
      teacherId: TEACHER_A,
      role: 'primary',
      startsOn: '2026-09-01',
      status: 'active',
    });

    // Registers: one per section (branch B register for reopen tests).
    const registerRows = await db.insert(attendanceRegisters).values([
      { tenantId, classId: classRows[1]!.id, classSectionId: sectionB, date: '2026-10-05', period: 1, reference: `REG-B-${suffix}`, status: 'LOCKED' },
    ]).returning();
    registerB = registerRows[0]!.id;

    await db.insert(attendanceSummary).values([
      { tenantId, studentId: STUDENT_A, attendanceRate: '95.00' },
      { tenantId, studentId: STUDENT_B, attendanceRate: '60.00' },
    ]);

    const flagRows = await db.insert(attendanceFlags).values([
      { tenantId, studentId: STUDENT_A, type: 'UNJUSTIFIED_ABSENCE', status: 'OPEN', severity: 'ELEVE' },
      { tenantId, studentId: STUDENT_B, type: 'UNJUSTIFIED_ABSENCE', status: 'OPEN', severity: 'ELEVE' },
      { tenantId: otherTenantId, studentId: STUDENT_T2, type: 'UNJUSTIFIED_ABSENCE', status: 'OPEN', severity: 'ELEVE' },
    ]).returning();
    flagA = flagRows[0]!.id;
    flagB = flagRows[1]!.id;
    flagT2 = flagRows[2]!.id;

    const excuseRows = await db.insert(attendanceExcuses).values([
      { tenantId, studentId: STUDENT_A, date: '2026-10-05', reason: `A-${suffix}`, status: 'pending' },
      { tenantId, studentId: STUDENT_B, date: '2026-10-05', reason: `B-${suffix}`, status: 'pending' },
    ]).returning();
    excuseA = excuseRows[0]!.id;
    excuseB = excuseRows[1]!.id;

    await db.insert(attendance).values([
      { tenantId, studentId: STUDENT_A, date: '2026-10-05', status: 'present', period: 1, isVoided: false, classSectionId: sectionA },
      { tenantId, studentId: STUDENT_B, date: '2026-10-05', status: 'absent', period: 1, isVoided: false, classSectionId: sectionB },
    ]);

    // Parent linked to STUDENT_A only.
    const [guardian] = await db.insert(guardians).values({
      tenantId,
      userId: PARENT,
      firstName: 'Parent',
      lastName: suffix,
      phone: '+212600000000',
    }).returning();
    await db.insert(guardianStudents).values({ tenantId, guardianId: guardian!.id, studentId: STUDENT_A, relationshipType: 'father' });
  });

  beforeEach(async () => {
    await asRole(ADMIN_ALL, 'school_admin');
  });

  afterAll(async () => {
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, tenantId));
    await db.delete(attendanceExcuses).where(eq(attendanceExcuses.tenantId, tenantId));
    await db.delete(attendanceFlags).where(eq(attendanceFlags.tenantId, tenantId));
    await db.delete(attendanceFlags).where(eq(attendanceFlags.tenantId, otherTenantId));
    await db.delete(attendanceSummary).where(eq(attendanceSummary.tenantId, tenantId));
    await db.delete(guardianStudents).where(eq(guardianStudents.tenantId, tenantId));
    await db.delete(guardians).where(eq(guardians.tenantId, tenantId));
    await db.delete(classTeachers).where(eq(classTeachers.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, otherTenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  describe('G1 — tenant isolation', () => {
    it('rejects a cross-tenant flag note (flagId from body is never trusted)', async () => {
      const res = await postFlagNote(jsonRequest('http://x/api/attendance/flags/notes', 'POST', {
        flagId: flagT2,
        body: 'cross-tenant probe',
      }));

      expect(res.status).toBe(404);
    });

    it('does not leak another tenant summary or flags', async () => {
      const summary = await bodyOf(await getSummary(new Request(`http://x/api/attendance/summary?studentId=${STUDENT_T2}`)));

      expect(summary.data).toEqual([]);

      const flags = await bodyOf(await getFlags(new Request('http://x/api/attendance/flags?pageSize=100')));

      expect(flags.data.map((f: { studentId: string }) => f.studentId)).not.toContain(STUDENT_T2);
    });
  });

  describe('G2 — branch isolation', () => {
    it('branch-limited admin only sees own-campus summary, flags, excuses and audit aggregates', async () => {
      await asRole(ADMIN_A, 'school_admin', (await db.select({ id: branches.id }).from(branches).where(eq(branches.name, `Campus A ${suffix}`)))[0]!.id);

      const summary = await bodyOf(await getSummary(new Request(`http://x/api/attendance/summary?studentId=${STUDENT_B}`)));

      expect(summary.data).toEqual([]);

      const flags = await bodyOf(await getFlags(new Request('http://x/api/attendance/flags?pageSize=100')));
      const flagStudents = flags.data.map((f: { studentId: string }) => f.studentId);

      expect(flagStudents).toContain(STUDENT_A);
      expect(flagStudents).not.toContain(STUDENT_B);

      const excuses = await bodyOf(await getExcuses(new Request('http://x/api/attendance/excuses')));

      expect(excuses.data.map((e: { studentId: string }) => e.studentId)).not.toContain(STUDENT_B);

      const audit = await bodyOf(await getAuditSummary(new Request('http://x/api/attendance/audit-summary')));
      const flagCounts = audit.data.openFlagsByType.reduce((acc: number, row: { count: number }) => acc + row.count, 0);

      expect(flagCounts).toBe(1);
    });

    it('branch-limited admin cannot read or reopen another campus register', async () => {
      const branchA = (await db.select({ id: branches.id }).from(branches).where(eq(branches.name, `Campus A ${suffix}`)))[0]!.id;
      await asRole(ADMIN_A, 'school_admin', branchA);

      const register = await bodyOf(await getRegister(new Request(`http://x/api/attendance/registers?classId=${sectionB}&date=2026-10-05&period=1`)));

      expect(register.data).toBeNull();

      const reopen = await reopenRegister(jsonRequest('http://x/api/attendance/registers/reopen', 'POST', {
        registerId: registerB,
        reason: 'correction test',
      }));

      expect(reopen.status).toBe(403);
    });

    it('heatmap and excuse documents are campus-scoped for admins', async () => {
      const branchA = (await db.select({ id: branches.id }).from(branches).where(eq(branches.name, `Campus A ${suffix}`)))[0]!.id;
      await asRole(ADMIN_A, 'school_admin', branchA);

      const heatmap = await getHeatmap(new Request(`http://x/api/attendance/heatmap?studentId=${STUDENT_B}&month=2026-10`));

      expect(heatmap.status).toBe(403);

      const doc = await getExcuseDocument(new Request(`http://x/api/attendance/excuses/document?excuseId=${excuseB}`));

      expect(doc.status).toBe(403);
    });
  });

  describe('G3 — guardian child scoping', () => {
    it('parent cannot read another family summary or heatmap', async () => {
      await asRole(PARENT, 'parent');

      const summary = await bodyOf(await getSummary(new Request(`http://x/api/attendance/summary?studentId=${STUDENT_B}`)));

      expect(summary.data).toEqual([]);

      const heatmap = await getHeatmap(new Request(`http://x/api/attendance/heatmap?studentId=${STUDENT_B}&month=2026-10`));

      expect(heatmap.status).toBe(404);

      const excuses = await bodyOf(await getExcuses(new Request('http://x/api/attendance/excuses')));

      expect(excuses.data.map((e: { studentId: string }) => e.studentId)).not.toContain(STUDENT_B);
    });

    it('parent can read own child and is blocked from another family document', async () => {
      await asRole(PARENT, 'parent');

      const summary = await bodyOf(await getSummary(new Request(`http://x/api/attendance/summary?studentId=${STUDENT_A}`)));

      expect(summary.data.studentId).toBe(STUDENT_A);

      const heatmap = await getHeatmap(new Request(`http://x/api/attendance/heatmap?studentId=${STUDENT_A}&month=2026-10`));

      expect(heatmap.status).toBe(200);

      const otherDoc = await getExcuseDocument(new Request(`http://x/api/attendance/excuses/document?excuseId=${excuseB}`));

      expect(otherDoc.status).toBe(404);

      const ownDoc = await getExcuseDocument(new Request(`http://x/api/attendance/excuses/document?excuseId=${excuseA}`));

      expect(ownDoc.status).toBe(404); // no document uploaded — proves scope passed, not existence
    });
  });

  describe('G4 — teacher current-assignment scope', () => {
    it('teacher only sees own sections in summary, flags and heatmap', async () => {
      await asRole(TEACHER_A, 'teacher', (await db.select({ id: branches.id }).from(branches).where(eq(branches.name, `Campus A ${suffix}`)))[0]!.id);

      const summary = await bodyOf(await getSummary(new Request(`http://x/api/attendance/summary?studentId=${STUDENT_B}`)));

      expect(summary.data).toEqual([]);

      const flags = await bodyOf(await getFlags(new Request('http://x/api/attendance/flags?pageSize=100')));

      expect(flags.data.map((f: { studentId: string }) => f.studentId)).not.toContain(STUDENT_B);

      const heatmap = await getHeatmap(new Request(`http://x/api/attendance/heatmap?studentId=${STUDENT_B}&month=2026-10`));

      expect(heatmap.status).toBe(403);

      const ownHeatmap = await getHeatmap(new Request(`http://x/api/attendance/heatmap?studentId=${STUDENT_A}&month=2026-10`));

      expect(ownHeatmap.status).toBe(200);
    });

    it('teacher cannot note another section flag but can note own', async () => {
      await asRole(TEACHER_A, 'teacher', (await db.select({ id: branches.id }).from(branches).where(eq(branches.name, `Campus A ${suffix}`)))[0]!.id);

      const foreign = await postFlagNote(jsonRequest('http://x/api/attendance/flags/notes', 'POST', { flagId: flagB, body: 'probe' }));

      expect(foreign.status).toBe(403);

      const own = await postFlagNote(jsonRequest('http://x/api/attendance/flags/notes', 'POST', { flagId: flagA, body: 'suivi en cours' }));

      expect(own.status).toBe(200);
    });

    it('teacher cannot read another section excuse document', async () => {
      await asRole(TEACHER_A, 'teacher', (await db.select({ id: branches.id }).from(branches).where(eq(branches.name, `Campus A ${suffix}`)))[0]!.id);

      const doc = await getExcuseDocument(new Request(`http://x/api/attendance/excuses/document?excuseId=${excuseB}`));

      expect(doc.status).toBe(403);
    });
  });

  describe('G5 — register reopen authorization', () => {
    it('rejects a reopen without capability', async () => {
      const { requireCapability } = await import('@/libs/api/permissions');
      vi.mocked(requireCapability).mockRejectedValueOnce(new ApiError(403, 'FORBIDDEN', 'Capability refusée.'));

      const res = await reopenRegister(jsonRequest('http://x/api/attendance/registers/reopen', 'POST', {
        registerId: registerB,
        reason: 'test',
      }));

      expect(res.status).toBe(403);
    });

    it('reopens an owned register with a mandatory reason and audits the actor', async () => {
      const res = await reopenRegister(jsonRequest('http://x/api/attendance/registers/reopen', 'POST', {
        registerId: registerB,
        reason: 'Erreur de saisie période 1',
      }));

      expect(res.status).toBe(200);

      const body = await bodyOf(res);

      expect(body.data.status).toBe('REOPENED');
      expect(body.data.reopenReason).toBe('Erreur de saisie période 1');

      const second = await reopenRegister(jsonRequest('http://x/api/attendance/registers/reopen', 'POST', {
        registerId: registerB,
        reason: 'again',
      }));

      expect(second.status).toBe(409);
    });

    it('rejects a reopen with no reason', async () => {
      const res = await reopenRegister(jsonRequest('http://x/api/attendance/registers/reopen', 'POST', {
        registerId: registerB,
      }));

      expect(res.status).toBe(422);
    });
  });
});
