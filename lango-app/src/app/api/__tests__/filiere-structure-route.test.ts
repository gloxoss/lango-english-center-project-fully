import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST as createClass } from '@/app/api/academics/classes/route';
import { GET as getCoefficients, PUT as setCoefficients } from '@/app/api/academics/streams/coefficients/route';
import { POST as createStream, PUT as updateStream } from '@/app/api/academics/streams/route';
import { db } from '@/libs/DB';
import { classes, mediums, streams, streamSubjectCoefficients, subjects, tenants, user } from '@/models/Schema';

// Filières as a real structure: a cycle, a Bac series code, and the subject
// coefficients the moyenne générale is computed on.
//
// The two rules worth pinning are the cycle restriction (a lycée filière on a
// collège class would average subjects those students never take) and the
// all-or-nothing coefficient replace (a half-applied edit produces a plausible
// but wrong moyenne for a whole filière).

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
const ADMIN = `USR-FA-${crypto.randomUUID()}`;
const OTHER_ADMIN = `USR-FO-${crypto.randomUUID()}`;

let mediumId = '';
let lyceeFiliereId = '';
let mathsId = '';
let philoId = '';
let foreignSubjectId = '';

async function asRole(userId: string, role: string, tid = tenantId) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId: tid, role } as RequestContext);
}

