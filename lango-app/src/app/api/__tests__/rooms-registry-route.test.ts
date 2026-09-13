import type { RequestContext } from '@/libs/api/context';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { DELETE, GET, POST, PUT } from '@/app/api/academics/rooms/route';
import { weekdayOf } from '@/features/academics/services/room-registry';
import { db } from '@/libs/DB';
import {
  academicRooms,
  classes,
  classScheduleSlots,
  classSections,
  classSubjects,
  mediums,
  sections,
  subjects,
  tenants,
  user,
} from '@/models/Schema';

// Covers the room registry replacing MOCK_ROOMS: the four rooms the Salles
// screen used to invent client-side are now rows, and occupancy is derived from
// class_schedule_slots at read time instead of being a hardcoded string.
//
// The load-bearing checks here are the tenant scope ones. Rooms are addressed by
// free-text room_label in the timetable, so a label match that ignored tenant_id
// would let one school's timetable populate another school's room cards.

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
const ADMIN = `USR-RA-${crypto.randomUUID()}`;
const TEACHER = `USR-RT-${crypto.randomUUID()}`;
const OTHER_ADMIN = `USR-RO-${crypto.randomUUID()}`;

// The seeded slot is anchored to *today* so the derived occupancy is exercised
// on the same weekday the route asks Postgres for.
const today = weekdayOf(new Date());

async function asRole(userId: string, role: string, tid = tenantId) {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({ userId, tenantId: tid, role } as RequestContext);
}

function getRooms(query = ''): Promise<Response> {
  return GET(new Request(`http://localhost/api/academics/rooms${query}`));
}

