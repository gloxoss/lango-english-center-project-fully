import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '@/libs/DB';
import { settingValues, tenants, user } from '@/models/Schema';

/**
 * SCF-04-01. The Attendance settings page edits the six existing registry keys
 * through GET/PATCH /api/settings/values/[key]. This test is the round-trip the
 * plan asks for: save -> reload -> the same value comes back, and invalid
 * values are refused without moving the stored one.
 *
 * The threshold the flags engine reads is already covered end-to-end by
 * attendance-calendar-p0 G12.6b (lowering attendance.consecutiveAbsenceThreshold
 * to 2 makes a consecutive-absence flag fire); this file covers the other keys
 * and the validation path.
 */

vi.mock('@/libs/api/context', () => ({
  requireRequestContext: vi.fn(),
  requireTenant: vi.fn((ctx: { tenantId?: string | null }) => ctx.tenantId),
}));

vi.mock('@/libs/api/permissions', () => ({
  requireCapability: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/libs/api/audit', () => ({ recordAudit: vi.fn() }));

const dbReachable = Boolean(process.env.DATABASE_URL);
const suffix = randomUUID().slice(0, 8);
const tenantId = randomUUID();
const ADMIN = `USR-ATT-SET-${suffix}`;

async function asAdmin() {
  const { requireRequestContext } = await import('@/libs/api/context');
  vi.mocked(requireRequestContext).mockResolvedValue({
    userId: ADMIN,
    tenantId,
    branchId: null,
    role: 'school_admin',
    baseRole: 'school_admin',
    name: 'Directeur',
    email: 'directeur@att-settings.test',
    sessionId: null,
    impersonated: false,
  } as never);
}

async function patchKey(key: string, value: unknown) {
  const { PATCH } = await import('@/app/api/settings/values/[key]/route');
  return PATCH(
    new Request(`http://localhost:3000/api/settings/values/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ value }),
    }),
    { params: Promise.resolve({ key }) },
  );
}

async function getKey(key: string) {
  const { GET } = await import('@/app/api/settings/values/[key]/route');
  return GET(
    new Request(`http://localhost:3000/api/settings/values/${encodeURIComponent(key)}`),
    { params: Promise.resolve({ key }) },
  );
}

// One value per key the Attendance page edits, chosen away from the defaults
// so a "reload returns the default" bug cannot pass.
const CASES: Array<[string, unknown]> = [
  ['attendance.lateGraceMinutes', 45],
  ['attendance.periodStartTime', '08:30'],
  ['attendance.consecutiveAbsenceThreshold', 4],
  ['attendance.repeatedLateThreshold', 7],
  ['attendance.smsAlerts', false],
  ['attendance.presenceModes', {
    presence: true,
    retard: true,
    absenceJustifiee: false,
    absenceNonJustifiee: true,
    sortieAnticipee: false,
  }],
];

describe.skipIf(!dbReachable)('Attendance settings round-trip (SCF-04-01)', () => {
  beforeAll(async () => {
    await db.insert(tenants).values({ id: tenantId, name: `Att Settings ${suffix}`, slug: `att-set-${suffix}` });
    await db.insert(user).values({
      id: ADMIN,
      tenantId,
      name: 'Admin',
      email: `att-set-${suffix}@t.local`,
      role: 'school_admin',
    });
    await asAdmin();
  });

  afterAll(async () => {
    await db.delete(settingValues).where(eq(settingValues.tenantId, tenantId));
    await db.delete(user).where(eq(user.id, ADMIN));
    await db.delete(tenants).where(eq(tenants.id, tenantId));
  });

  it('each key saves and reloads with the same value', async () => {
    for (const [key, value] of CASES) {
      const saved = await patchKey(key, value);
      expect(saved.status, `${key} save`).toBe(200);

      const reloaded = await (await getKey(key)).json();
      expect(reloaded.data.value, `${key} reload`).toEqual(value);
    }
  });

  it('invalid values are refused with 422 and the stored value does not move', async () => {
    // Self-contained: pin the two values first so this test does not depend on
    // the previous one having run.
    await patchKey('attendance.lateGraceMinutes', 45);
    await patchKey('attendance.periodStartTime', '08:30');

    for (const [key, bad] of [
      ['attendance.periodStartTime', '25:99'],
      ['attendance.lateGraceMinutes', 301],
      ['attendance.consecutiveAbsenceThreshold', 1],
    ] as Array<[string, unknown]>) {
      const res = await patchKey(key, bad);
      expect(res.status, `${key} invalid`).toBe(422);
    }

    const grace = await (await getKey('attendance.lateGraceMinutes')).json();
    expect(grace.data.value).toBe(45);
    const start = await (await getKey('attendance.periodStartTime')).json();
    expect(start.data.value).toBe('08:30');
  });
});