function postStream(body: unknown): Promise<Response> {
  return createStream(new Request('http://localhost/api/academics/streams', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function putStream(body: unknown): Promise<Response> {
  return updateStream(new Request('http://localhost/api/academics/streams', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function putCoefficients(body: unknown): Promise<Response> {
  return setCoefficients(new Request('http://localhost/api/academics/streams/coefficients', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function readCoefficients(streamId: string): Promise<Response> {
  return getCoefficients(new Request(`http://localhost/api/academics/streams/coefficients?streamId=${streamId}`));
}

function postClass(body: unknown): Promise<Response> {
  return createClass(new Request('http://localhost/api/academics/classes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

describe.skipIf(!dbReachable)('filière structure — cycle rules and coefficients', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Filiere Test', slug: `fil-${tenantId}` },
      { id: otherTenantId, name: 'Filiere Other', slug: `filx-${otherTenantId}` },
    ]);

    await db.insert(user).values([
      { id: ADMIN, tenantId, name: 'Admin', email: `fa-${tenantId}@t.local`, role: 'school_admin' },
      { id: OTHER_ADMIN, tenantId: otherTenantId, name: 'Admin X', email: `fo-${otherTenantId}@t.local`, role: 'school_admin' },
    ]);

    const [medium] = await db.insert(mediums).values({ tenantId, name: 'FR' }).returning();
    mediumId = medium!.id;

    const subjectRows = await db.insert(subjects).values([
      { tenantId, name: 'Mathématiques', mediumId, type: 'theory' },
      { tenantId, name: 'Philosophie', mediumId, type: 'theory' },
    ]).returning();
    mathsId = subjectRows[0]!.id;
    philoId = subjectRows[1]!.id;

    const [otherMedium] = await db.insert(mediums).values({ tenantId: otherTenantId, name: 'FR' }).returning();
    const [foreign] = await db.insert(subjects)
      .values({ tenantId: otherTenantId, name: 'Autre', mediumId: otherMedium!.id, type: 'theory' })
      .returning();
    foreignSubjectId = foreign!.id;
  });

  beforeEach(async () => {
    await asRole(ADMIN, 'school_admin');
  });

  afterAll(async () => {
    await db.delete(streamSubjectCoefficients).where(eq(streamSubjectCoefficients.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(streams).where(eq(streams.tenantId, tenantId));
    await db.delete(streams).where(eq(streams.tenantId, otherTenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, otherTenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, otherTenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, otherTenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('stores a filière with its cycle and Bac series code', async () => {
    const res = await postStream({
      name: 'Sciences Mathématiques A',
      code: 'SMA',
      cycle: 'lycee',
      bacSeriesCode: 'SM-A',
      displayOrder: 1,
    });

    expect(res.status).toBe(200);

    const { data } = await res.json();
    lyceeFiliereId = data.id;

    expect(data.cycle).toBe('lycee');
    expect(data.cycleLabel).toBe('Lycée');
    expect(data.bacSeriesCode).toBe('SM-A');
    expect(data.isActive).toBe(true);
  });

  it('rejects a second filière reusing the same code', async () => {
    const res = await postStream({ name: 'Doublon', code: 'SMA' });

    expect(res.status).toBe(409);
  });

  it('lets another school reuse that code', async () => {
    await asRole(OTHER_ADMIN, 'school_admin', otherTenantId);

    expect((await postStream({ name: 'Sciences Maths', code: 'SMA' })).status).toBe(200);
  });

  it('refuses a lycée filière on a collège class', async () => {
    const res = await postClass({
      name: '3APIC',
      mediumId,
      streamId: lyceeFiliereId,
      cycle: 'college',
    });

    expect(res.status).toBe(422);

    const body = await res.json();

    expect(body.error.code).toBe('FILIERE_CYCLE_MISMATCH');
  });

  it('accepts the same filière on a lycée class', async () => {
    const res = await postClass({
      name: '2BAC-SM',
      mediumId,
      streamId: lyceeFiliereId,
      cycle: 'lycee',
    });

    expect(res.status).toBe(200);
  });

  it('refuses an archived filière on a new class', async () => {
    await putStream({ id: lyceeFiliereId, isActive: false });

    const res = await postClass({ name: '1BAC-SM', mediumId, streamId: lyceeFiliereId, cycle: 'lycee' });

    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('FILIERE_INACTIVE');

    await putStream({ id: lyceeFiliereId, isActive: true });
  });

  it('saves a coefficient set and reports its total weight', async () => {
    const res = await putCoefficients({
      streamId: lyceeFiliereId,
      coefficients: [
        { subjectId: mathsId, coefficient: 7, isCore: true },
        { subjectId: philoId, coefficient: 2, isCore: false },
      ],
    });

    expect(res.status).toBe(200);
    expect((await res.json()).data.totalWeight).toBe(9);

    const { data } = await (await readCoefficients(lyceeFiliereId)).json();

    expect(data.totalWeight).toBe(9);
    expect(data.coreSubjectCount).toBe(1);
    expect(data.coefficients.find((c: { subjectId: string }) => c.subjectId === mathsId).coefficient).toBe(7);
  });

  it('replaces the whole set rather than merging into it', async () => {
    // A coefficient table is read as a whole when averaging, so a merge would
    // leave a stale weight behind and silently skew the moyenne.
    await putCoefficients({
      streamId: lyceeFiliereId,
      coefficients: [{ subjectId: mathsId, coefficient: 9, isCore: true }],
    });

    const { data } = await (await readCoefficients(lyceeFiliereId)).json();

    expect(data.coefficients).toHaveLength(1);
    expect(data.coefficients[0].coefficient).toBe(9);
  });

  it('rejects a zero coefficient, which would drop the subject silently', async () => {
    const res = await putCoefficients({
      streamId: lyceeFiliereId,
      coefficients: [{ subjectId: mathsId, coefficient: 0, isCore: true }],
    });

    expect(res.status).toBe(422);
  });

  it('rejects a set with no matière principale', async () => {
    const res = await putCoefficients({
      streamId: lyceeFiliereId,
      coefficients: [{ subjectId: mathsId, coefficient: 4, isCore: false }],
    });

    expect(res.status).toBe(422);
    expect((await res.json()).error.code).toBe('NO_CORE_SUBJECT');
  });

  it('refuses a subject belonging to another school', async () => {
    // Otherwise attaching a foreign subject id would confirm that it exists.
    const res = await putCoefficients({
      streamId: lyceeFiliereId,
      coefficients: [{ subjectId: foreignSubjectId, coefficient: 4, isCore: true }],
    });

    expect(res.status).toBe(422);
  });

  it('leaves the saved set untouched when a write is rejected', async () => {
    const { data } = await (await readCoefficients(lyceeFiliereId)).json();

    expect(data.coefficients).toHaveLength(1);
    expect(data.coefficients[0].coefficient).toBe(9);
  });

  it('never lets another school read or write this filière’s coefficients', async () => {
    await asRole(OTHER_ADMIN, 'school_admin', otherTenantId);

    expect((await readCoefficients(lyceeFiliereId)).status).toBe(404);
    expect((await putCoefficients({
      streamId: lyceeFiliereId,
      coefficients: [{ subjectId: mathsId, coefficient: 1, isCore: true }],
    })).status).toBe(404);
  });

  it('requires the streamId query param', async () => {
    const res = await getCoefficients(new Request('http://localhost/api/academics/streams/coefficients'));

    expect(res.status).toBe(400);
  });
});
