import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/attendance/route';
import { db } from '@/libs/DB';
import { attendance, classSections, classTeachers, classes, mediums, sections, tenants, user } from '@/models/Schema';
import type { RequestContext } from '@/libs/api/context';

// D-16: asymmetric authorization on /api/attendance.
//
// GET scopes a teacher to their assigned class sections via
// getTeacherClassSectionIds. POST did not — it checked only the role allowlist
// and `attendance.manage` (which teachers hold), then wrote whatever
// records[].studentId the body carried. So any teacher could mark attendance
// for any student in the tenant, including classes they do not teach.
//
// This is not a read leak, but marking a student `absent` sends an SMS to that
// child's guardian, so a teacher could make the system tell an unrelated family
// their child had been absent. It also writes markedById, so the record looks
// authoritative.

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
const tenantId = crypto.randomUUID();
const TEACHER_OWN = `USR-TO-${crypto.randomUUID()}`;
const TEACHER_OTHER = `USR-TX-${crypto.randomUUID()}`;
const ADMIN = `USR-AD-${crypto.randomUUID()}`;
const STUDENT_MINE = `USR-SM-${crypto.randomUUID()}`;
const STUDENT_NOT_MINE = `USR-SN-${crypto.randomUUID()}`;

let sectionMine = '';
let sectionNotMine = '';
const today = new Date().toISOString().slice(0, 10);

async function asRole(userId: string, role: string) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId, role } as RequestContext);
}

function postAttendance(body: unknown): Promise<Response> {
  return POST(new Request('http://localhost/api/attendance', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe.skipIf(!dbReachable)('POST /api/attendance — teacher section scope', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: 'Att Test', slug: `att-${tenantId}` });

    // class_sections is a join row: medium -> class + section -> class_section.
    const [medium] = await db.insert(mediums).values({ tenantId, name: 'FR' }).returning();
    const [klass] = await db.insert(classes)
      .values({ tenantId, name: '1ere', mediumId: medium!.id }).returning();
    const secRows = await db.insert(sections).values([
      { tenantId, name: 'A' },
      { tenantId, name: 'B' },
    ]).returning();

    const secs = await db.insert(classSections).values([
      { tenantId, classId: klass!.id, sectionId: secRows[0]!.id, mediumId: medium!.id },
      { tenantId, classId: klass!.id, sectionId: secRows[1]!.id, mediumId: medium!.id },
    ]).returning();
    sectionMine = secs[0]!.id;
    sectionNotMine = secs[1]!.id;

    await db.insert(user).values([
      { id: TEACHER_OWN, tenantId, name: 'Prof Mine', email: `to-${tenantId}@t.local`, role: 'teacher' },
      { id: TEACHER_OTHER, tenantId, name: 'Prof Other', email: `tx-${tenantId}@t.local`, role: 'teacher' },
      { id: ADMIN, tenantId, name: 'Admin', email: `ad-${tenantId}@t.local`, role: 'school_admin' },
      { id: STUDENT_MINE, tenantId, name: 'Eleve 1A', email: `sm-${tenantId}@t.local`, role: 'student', classSectionId: sectionMine },
      { id: STUDENT_NOT_MINE, tenantId, name: 'Eleve 1B', email: `sn-${tenantId}@t.local`, role: 'student', classSectionId: sectionNotMine },
    ]);

    // TEACHER_OWN teaches 1A only. TEACHER_OTHER teaches 1B.
    await db.insert(classTeachers).values([
      { tenantId, teacherId: TEACHER_OWN, classSectionId: sectionMine },
      { tenantId, teacherId: TEACHER_OTHER, classSectionId: sectionNotMine },
    ]);
  });

  afterAll(async () => {
    await db.delete(attendance).where(eq(attendance.tenantId, tenantId));
    await db.delete(classTeachers).where(eq(classTeachers.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('lets a teacher mark a student in their own section', async () => {
    await asRole(TEACHER_OWN, 'teacher');
    const res = await postAttendance({
      date: today,
      period: 1,
      records: [{ studentId: STUDENT_MINE, status: 'present' }],
    });
    expect(res.status).toBe(200);

    const rows = await db.select().from(attendance).where(eq(attendance.studentId, STUDENT_MINE));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.status).toBe('present');
  });

  it('refuses a teacher marking a student outside their sections', async () => {
    await asRole(TEACHER_OWN, 'teacher');
    const res = await postAttendance({
      date: today,
      period: 2,
      records: [{ studentId: STUDENT_NOT_MINE, status: 'absent' }],
    });

    expect(res.status).toBe(403);

    // Nothing may be written — an `absent` write also triggers a guardian SMS,
    // so a partial success here would notify an unrelated family.
    const rows = await db.select().from(attendance).where(eq(attendance.studentId, STUDENT_NOT_MINE));
    expect(rows).toHaveLength(0);
  });

  it('refuses the whole batch when any record is out of scope', async () => {
    await asRole(TEACHER_OWN, 'teacher');
    const res = await postAttendance({
      date: today,
      period: 3,
      records: [
        { studentId: STUDENT_MINE, status: 'present' },
        { studentId: STUDENT_NOT_MINE, status: 'absent' },
      ],
    });

    expect(res.status).toBe(403);
    const rows = await db.select().from(attendance).where(eq(attendance.period, 3));
    expect(rows).toHaveLength(0);
  });

  it('still lets a school_admin mark any student in the tenant', async () => {
    await asRole(ADMIN, 'school_admin');
    const res = await postAttendance({
      date: today,
      period: 4,
      records: [{ studentId: STUDENT_NOT_MINE, status: 'present' }],
    });
    expect(res.status).toBe(200);
  });

  it('GET already scopes a teacher to their sections', async () => {
    await asRole(TEACHER_OTHER, 'teacher');
    const res = await GET(new Request(`http://localhost/api/attendance?date=${today}`));
    expect(res.status).toBe(200);
    const json = await res.json();
    const ids = (json.data ?? []).map((r: { studentId: string }) => r.studentId);
    expect(ids).not.toContain(STUDENT_MINE);
  });
});
