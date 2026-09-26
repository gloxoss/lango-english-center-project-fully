import type { RequestContext } from '@/libs/api/context';
import { eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as saveMarksheet } from '@/app/api/academics/exam-terms/[id]/marksheet/route';
import { POST as allocateSeats } from '@/app/api/academics/exam-terms/[id]/seat-allocation/route';
import { GET as getStage, PUT as setStage } from '@/app/api/academics/exam-terms/[id]/stage/route';
import {
  assessmentDefinitions,
  assessmentOutcomes,
  examHalls,
  examSchedules,
  examSeats,
  examTerms,
} from '@/features/assessment/models/assessment-schema';
import { db } from '@/libs/DB';
import { tenants, user } from '@/models/Schema';

// The exam-term workflow, end to end.
//
// exam_terms.status has always documented five stages in a comment while nothing
// moved a term between them and nothing checked them, so seats could be
// reshuffled after an exam was sat and marks entered before it was scheduled.
// These tests pin the two things that now cannot happen.

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
const ADMIN = `USR-SA-${crypto.randomUUID()}`;
const OTHER_ADMIN = `USR-SO-${crypto.randomUUID()}`;
const STUDENT = `USR-SS-${crypto.randomUUID()}`;

let termId = '';
let hallId = '';
let definitionId = '';

async function asRole(userId: string, role: string, tid = tenantId) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId: tid, role } as RequestContext);
}

const routeParams = (id: string) => ({ params: Promise.resolve({ id }) });

function readStage(id = termId): Promise<Response> {
  return getStage(new Request(`http://localhost/api/academics/exam-terms/${id}/stage`), routeParams(id));
}

function moveStage(stage: string, id = termId): Promise<Response> {
  return setStage(
    new Request(`http://localhost/api/academics/exam-terms/${id}/stage`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ stage }),
    }),
    routeParams(id),
  );
}

function postSeats(): Promise<Response> {
  return allocateSeats(
    new Request(`http://localhost/api/academics/exam-terms/${termId}/seat-allocation`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ studentIds: [STUDENT], examHallIds: [hallId] }),
    }),
    routeParams(termId),
  );
}

function postMarks(): Promise<Response> {
  return saveMarksheet(
    new Request(`http://localhost/api/academics/exam-terms/${termId}/marksheet`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        assessmentDefinitionId: definitionId,
        marks: [{ studentId: STUDENT, rawScore: 14, status: 'graded' }],
      }),
    }),
    routeParams(termId),
  );
}

/** Puts the term directly into a stage, bypassing the gates the tests exercise. */
async function forceStage(stage: string) {
  await db.update(examTerms).set({ status: stage }).where(eq(examTerms.id, termId));
}

