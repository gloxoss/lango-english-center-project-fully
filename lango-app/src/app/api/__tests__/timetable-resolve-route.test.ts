import type { RequestContext } from '@/libs/api/context';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as resolve } from '@/app/api/academics/timetable-conflicts/resolve/route';
import { db } from '@/libs/DB';
import { detectConflicts } from '@/libs/services/timetable-solver';
import {
  academicRooms,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  mediums,
  sections,
  subjects,
  teacherAvailability,
  tenants,
  user,
} from '@/models/Schema';

// The timetable auto-resolver.
//
// The conflicts endpoint it supplements offers fixes one pair at a time, each
// computed against the current schedule, so applying two in sequence can
// reintroduce a clash neither knew about. These tests pin that the combined
// search actually lands on a conflict-free timetable, that a dry run changes
// nothing, and that declared teacher availability is read in the positive sense
// the table stores it in.

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
const otherTenantId = crypto.randomUUID();
const ADMIN = `USR-TA-${crypto.randomUUID()}`;
const OTHER_ADMIN = `USR-TO-${crypto.randomUUID()}`;
const TEACHER_A = `USR-T1-${crypto.randomUUID()}`;
const TEACHER_B = `USR-T2-${crypto.randomUUID()}`;
const TEACHER_C = `USR-T3-${crypto.randomUUID()}`;

let sectionA = '';
let sectionB = '';
let sectionC = '';
let classSubjectId = '';

async function asRole(userId: string, role: string, tid = tenantId) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId: tid, role } as RequestContext);
}

