import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/attendance/onsite/route';
import { attendanceScanEvents } from '@/features/attendance/models/attendance-qr-schema';
import { db } from '@/libs/DB';
import { casablancaTodayIso } from '@/libs/finance/today';
import {
  attendance,
  branches,
  classSections,
  classes,
  mediums,
  sections,
  sessionYears,
  tenants,
  user,
} from '@/models/Schema';

// The campus headcount answers "how many people are in the building". A teacher
// taking a register asks a different question: "has Aya reached the building?".
// The optional `?classSectionId=` filter answers the second without disturbing
// the first, which is the whole point of this suite.
//
// The properties worth pinning are the ones a careless implementation loses:
// that the section list is scoped to the section asked for, that it is scoped to
// the caller's tenant, that it reports the FIRST arrival of the day, and that
// omitting the parameter leaves the response exactly as it was.

const requestContext = vi.hoisted(() => ({ tenantId: '', branchId: null as string | null }));
// Allows the test to pin the "today" string to whatever the DB's Casablanca clock
// says, rather than Node.js's — the two can diverge when tzdata versions differ.
const mockedToday = vi.hoisted(() => ({ value: '' }));
vi.mock('@/libs/finance/today', () => ({
  casablancaTodayIso: () => mockedToday.value || new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca' }).format(new Date()),
}));
vi.mock('@/libs/api/context', () => ({
  requireRequestContext: async () => ({
    tenantId: requestContext.tenantId,
    branchId: requestContext.branchId,
    role: 'school_admin',
  }),
  requireTenant: (ctx: { tenantId: string }) => ctx.tenantId,
}));
vi.mock('@/libs/api/permissions', () => ({ requireCapability: async () => undefined }));

