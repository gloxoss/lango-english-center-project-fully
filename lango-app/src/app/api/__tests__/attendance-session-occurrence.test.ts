import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { GET as auditSummary } from '@/app/api/attendance/audit-summary/route';
import {
  currentOccurrence,
  listSessionOccurrences,
  loadRegisterIndex,
  missingOccurrences,
  nextOccurrence,
  occurrenceState,
  registerForOccurrence,
  registerWindow,
} from '@/libs/attendance/session-occurrence';
import { db } from '@/libs/DB';
import {
  attendanceRegisters,
  branches,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  mediums,
  sections,
  sessionYears,
  subjects,
  tenants,
  timetableVersions,
  user,
} from '@/models/Schema';

// PHASE 1 — exact session identity.
//
// Before this, "registres manquants" asked whether a SECTION had any mark that
// day, so one completed lesson hid every other unmarked lesson of the same
// section. A register now answers for an exact scheduled occurrence
// (timetable slot x date), and the tests below pin that down.

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

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));
vi.mock('@/features/broadcast/services/sms-delivery', () => ({ sendSmsMessage: vi.fn() }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = crypto.randomUUID().slice(0, 8);
const tenantId = crypto.randomUUID();
const ADMIN = `SO-ADMIN-${suffix}`;
const TEACHER = `SO-TEACHER-${suffix}`;

const FROZEN_NOW = new Date('2026-10-06T12:00:00.000Z'); // 13:00 Casablanca, Tuesday
const PAST_TUESDAY = '2026-09-29';

let sectionId = '';
let slotMorning = '';
let slotLateMorning = '';

async function asAdmin() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId: ADMIN, tenantId, role: 'school_admin', branchId: null,
  } as RequestContext);
}