describe.skipIf(!dbReachable)('exam-term workflow — stage transitions and step locks', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Stage Test', slug: `stg-${tenantId}` },
      { id: otherTenantId, name: 'Stage Other', slug: `stgx-${otherTenantId}` },
    ]);

    await db.insert(user).values([
      { id: ADMIN, tenantId, name: 'Admin', email: `sa-${tenantId}@t.local`, role: 'school_admin' },
      { id: OTHER_ADMIN, tenantId: otherTenantId, name: 'Admin X', email: `so-${otherTenantId}@t.local`, role: 'school_admin' },
      { id: STUDENT, tenantId, name: 'Candidat', email: `ss-${tenantId}@t.local`, role: 'student' },
    ]);

    const [term] = await db.insert(examTerms).values({
      tenantId,
      name: 'Session de Juin',
      code: 'JUIN',
      startDate: '2026-06-01',
      endDate: '2026-06-20',
      status: 'setup',
    }).returning();
    termId = term!.id;

    const [definition] = await db.insert(assessmentDefinitions).values({
      tenantId,
      type: 'paper_exam',
      title: 'Mathématiques',
      maximumScore: '20.00',
      status: 'published',
    }).returning();
    definitionId = definition!.id;
  });

  beforeEach(async () => {
    await asRole(ADMIN, 'school_admin');
  });

  afterAll(async () => {
    await db.delete(assessmentOutcomes).where(eq(assessmentOutcomes.tenantId, tenantId));
    await db.delete(examSeats).where(eq(examSeats.tenantId, tenantId));
    await db.delete(examSchedules).where(eq(examSchedules.tenantId, tenantId));
    await db.delete(examHalls).where(eq(examHalls.tenantId, tenantId));
    await db.delete(assessmentDefinitions).where(eq(assessmentDefinitions.tenantId, tenantId));
    await db.delete(examTerms).where(eq(examTerms.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, otherTenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('starts in setup and reports its next stage as blocked with a reason', async () => {
    const { data } = await (await readStage()).json();

    expect(data.stage).toBe('setup');
    expect(data.nextStage).toBe('scheduling');
    expect(data.canAdvance).toBe(false);
    // A greyed-out button teaches nobody; the reason names the missing thing.
    expect(data.blockedCode).toBe('NO_EXAM_HALLS');
  });

  it('refuses to start scheduling with no exam hall declared', async () => {
    const res = await moveStage('scheduling');

    expect(res.status).toBe(409);

    const body = await res.json();

    expect(body.error.code).toBe('NO_EXAM_HALLS');
  });

  it('refuses to skip straight from setup to active', async () => {
    const res = await moveStage('active');

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('STAGE_SKIPPED');
  });

  it('will not allocate seats while the term is still in setup', async () => {
    const res = await postSeats();

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('STAGE_FORBIDS_ACTION');

    const seats = await db.select().from(examSeats).where(eq(examSeats.examTermId, termId));

    expect(seats).toHaveLength(0);
  });

  it('will not accept marks before the papers have been sat', async () => {
    const res = await postMarks();

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('STAGE_FORBIDS_ACTION');

    const outcomes = await db.select().from(assessmentOutcomes).where(eq(assessmentOutcomes.assessmentDefinitionId, definitionId));

    expect(outcomes).toHaveLength(0);
  });

  it('advances to scheduling once a hall exists', async () => {
    const [hall] = await db.insert(examHalls).values({
      tenantId,
      name: 'Salle A',
      code: 'A',
      capacity: 30,
    }).returning();
    hallId = hall!.id;

    const res = await moveStage('scheduling');

    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('scheduling');
  });

  it('allows seat allocation now that the term is being scheduled', async () => {
    const res = await postSeats();

    expect(res.status).toBe(200);
    expect((await res.json()).data.allocatedCount).toBe(1);
  });

  it('still refuses marks during scheduling', async () => {
    expect((await postMarks()).status).toBe(409);
  });

  it('refuses to go active with nothing scheduled', async () => {
    const res = await moveStage('active');

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('NO_SCHEDULED_EXAMS');
  });

  it('refuses to go active while an exam has no hall assigned', async () => {
    const [orphan] = await db.insert(examSchedules).values({
      tenantId,
      examTermId: termId,
      assessmentDefinitionId: definitionId,
      examHallId: null,
      startTime: '2026-06-02T08:00:00',
      endTime: '2026-06-02T10:00:00',
      status: 'published',
    }).returning();

    const res = await moveStage('active');

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('EXAMS_WITHOUT_HALL');

    await db.delete(examSchedules).where(eq(examSchedules.id, orphan!.id));
  });

  it('goes active once every exam has a hall and every candidate a desk', async () => {
    // Dated in the past so the term can also reach valuation below.
    await db.insert(examSchedules).values({
      tenantId,
      examTermId: termId,
      assessmentDefinitionId: definitionId,
      examHallId: hallId,
      startTime: '2026-06-02T08:00:00',
      endTime: '2026-06-02T10:00:00',
      status: 'published',
    });

    const res = await moveStage('active');

    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('active');
  });

  it('freezes seating once exams are under way', async () => {
    // The failure this prevents: regenerating seats deletes and rebuilds every
    // allocation, moving a candidate already sitting in the room.
    const res = await postSeats();

    expect(res.status).toBe(409);

    const seats = await db.select().from(examSeats).where(eq(examSeats.examTermId, termId));

    expect(seats).toHaveLength(1);
  });

  it('lets an admin roll back to scheduling to fix a problem', async () => {
    expect((await moveStage('scheduling')).status).toBe(200);
    expect((await moveStage('active')).status).toBe(200);
  });

  it('rolls back even when the entry requirement it would fail is unmet', async () => {
    // A term stuck in `active` with a broken timetable must still be rescuable,
    // or the gates become a trap rather than a safeguard.
    await db.insert(examSchedules).values({
      tenantId,
      examTermId: termId,
      assessmentDefinitionId: definitionId,
      examHallId: null,
      startTime: '2026-06-03T08:00:00',
      endTime: '2026-06-03T10:00:00',
      status: 'published',
    });

    expect((await moveStage('scheduling')).status).toBe(200);

    // Clean up so later stages are reachable again.
    await db.delete(examSchedules).where(isNull(examSchedules.examHallId));
    await db.update(examSchedules).set({ examHallId: hallId }).where(eq(examSchedules.examTermId, termId));
    await forceStage('active');
  });

  it('accepts marks once the term reaches valuation, and not before', async () => {
    expect((await postMarks()).status).toBe(409);

    expect((await moveStage('valuation')).status).toBe(200);

    const res = await postMarks();

    expect(res.status).toBe(200);

    const outcomes = await db.select().from(assessmentOutcomes).where(eq(assessmentOutcomes.assessmentDefinitionId, definitionId));

    expect(outcomes).toHaveLength(1);
    expect(Number(outcomes[0]!.rawScore)).toBe(14);
  });

  it('refuses to close the term while a mark is still pending', async () => {
    await db.insert(assessmentOutcomes).values({
      tenantId,
      assessmentDefinitionId: definitionId,
      studentId: `${STUDENT}-pending`,
      maximumScoreSnapshot: '20.00',
      status: 'pending',
    });

    const res = await moveStage('closed');

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('MARKS_PENDING');

    await db.delete(assessmentOutcomes).where(eq(assessmentOutcomes.studentId, `${STUDENT}-pending`));
  });

  it('closes the term and publishes it in one move', async () => {
    const res = await moveStage('closed');

    expect(res.status).toBe(200);

    const { data } = await res.json();

    expect(data.status).toBe('closed');
    // Closing is what publishes results — not a second flag to forget.
    expect(data.isPublished).toBe(true);

    const [outcome] = await db
      .select({ moderationState: assessmentOutcomes.moderationState })
      .from(assessmentOutcomes)
      .where(eq(assessmentOutcomes.assessmentDefinitionId, definitionId));
    expect(outcome?.moderationState).toBe('published');
  });

  it('refuses to reopen a closed term', async () => {
    const res = await moveStage('valuation');

    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe('TERM_CLOSED');
  });

  it('refuses marks once the term is closed', async () => {
    expect((await postMarks()).status).toBe(409);
  });

  it('never lets another tenant read or move this term’s stage', async () => {
    await asRole(OTHER_ADMIN, 'school_admin', otherTenantId);

    expect((await readStage()).status).toBe(404);
    expect((await moveStage('setup')).status).toBe(404);
  });

  it('404s on a term id that does not exist', async () => {
    expect((await readStage(crypto.randomUUID())).status).toBe(404);
  });
});