function postRoom(body: unknown): Promise<Response> {
  return POST(new Request('http://localhost/api/academics/rooms', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

function putRoom(body: unknown): Promise<Response> {
  return PUT(new Request('http://localhost/api/academics/rooms', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }));
}

type RoomPayload = {
  id: string;
  name: string;
  code: string | null;
  building: string | null;
  floor: string | null;
  capacity: number | null;
  equipment: string[];
  status: 'available' | 'maintenance';
  occupancyStatus: 'Occupied' | 'Available' | 'Maintenance';
  currentClass: string | null;
  schedule: { time: string; course: string; startTime: string; endTime: string }[];
};

async function readRooms(res: Response): Promise<RoomPayload[]> {
  const json = await res.json();
  return json.data as RoomPayload[];
}

describe.skipIf(!dbReachable)('/api/academics/rooms — tenant-scoped registry', () => {
  beforeAll(async () => {
    await db.insert(tenants).values([
      { id: tenantId, name: 'Rooms Test', slug: `rooms-${tenantId}` },
      { id: otherTenantId, name: 'Rooms Other', slug: `roomsx-${otherTenantId}` },
    ]);

    await db.insert(user).values([
      { id: ADMIN, tenantId, name: 'Admin', email: `ra-${tenantId}@t.local`, role: 'school_admin' },
      { id: TEACHER, tenantId, name: 'Prof', email: `rt-${tenantId}@t.local`, role: 'teacher' },
      { id: OTHER_ADMIN, tenantId: otherTenantId, name: 'Admin X', email: `ro-${otherTenantId}@t.local`, role: 'school_admin' },
    ]);

    // A timetable slot in SALLE-OCC running all day, so "is it busy right now"
    // is true regardless of when the suite runs.
    const [medium] = await db.insert(mediums).values({ tenantId, name: 'FR' }).returning();
    const [klass] = await db.insert(classes).values({ tenantId, name: '2BAC', mediumId: medium!.id }).returning();
    const [section] = await db.insert(sections).values({ tenantId, name: 'A' }).returning();
    const [classSection] = await db.insert(classSections)
      .values({ tenantId, classId: klass!.id, sectionId: section!.id, mediumId: medium!.id })
      .returning();
    const [subject] = await db.insert(subjects)
      .values({ tenantId, name: 'Mathématiques', mediumId: medium!.id, type: 'theory' })
      .returning();
    const [classSubject] = await db.insert(classSubjects)
      .values({ tenantId, classId: klass!.id, subjectId: subject!.id, type: 'compulsory' })
      .returning();

    await db.insert(classScheduleSlots).values({
      tenantId,
      classSectionId: classSection!.id,
      classSubjectId: classSubject!.id,
      teacherId: TEACHER,
      dayOfWeek: today,
      startTime: '00:00',
      endTime: '23:59',
      roomLabel: 'Salle Occupée',
    });
  });

  afterAll(async () => {
    await db.delete(classScheduleSlots).where(eq(classScheduleSlots.tenantId, tenantId));
    await db.delete(classSubjects).where(eq(classSubjects.tenantId, tenantId));
    await db.delete(subjects).where(eq(subjects.tenantId, tenantId));
    await db.delete(classSections).where(eq(classSections.tenantId, tenantId));
    await db.delete(classes).where(eq(classes.tenantId, tenantId));
    await db.delete(sections).where(eq(sections.tenantId, tenantId));
    await db.delete(mediums).where(eq(mediums.tenantId, tenantId));
    await db.delete(academicRooms).where(eq(academicRooms.tenantId, tenantId));
    await db.delete(academicRooms).where(eq(academicRooms.tenantId, otherTenantId));
    await db.delete(user).where(eq(user.tenantId, tenantId));
    await db.delete(user).where(eq(user.tenantId, otherTenantId));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
    await db.delete(tenants).where(eq(tenants.id, otherTenantId));
  });

  it('persists the full room record, not just name and capacity', async () => {
    await asRole(ADMIN, 'school_admin');

    const res = await postRoom({
      name: 'Salle Occupée',
      code: 'A-104',
      building: 'Bâtiment Principal',
      floor: '1er Étage',
      capacity: 32,
      roomType: 'Classroom',
      equipment: ['Vidéoprojecteur', 'TBI'],
    });

    expect(res.status).toBe(201);

    const { data } = await res.json();

    expect(data.building).toBe('Bâtiment Principal');
    expect(data.floor).toBe('1er Étage');
    expect(data.equipment).toEqual(['Vidéoprojecteur', 'TBI']);
    expect(data.status).toBe('available');
  });

  it('derives Occupied from the timetable rather than storing it', async () => {
    await asRole(ADMIN, 'school_admin');

    const rooms = await readRooms(await getRooms());
    const occupied = rooms.find(r => r.name === 'Salle Occupée');

    expect(occupied?.occupancyStatus).toBe('Occupied');
    expect(occupied?.currentClass).toBe('2BAC-A (Mathématiques)');
    expect(occupied?.schedule).toHaveLength(1);
  });

  it('reports a room with no timetable as Available with an empty schedule', async () => {
    await asRole(ADMIN, 'school_admin');
    await postRoom({ name: 'Salle Vide', code: 'B-201', capacity: 25, roomType: 'Classroom' });

    const rooms = await readRooms(await getRooms());
    const empty = rooms.find(r => r.name === 'Salle Vide');

    expect(empty?.occupancyStatus).toBe('Available');
    expect(empty?.currentClass).toBeNull();
    expect(empty?.schedule).toEqual([]);
  });

  it('lets maintenance override a scheduled class so the clash is visible', async () => {
    await asRole(ADMIN, 'school_admin');

    const before = await readRooms(await getRooms());
    const target = before.find(r => r.name === 'Salle Occupée')!;

    const res = await putRoom({ id: target.id, status: 'maintenance' });

    expect(res.status).toBe(200);

    const after = await readRooms(await getRooms());
    const updated = after.find(r => r.id === target.id);

    expect(updated?.occupancyStatus).toBe('Maintenance');
    expect(updated?.currentClass).toBeNull();
    // The class is still on the timetable — maintenance hides the occupancy
    // badge, not the booking an admin has to go and relocate.
    expect(updated?.schedule).toHaveLength(1);

    await putRoom({ id: target.id, status: 'available' });
  });

  it('rejects a duplicate code within the tenant', async () => {
    await asRole(ADMIN, 'school_admin');

    const res = await postRoom({ name: 'Salle Triplon', code: 'A-104' });

    expect(res.status).toBe(409);
  });

  it('lets a different tenant reuse the same room code', async () => {
    await asRole(OTHER_ADMIN, 'school_admin', otherTenantId);

    const res = await postRoom({ name: 'Salle Occupée', code: 'A-104' });

    expect(res.status).toBe(201);
  });

  it('never shows one tenant the other tenant’s rooms', async () => {
    await asRole(OTHER_ADMIN, 'school_admin', otherTenantId);
    const theirs = await readRooms(await getRooms());

    expect(theirs.map(r => r.name)).toEqual(['Salle Occupée']);
    expect(theirs.map(r => r.name)).not.toContain('Salle Vide');
  });

  it('never lets one tenant’s timetable mark another tenant’s room busy', async () => {
    // Same room name, same code, same live slot — but a different tenant, so the
    // label match must not cross the boundary.
    await asRole(OTHER_ADMIN, 'school_admin', otherTenantId);
    const theirs = await readRooms(await getRooms());

    expect(theirs[0]!.occupancyStatus).toBe('Available');
    expect(theirs[0]!.schedule).toEqual([]);
  });

  it('refuses to update a room belonging to another tenant', async () => {
    await asRole(ADMIN, 'school_admin');
    const mine = await readRooms(await getRooms());
    const myRoomId = mine.find(r => r.name === 'Salle Vide')!.id;

    await asRole(OTHER_ADMIN, 'school_admin', otherTenantId);
    const res = await putRoom({ id: myRoomId, name: 'Détournée' });

    expect(res.status).toBe(404);
  });

  it('refuses to delete a room belonging to another tenant', async () => {
    await asRole(ADMIN, 'school_admin');
    const mine = await readRooms(await getRooms());
    const myRoomId = mine.find(r => r.name === 'Salle Vide')!.id;

    await asRole(OTHER_ADMIN, 'school_admin', otherTenantId);
    const res = await DELETE(new Request(`http://localhost/api/academics/rooms?id=${myRoomId}`, { method: 'DELETE' }));

    expect(res.status).toBe(404);

    const [stillThere] = await db.select().from(academicRooms).where(eq(academicRooms.id, myRoomId));

    expect(stillThere).toBeDefined();
  });

  it('lets a teacher read the registry', async () => {
    await asRole(TEACHER, 'teacher');

    expect((await getRooms()).status).toBe(200);
  });

  it('declares a school_admin-only gate on every write verb', async () => {
    // requireRequestContext is mocked here, so a 403 assertion would only be
    // testing the mock. What the route actually owns is the allowlist it passes
    // in — that is what is asserted, per verb.
    const { requireRequestContext } = await import('@/libs/api/context');
    await asRole(ADMIN, 'school_admin');

    for (const call of [
      () => postRoom({ name: `Gate ${crypto.randomUUID()}` }),
      () => putRoom({ id: crypto.randomUUID(), name: 'Gate' }),
      () => DELETE(new Request(`http://localhost/api/academics/rooms?id=${crypto.randomUUID()}`, { method: 'DELETE' })),
    ]) {
      vi.mocked(requireRequestContext).mockClear();
      await call();

      expect(vi.mocked(requireRequestContext).mock.calls[0]![1]).toEqual(['school_admin']);
    }

    // GET is the wider one: teachers and front-office staff need to see rooms.
    vi.mocked(requireRequestContext).mockClear();
    await getRooms();

    expect(vi.mocked(requireRequestContext).mock.calls[0]![1]).toEqual(
      ['school_admin', 'teacher', 'accountant', 'receptionist'],
    );
  });

  it('rejects unknown fields rather than silently dropping them', async () => {
    await asRole(ADMIN, 'school_admin');

    // A tenantId in the body must not be a way to plant a room in another school.
    const res = await postRoom({ name: 'Salle Etrange', tenantId: otherTenantId });

    expect(res.status).toBe(422);
  });
});