describe.skipIf(!dbReachable)('session occurrence — DB-backed', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FROZEN_NOW);

    await db.insert(tenants).values({ id: tenantId, name: `SessOcc ${suffix}`, slug: `sess-occ-${suffix}` });
    const [branch] = await db.insert(branches).values({ tenantId, name: `Campus ${suffix}`, code: `SO-${suffix}` }).returning();
    await db.insert(user).values([
      { id: ADMIN, tenantId, branchId: branch!.id, name: 'SO Admin', email: `so-ad-${suffix}@t.local`, role: 'school_admin' },
      { id: TEACHER, tenantId, branchId: branch!.id, name: 'SO Teacher', email: `so-te-${suffix}@t.local`, role: 'teacher' },
    ]);
    const [sessionYear] = await db.insert(sessionYears).values({
      tenantId, name: `SY-${suffix}`, startDate: '2026-09-01', endDate: '2027-06-30', isDefault: true,
    }).returning();
    const [medium] = await db.insert(mediums).values({ tenantId, name: `FR-${suffix}` }).returning();
    const [cls] = await db.insert(classes).values({ tenantId, branchId: branch!.id, name: `SO1-${suffix}`, mediumId: medium!.id }).returning();
    const [label] = await db.insert(sections).values({ tenantId, name: `SO-${suffix}` }).returning();
    const [cs] = await db.insert(classSections).values({ tenantId, classId: cls!.id, sectionId: label!.id, mediumId: medium!.id, maxStudents: 30 }).returning();
    sectionId = cs!.id;
    const [subject] = await db.insert(subjects).values({ tenantId, name: `Maths-${suffix}`, mediumId: medium!.id, type: 'theory' }).returning();
    const [classSubject] = await db.insert(classSubjects).values({ tenantId, classId: cls!.id, subjectId: subject!.id, type: 'compulsory' }).returning();

    const [version] = await db.insert(timetableVersions).values({
      tenantId, sessionYearId: sessionYear!.id, status: 'published', versionNumber: 1,
      effectiveFrom: '2026-09-01', effectiveTo: '2027-06-30', createdBy: ADMIN,
    }).returning();

    const base = { tenantId, classSectionId: sectionId, classSubjectId: classSubject!.id, teacherId: TEACHER, dayOfWeek: 'tuesday' as const, versionId: version!.id };
    const slots = await db.insert(classScheduleSlots).values([
      { ...base, startTime: '08:00', endTime: '09:00' },
      { ...base, startTime: '10:00', endTime: '11:00' },
    ]).returning();

    slotMorning = slots[0]!.id;
    slotLateMorning = slots[1]!.id;
  });

  afterAll(async () => {
    vi.useRealTimers();
    await db.delete(attendanceRegisters).where(eq(attendanceRegisters.tenantId, tenantId));
    await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId));
    await db.delete(timetableVersions).where(eq(timetableVersions.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(sessionYears).where(eq(sessionYears.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(branches).where(eq(branches.tenantId, tenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  async function missingStarts(date: string): Promise<string[]> {
    await asAdmin();
    const res = await auditSummary(new Request(`http://x/api/attendance/audit-summary?date=${date}`));
    const json = await res.json() as any;
    return (json.data.missingRegistersToday as { startTime: string }[]).map(r => r.startTime).sort();
  }

  it('SC.1: the day lists one occurrence per scheduled lesson, with a derived ordinal', async () => {
    const occurrences = await listSessionOccurrences({ tenantId, date: PAST_TUESDAY });

    expect(occurrences.map(o => o.startTime)).toEqual(['08:00', '10:00']);
    expect(occurrences.map(o => o.period)).toEqual([1, 2]);
    expect(occurrences[0]!.classSectionId).toBe(sectionId);
    expect(occurrences[0]!.teacherId).toBe(TEACHER);
  });

  it('SC.2: registering ONLY the first lesson still reports the second as missing', async () => {
    // This is the phase 0.5 limitation closed: the old section-level rule
    // reported nothing here, because the section already had a mark that day.
    await db.insert(attendanceRegisters).values({
      tenantId, classId: (await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, sectionId)).limit(1))[0]!.classId,
      classSectionId: sectionId, date: PAST_TUESDAY, period: 1, reference: `SO-${suffix}-A`,
      status: 'LOCKED', classScheduleSlotId: slotMorning,
    });

    expect(await missingStarts(PAST_TUESDAY)).toEqual(['10:00']);
  });

  it('SC.3: registering the second lesson too leaves nothing missing', async () => {
    await db.insert(attendanceRegisters).values({
      tenantId, classId: (await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, sectionId)).limit(1))[0]!.classId,
      classSectionId: sectionId, date: PAST_TUESDAY, period: 2, reference: `SO-${suffix}-B`,
      status: 'LOCKED', classScheduleSlotId: slotLateMorning,
    });

    expect(await missingStarts(PAST_TUESDAY)).toEqual([]);
  });

  it('SC.4: a LEGACY register with no slot still answers for its own lesson', async () => {
    // Pre-0158 rows keep (section, period) and must keep answering, so old
    // history is not retroactively reported as missing.
    const date = '2026-09-22'; // a past Tuesday
    await db.insert(attendanceRegisters).values({
      tenantId, classId: (await db.select({ classId: classSections.classId }).from(classSections).where(eq(classSections.id, sectionId)).limit(1))[0]!.classId,
      classSectionId: sectionId, date, period: 1, reference: `SO-${suffix}-LEGACY`,
      status: 'LOCKED', classScheduleSlotId: null,
    });

    // Period 1 is the 08:00 lesson, so only the 10:00 one stays missing.
    expect(await missingStarts(date)).toEqual(['10:00']);
  });

  it('SC.5: the register index resolves by exact occurrence first', async () => {
    const index = await loadRegisterIndex(tenantId, PAST_TUESDAY);
    const occurrences = await listSessionOccurrences({ tenantId, date: PAST_TUESDAY });

    const first = registerForOccurrence(index, occurrences[0]!);

    expect(first?.reference).toBe(`SO-${suffix}-A`);
  });
});