function postResolve(body: unknown = {}): Promise<Response> {
  return resolve(new Request('http://localhost/api/academics/timetable-conflicts/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

/** Reads the tenant's slots back in the shape the solver's checker expects. */
async function currentSlots() {
  const rows = await db
    .select({
      id: classScheduleSlots.id,
      dayOfWeek: classScheduleSlots.dayOfWeek,
      startTime: classScheduleSlots.startTime,
      endTime: classScheduleSlots.endTime,
      classSectionId: classScheduleSlots.classSectionId,
      teacherId: classScheduleSlots.teacherId,
      roomLabel: classScheduleSlots.roomLabel,
    })
    .from(classScheduleSlots)
    .where(eq(classScheduleSlots.tenantId, tenantId));

  return rows;
}

async function replaceSlots(rows: {
  teacherId: string;
  classSectionId: string;
  roomLabel: string | null;
  dayOfWeek: 'monday' | 'tuesday' | 'wednesday';
  startTime: string;
  endTime: string;
}[]) {
  await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId));
  await db.insert(classScheduleSlots).values(rows.map(r => ({
    tenantId,
    classSectionId: r.classSectionId,
    classSubjectId,
    teacherId: r.teacherId,
    dayOfWeek: r.dayOfWeek,
    startTime: r.startTime,
    endTime: r.endTime,
    roomLabel: r.roomLabel,
  })));
}

describe.skipIf(!dbReachable)('POST /api/academics/timetable-conflicts/resolve', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Solver Test', slug: `slv-${tenantId}` },
      { id: otherTenantId, name: 'Solver Other', slug: `slvx-${otherTenantId}` },
    ]);

    await db.insert(user).values([
      { id: ADMIN, tenantId, name: 'Admin', email: `ta-${tenantId}@t.local`, role: 'school_admin' },
      { id: OTHER_ADMIN, tenantId: otherTenantId, name: 'Admin X', email: `to-${otherTenantId}@t.local`, role: 'school_admin' },
      { id: TEACHER_A, tenantId, name: 'Prof A', email: `t1-${tenantId}@t.local`, role: 'teacher' },
      { id: TEACHER_B, tenantId, name: 'Prof B', email: `t2-${tenantId}@t.local`, role: 'teacher' },
      { id: TEACHER_C, tenantId, name: 'Prof C', email: `t3-${tenantId}@t.local`, role: 'teacher' },
    ]);

    const [medium] = await db.insert(mediums).values({ tenantId, name: 'FR' }).returning();
    const [klass] = await db.insert(classes).values({ tenantId, name: '2BAC', mediumId: medium!.id }).returning();
    const secRows = await db.insert(sections).values([
      { tenantId, name: 'A' },
      { tenantId, name: 'B' },
      { tenantId, name: 'C' },
    ]).returning();

    const csRows = await db.insert(classSections).values(secRows.map(s => ({
      tenantId,
      classId: klass!.id,
      sectionId: s.id,
      mediumId: medium!.id,
    }))).returning();
    sectionA = csRows[0]!.id;
    sectionB = csRows[1]!.id;
    sectionC = csRows[2]!.id;

    const [subject] = await db.insert(subjects)
      .values({ tenantId, name: 'Mathématiques', mediumId: medium!.id, type: 'theory' })
      .returning();
    const [cs] = await db.insert(classSubjects)
      .values({ tenantId, classId: klass!.id, subjectId: subject!.id, type: 'compulsory' })
      .returning();
    classSubjectId = cs!.id;

    await db.insert(academicRooms).values([
      { tenantId, name: 'Salle A', code: 'A', capacity: 40 },
      { tenantId, name: 'Salle B', code: 'B', capacity: 40 },
    ]);
  });

  beforeEach(async () => {
    await asRole(ADMIN, 'school_admin');
  });

  afterAll(async () => {
    await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId));
    await db.delete(teacherAvailability).where(eq(teacherAvailability.tenantId, tenantId));
    await db.delete(academicRooms).where(eq(academicRooms.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, otherTenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('reports no conflicts for a clean timetable and changes nothing', async () => {
    await replaceSlots([
      { teacherId: TEACHER_A, classSectionId: sectionA, roomLabel: 'Salle A', dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00' },
      { teacherId: TEACHER_B, classSectionId: sectionB, roomLabel: 'Salle B', dayOfWeek: 'monday', startTime: '10:00', endTime: '12:00' },
    ]);

    const res = await postResolve({ apply: true });

    expect(res.status).toBe(200);

    const { data } = await res.json();

    expect(data.solved).toBe(true);
    expect(data.conflictsBefore).toBe(0);
    expect(data.applied).toBe(false);
    expect(data.moves).toEqual([]);
  });

  it('plans a fix without touching the timetable when apply is omitted', async () => {
    await replaceSlots([
      { teacherId: TEACHER_A, classSectionId: sectionA, roomLabel: 'Salle A', dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00' },
      { teacherId: TEACHER_B, classSectionId: sectionB, roomLabel: 'Salle A', dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00' },
      { teacherId: TEACHER_C, classSectionId: sectionC, roomLabel: 'Salle B', dayOfWeek: 'tuesday', startTime: '10:00', endTime: '12:00' },
    ]);

    const before = await currentSlots();
    const { data } = await (await postResolve()).json();

    expect(data.applied).toBe(false);
    expect(data.conflictsBefore).toBe(1);
    expect(data.moves.length).toBeGreaterThan(0);

    // Rewriting a school's week must never be a side effect of asking whether it
    // could be rewritten.
    expect(await currentSlots()).toEqual(before);
  });

  it('applies the plan and leaves the timetable conflict-free', async () => {
    const { data } = await (await postResolve({ apply: true })).json();

    expect(data.applied).toBe(true);
    expect(data.solved).toBe(true);
    expect(data.conflictsAfter).toBe(0);

    expect(detectConflicts(await currentSlots())).toEqual([]);
  });

  it('clears a chain that no sequence of independent one-pair fixes would settle', async () => {
    // Three classes want one room in one period, and the only other room is
    // occupied in the obvious alternative period.
    await replaceSlots([
      { teacherId: TEACHER_A, classSectionId: sectionA, roomLabel: 'Salle A', dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00' },
      { teacherId: TEACHER_B, classSectionId: sectionB, roomLabel: 'Salle A', dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00' },
      { teacherId: TEACHER_C, classSectionId: sectionC, roomLabel: 'Salle A', dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00' },
      { teacherId: TEACHER_A, classSectionId: sectionA, roomLabel: 'Salle B', dayOfWeek: 'monday', startTime: '10:00', endTime: '12:00' },
    ]);

    expect(detectConflicts(await currentSlots()).length).toBeGreaterThan(1);

    const { data } = await (await postResolve({ apply: true })).json();

    expect(data.solved).toBe(true);
    expect(detectConflicts(await currentSlots())).toEqual([]);
  });

  it('keeps a teacher inside their declared availability while resolving', async () => {
    // teacher_availability stores hours the teacher IS free. Reading it inverted
    // would push this lesson into exactly the hours they ruled out.
    await db.insert(teacherAvailability).values({
      tenantId,
      teacherId: TEACHER_A,
      dayOfWeek: 'monday',
      startTime: '08:00',
      endTime: '10:00',
    });

    await replaceSlots([
      { teacherId: TEACHER_A, classSectionId: sectionA, roomLabel: 'Salle A', dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00' },
      { teacherId: TEACHER_B, classSectionId: sectionB, roomLabel: 'Salle A', dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00' },
      { teacherId: TEACHER_C, classSectionId: sectionC, roomLabel: 'Salle B', dayOfWeek: 'monday', startTime: '10:00', endTime: '12:00' },
    ]);

    const { data } = await (await postResolve({ apply: true })).json();

    expect(data.solved).toBe(true);

    const after = await currentSlots();
    const teacherASlots = after.filter(s => s.teacherId === TEACHER_A);

    expect(teacherASlots).toHaveLength(1);
    expect(teacherASlots[0]).toMatchObject({ dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00' });
    expect(detectConflicts(after)).toEqual([]);

    await db.delete(teacherAvailability).where(eq(teacherAvailability.tenantId, tenantId));
  });

  it('never touches another tenant’s timetable', async () => {
    await replaceSlots([
      { teacherId: TEACHER_A, classSectionId: sectionA, roomLabel: 'Salle A', dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00' },
      { teacherId: TEACHER_B, classSectionId: sectionB, roomLabel: 'Salle A', dayOfWeek: 'monday', startTime: '08:00', endTime: '10:00' },
    ]);

    const mine = await currentSlots();

    await asRole(OTHER_ADMIN, 'school_admin', otherTenantId);
    const { data } = await (await postResolve({ apply: true })).json();

    // The other school has no slots, so there is nothing to solve and nothing of
    // ours may move.
    expect(data.conflictsBefore).toBe(0);
    expect(await currentSlots()).toEqual(mine);
  });

  it('rejects a body with unknown fields rather than ignoring them', async () => {
    await asRole(ADMIN, 'school_admin');

    const res = await postResolve({ apply: true, tenantId: otherTenantId });

    expect(res.status).toBe(422);
  });

  it('leaves every slot still owned by this tenant after applying', async () => {
    await asRole(ADMIN, 'school_admin');
    await postResolve({ apply: true });

    const rows = await db
      .select({ id: classScheduleSlots.id })
      .from(classScheduleSlots)
      .where(and(eq(classScheduleSlots.tenantId, tenantId)));

    expect(rows.length).toBe((await currentSlots()).length);
  });
});