async function databaseAvailable() {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const available = await databaseAvailable();

describe.skipIf(!available)('on-site arrivals for one class section', () => {
  const tenantId = randomUUID();
  const otherTenantId = randomUUID();
  const adminId = `ONSITE-ADMIN-${tenantId}`;
  const ayaId = `ONSITE-AYA-${tenantId}`;
  const yassineId = `ONSITE-YASSINE-${tenantId}`;
  const otherSectionStudentId = `ONSITE-OTHER-${tenantId}`;
  const foreignStudentId = `ONSITE-FOREIGN-${otherTenantId}`;
  const day = casablancaTodayIso();

  let sectionId = '';
  let otherSectionId = '';
  let foreignSectionId = '';
  let sessionYearId = '';
  // The DB's "today" in Casablanca timezone — may differ from Node.js when tzdata versions diverge.
  let dbDay = '';

  async function onsite(query = '') {
    const response = await GET(new Request(`http://localhost/api/attendance/onsite${query}`));
    return { status: response.status, body: await response.json() as any };
  }

  beforeAll(async () => {
    requestContext.tenantId = tenantId;
    // Pin the route's "today" to the DB's Casablanca date to avoid Node.js/PG tzdata mismatch.
    const [dbTodayRow] = await db.execute<{ db_today: string }>(sql`
      SELECT to_char(now() AT TIME ZONE 'Africa/Casablanca', 'YYYY-MM-DD') AS db_today
    `).then(r => r.rows);
    mockedToday.value = dbTodayRow!.db_today;
    dbDay = dbTodayRow!.db_today;
    await db.insert(tenants).values([
      { id: tenantId, name: 'Onsite Section', slug: `onsite-section-${tenantId}` },
      { id: otherTenantId, name: 'Onsite Foreign', slug: `onsite-foreign-${otherTenantId}` },
    ]);
    const [branch] = await db.insert(branches).values({ tenantId, name: `OS-${tenantId}`, code: `OS-${tenantId.slice(0, 6)}` }).returning();
    const [medium] = await db.insert(mediums).values({ tenantId, name: `OSM-${tenantId}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `OS1-${tenantId}`, mediumId: medium!.id }).returning();
    const [foreignMedium] = await db.insert(mediums).values({ tenantId: otherTenantId, name: `OFM-${otherTenantId}` }).returning();
    const [foreignClass] = await db.insert(classes).values({ tenantId: otherTenantId, name: `OF1-${otherTenantId}`, mediumId: foreignMedium!.id }).returning();

    const [labelA] = await db.insert(sections).values({ tenantId, name: `OSA-${tenantId}` }).returning();
    const [labelB] = await db.insert(sections).values({ tenantId, name: `OSB-${tenantId}` }).returning();
    const [foreignLabel] = await db.insert(sections).values({ tenantId: otherTenantId, name: `OFL-${otherTenantId}` }).returning();

    const [sectionA] = await db.insert(classSections).values({ tenantId, classId: cls!.id, sectionId: labelA!.id, mediumId: medium!.id, maxStudents: 30 }).returning();
    const [sectionB] = await db.insert(classSections).values({ tenantId, classId: cls!.id, sectionId: labelB!.id, mediumId: medium!.id, maxStudents: 30 }).returning();
    const [foreignSection] = await db.insert(classSections).values({ tenantId: otherTenantId, classId: foreignClass!.id, sectionId: foreignLabel!.id, mediumId: foreignMedium!.id, maxStudents: 30 }).returning();

    sectionId = sectionA!.id;
    otherSectionId = sectionB!.id;
    foreignSectionId = foreignSection!.id;

    await db.insert(user).values([
      { id: adminId, tenantId, branchId: branch!.id, name: 'Onsite Admin', email: `${adminId}@example.test`, role: 'school_admin' },
      { id: ayaId, tenantId, branchId: branch!.id, name: 'Aya Bennani', email: `${ayaId}@example.test`, role: 'student', classSectionId: sectionId },
      { id: yassineId, tenantId, branchId: branch!.id, name: 'Yassine Amrani', email: `${yassineId}@example.test`, role: 'student', classSectionId: sectionId },
      { id: otherSectionStudentId, tenantId, branchId: branch!.id, name: 'Nadia Idrissi', email: `${otherSectionStudentId}@example.test`, role: 'student', classSectionId: otherSectionId },
      { id: foreignStudentId, tenantId: otherTenantId, name: 'Foreign Student', email: `${foreignStudentId}@example.test`, role: 'student', classSectionId: foreignSectionId },
    ]);

    const [sessionYear] = await db.insert(sessionYears).values({
      tenantId,
      name: `Onsite ${day}`,
      startDate: `${day.slice(0, 4)}-01-01`,
      endDate: `${day.slice(0, 4)}-12-31`,
    }).returning({ id: sessionYears.id });
    sessionYearId = sessionYear!.id;
  });

  afterAll(async () => {
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
    requestContext.branchId = null;
  });

  it('OS.1: no parameter keeps the original response shape intact', async () => {
    const { status, body } = await onsite();
    expect(status).toBe(200);
    expect(body.data).toHaveProperty('headcount');
    expect(body.data).toHaveProperty('confirmedArrivals');
    expect(body.data).toHaveProperty('manualUnverified');
    expect(body.data).not.toHaveProperty('students');
  });

  it('OS.2: lists only the students of the asked-for section, first arrival first', async () => {
    // Use timestamps relative to NOW from the DB — always in the past, always today
    // by any timezone definition. The "first arrival" property (which is what this
    // test pins) still holds because firstArrival < secondArrival.
    const [nowRow] = await db.execute<{ now_text: string }>(sql`SELECT now()::text AS now_text`).then(r => r.rows);
    const now = new Date(nowRow!.now_text).getTime();
    const firstArrival = new Date(now - 10 * 1000).toISOString();  // 10s ago
    const secondArrival = new Date(now - 5 * 1000).toISOString(); // 5s ago

    // Yassine arrives first, badges again later. Aya arrives once.
    await db.insert(attendanceScanEvents).values([
      { tenantId, studentId: yassineId, resultStatus: 'accepted', scannedAt: firstArrival },
      { tenantId, studentId: yassineId, resultStatus: 'accepted', scannedAt: secondArrival },
      { tenantId, studentId: ayaId, resultStatus: 'accepted', scannedAt: secondArrival },
      // Another section, same campus: must never appear in this list.
      { tenantId, studentId: otherSectionStudentId, resultStatus: 'accepted', scannedAt: secondArrival },
    ]);

    const { status, body } = await onsite(`?classSectionId=${sectionId}`);
    expect(status).toBe(200);

    const students = body.data.students as { studentId: string; name: string; arrivedAt: string }[];
    expect(students.map(s => s.studentId)).toEqual([ayaId, yassineId]); // alphabetical by name
    expect(students.every(s => s.studentId !== otherSectionStudentId)).toBe(true);

    const yassine = students.find(s => s.studentId === yassineId)!;
    // The FIRST arrival of the day, not the most recent badge read.
    expect(new Date(yassine.arrivedAt).toISOString()).toBe(firstArrival);
  });

  it('OS.3: a rejected scan is not an arrival', async () => {
    const rejectedStudent = `ONSITE-REJ-${tenantId}`;
    await db.insert(user).values({
      id: rejectedStudent, tenantId, name: 'Rejected Student', email: `${rejectedStudent}@example.test`, role: 'student', classSectionId: sectionId,
    });
    await db.insert(attendanceScanEvents).values({
      tenantId, studentId: rejectedStudent, resultStatus: 'rejected', rejectionReason: 'BADGE_EXPIRED', scannedAt: new Date().toISOString(),
    });

    const { body } = await onsite(`?classSectionId=${sectionId}`);
    const ids = (body.data.students as { studentId: string }[]).map(s => s.studentId);
    expect(ids).not.toContain(rejectedStudent);
  });

  it('OS.4: a manual mark is not an arrival either', async () => {
    const manualOnly = `ONSITE-MANUAL-${tenantId}`;
    await db.insert(user).values({
      id: manualOnly, tenantId, name: 'Manual Only', email: `${manualOnly}@example.test`, role: 'student', classSectionId: sectionId,
    });
    await db.insert(attendance).values({
      tenantId, studentId: manualOnly, date: dbDay, status: 'present',
      markedById: adminId, classSectionId: sectionId, academicYearId: sessionYearId,
    });

    const { body } = await onsite(`?classSectionId=${sectionId}`);
    const ids = (body.data.students as { studentId: string }[]).map(s => s.studentId);
    expect(ids).not.toContain(manualOnly);
    // ...but it DOES count toward the campus headcount, which is a different question.
    expect(body.data.manualUnverified).toBeGreaterThan(0);
  });

  it('OS.5: another tenant\'s section is refused, never returned empty', async () => {
    const { status, body } = await onsite(`?classSectionId=${foreignSectionId}`);
    expect(status).toBe(422);
    expect(body.error.code).toBe('INVALID_REFERENCE');
  });

  it('OS.6: a malformed section id is refused', async () => {
    const { status } = await onsite('?classSectionId=not-a-uuid');
    expect(status).toBe(422);
  });

  it('OS.7: a campus-limited caller cannot read another campus\'s section', async () => {
    requestContext.branchId = randomUUID();
    try {
      const { status, body } = await onsite(`?classSectionId=${sectionId}`);
      expect(status).toBe(403);
      expect(body.error.code).toBe('FORBIDDEN');
    } finally {
      requestContext.branchId = null;
    }
  });
});