describe('session occurrence state', () => {
  const occurrence = { startTime: '14:00', endTime: '14:55' };
  const now = { date: '2026-10-06', hm: '14:30', selectedDate: '2026-10-06' };

  it('SC.6: an unregistered future lesson is "à venir", not missing', () => {
    expect(occurrenceState(occurrence, null, { ...now, hm: '13:00' })).toBe('A_VENIR');
  });

  it('SC.7: an unregistered lesson in progress is "en cours"', () => {
    expect(occurrenceState(occurrence, null, now)).toBe('EN_COURS');
  });

  it('SC.8: an unregistered lesson past its end is "à compléter"', () => {
    expect(occurrenceState(occurrence, null, { ...now, hm: '15:10' })).toBe('A_COMPLETER');
  });

  it('SC.9: a locked register reads "pointage terminé", a reopened one "corrigé"', () => {
    expect(occurrenceState(occurrence, { status: 'LOCKED' }, now)).toBe('POINTAGE_TERMINE');
    expect(occurrenceState(occurrence, { status: 'REOPENED' }, now)).toBe('CORRIGE');
  });

  it('SC.10: a cancelled occurrence is "annulé" regardless of its register', () => {
    expect(occurrenceState(occurrence, { status: 'LOCKED' }, now, true)).toBe('ANNULE');
  });

  it('SC.11: a past date is entirely over; a future date has not begun', () => {
    const past = { date: '2026-10-06', hm: '09:00', selectedDate: '2026-10-05' };
    const future = { date: '2026-10-06', hm: '09:00', selectedDate: '2026-10-07' };

    expect(occurrenceState(occurrence, null, past)).toBe('A_COMPLETER');
    expect(occurrenceState(occurrence, null, future)).toBe('A_VENIR');
  });

  it('SC.12: missingOccurrences ignores a future date entirely', async () => {
    const empty = { bySlot: new Map(), bySectionPeriod: new Map() };
    const future = '2027-01-05';

    expect(missingOccurrences(
      [{ slotId: 'x', date: future, classSectionId: 's', classSubjectId: 'cs', subjectId: null, subjectName: null, teacherId: 't', teacherName: null, branchId: null, className: null, sectionName: null, room: null, startTime: '08:00', endTime: '09:00', versionId: null, period: 1 }],
      empty,
      future,
    )).toEqual([]);
  });
});

// The approved attendance window: opens 5 minutes before the start, stays open
// through the lesson, closes 15 minutes after the end.
describe('attendance window', () => {
  const lesson = { startTime: '14:00', endTime: '14:55' };

  function at(date: string, hhmm: string) {
    // Build a Casablanca wall-clock moment by pinning UTC + 1h.
    const [h, m] = hhmm.split(':').map(Number);
    return new Date(Date.UTC(
      Number(date.slice(0, 4)), Number(date.slice(5, 7)) - 1, Number(date.slice(8, 10)),
      h! - 1, m!, 0, 0,
    ));
  }

  it('SC.13: opens 5 minutes before the lesson, not earlier', () => {
    expect(registerWindow(lesson, '2026-10-06', at('2026-10-06', '13:54'))).toBe('BEFORE');
    expect(registerWindow(lesson, '2026-10-06', at('2026-10-06', '13:55'))).toBe('OPEN');
  });

  it('SC.14: stays open through the lesson', () => {
    expect(registerWindow(lesson, '2026-10-06', at('2026-10-06', '14:00'))).toBe('OPEN');
    expect(registerWindow(lesson, '2026-10-06', at('2026-10-06', '14:55'))).toBe('OPEN');
  });

  it('SC.15: closes 15 minutes after the end, not before', () => {
    expect(registerWindow(lesson, '2026-10-06', at('2026-10-06', '15:10'))).toBe('OPEN');
    expect(registerWindow(lesson, '2026-10-06', at('2026-10-06', '15:11'))).toBe('CLOSED');
  });

  it('SC.16: a past date is always closed and a future date always unopened', () => {
    expect(registerWindow(lesson, '2026-10-05', at('2026-10-06', '14:00'))).toBe('CLOSED');
    expect(registerWindow(lesson, '2026-10-07', at('2026-10-06', '14:00'))).toBe('BEFORE');
  });

  it('SC.17: currentOccurrence picks the lesson inside the window', () => {
    const morning = { ...lesson, slotId: 'am', startTime: '08:00', endTime: '09:00' };
    const afternoon = { ...lesson, slotId: 'pm', startTime: '14:00', endTime: '14:55' };

    const found = currentOccurrence([morning, afternoon], '2026-10-06', at('2026-10-06', '14:10'));

    expect(found?.slotId).toBe('pm');
  });

  it('SC.18: no lesson inside the window yields null, never a guess', () => {
    const morning = { ...lesson, slotId: 'am', startTime: '08:00', endTime: '09:00' };

    expect(currentOccurrence([morning], '2026-10-06', at('2026-10-06', '12:00'))).toBeNull();
  });

  it('SC.19: nextOccurrence returns the first lesson still to start', () => {
    const morning = { ...lesson, slotId: 'am', startTime: '08:00', endTime: '09:00' };
    const afternoon = { ...lesson, slotId: 'pm', startTime: '14:00', endTime: '14:55' };

    expect(nextOccurrence([morning, afternoon], '2026-10-06', at('2026-10-06', '10:00'))?.slotId).toBe('pm');
    // After the last lesson there is nothing left to announce.
    expect(nextOccurrence([morning, afternoon], '2026-10-06', at('2026-10-06', '16:00'))).toBeNull();
  });
});
